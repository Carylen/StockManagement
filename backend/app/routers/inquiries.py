import math
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, exists
from app.core.database import get_db
from app.core.auth import Principal
from app.utils.permissions import require_permission
from app.utils.scoping import require_view_inquiries, resolve_site, maybe_supplier_sites
from app.models.inquiry import Inquiry, InquiryItem
from app.models.part import Part
from app.schemas.inquiry import (
    InquiryCreate, InquiryRespond,
    InquiryListItem, InquiryDetail, InquiryItemResponse, PaginatedInquiries,
)

router = APIRouter(prefix="/inquiries", tags=["inquiries"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _compute_status(items: list[InquiryItem]) -> str:
    """pending if any item is pending, done when all responded."""
    if not items:
        return "pending"
    return "pending" if any(i.status == "pending" for i in items) else "done"


def _to_list_item(inq: Inquiry) -> InquiryListItem:
    pending   = sum(1 for i in inq.items if i.status == "pending")
    valid_n   = sum(1 for i in inq.items if i.status == "valid")
    invalid_n = sum(1 for i in inq.items if i.status == "invalid")
    latest_responded = max(
        (i.responded_at for i in inq.items if i.responded_at),
        default=None,
    )
    return InquiryListItem(
        id=inq.id,
        site=inq.site,
        submitted_by_nrp=inq.submitter.nrp if inq.submitter else None,
        submitted_by_name=inq.submitter.name if inq.submitter else None,
        status=_compute_status(inq.items),
        total_unique_parts=len(inq.items),
        total_qty=sum(item.qty for item in inq.items),
        total_pending_items=pending,
        total_valid_items=valid_n,
        total_invalid_items=invalid_n,
        created_at=inq.created_at,
        responded_at=latest_responded,
    )


def _to_detail(inq: Inquiry) -> InquiryDetail:
    return InquiryDetail(
        id=inq.id,
        site=inq.site,
        submitted_by_nrp=inq.submitter.nrp if inq.submitter else None,
        submitted_by_name=inq.submitter.name if inq.submitter else None,
        status=_compute_status(inq.items),
        created_at=inq.created_at,
        updated_at=inq.updated_at,
        items=[
            InquiryItemResponse(
                id=item.id,
                part_number=item.part_number,
                part_name=item.part_name,
                qty=item.qty,
                status=item.status,
                replacement_pn=item.replacement_pn,
                ut_site_code=item.ut_site_code,
                ut_note=item.ut_note,
                responded_at=item.responded_at,
                responded_by=item.responded_by,
            )
            for item in inq.items
        ],
    )


def _apply_status_filter(query, status: Optional[str]):
    """Filter by computed inquiry status using item sub-exists."""
    if not status:
        return query
    has_pending = exists().where(
        InquiryItem.inquiry_id == Inquiry.id,
        InquiryItem.status == "pending",
    )
    if status == "pending":
        return query.where(has_pending)
    if status == "done":
        return query.where(~has_pending)
    return query


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=InquiryDetail, status_code=201)
async def create_inquiry(
    data: InquiryCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_submit_inquiry")),
):
    """Submit Class G inquiry (multi-part). Requires can_submit_inquiry."""
    if not principal.site:
        raise HTTPException(status_code=400, detail="Principal has no site assigned")

    pns = [p.part_number for p in data.parts]
    part_map: dict[str, str] = {}
    name_result = await db.execute(
        select(Part.part_number, Part.description).where(Part.part_number.in_(pns))
    )
    for row in name_result.all():
        if row.description:
            part_map[row.part_number] = row.description

    inq = Inquiry(
        site=principal.site,
        submitted_by_user_id=principal.id,
    )
    db.add(inq)
    await db.flush()

    for p in data.parts:
        db.add(InquiryItem(
            inquiry_id=inq.id,
            part_number=p.part_number,
            part_name=part_map.get(p.part_number),
            qty=p.qty,
            status="pending",
        ))

    await db.flush()
    await db.refresh(inq, ["items", "submitter"])
    return _to_detail(inq)


@router.get("/me", response_model=PaginatedInquiries)
async def my_inquiries(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_submit_inquiry")),
):
    """Inquiries submitted by the current principal."""
    query = (
        select(Inquiry)
        .where(
            Inquiry.submitted_by_user_id == principal.id,
            Inquiry.site == principal.site,
        )
        .order_by(desc(Inquiry.created_at))
    )

    query = _apply_status_filter(query, status)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    inquiries = result.scalars().all()

    return PaginatedInquiries(
        items=[_to_list_item(i) for i in inquiries],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 1,
    )


@router.get("/count")
async def count_inquiries(
    status: Optional[str] = None,
    site: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_view_inquiries),
    supplier_sites: list[str] | None = Depends(maybe_supplier_sites),
) -> dict:
    """Lightweight count. status=pending counts inquiries with ≥1 pending item."""
    query = select(func.count(Inquiry.id))
    query = _apply_status_filter(query, status)

    if supplier_sites is not None:
        if not supplier_sites:
            return {"count": 0}
        requested = site.upper() if site else None
        if requested and requested not in supplier_sites:
            return {"count": 0}
        if requested:
            query = query.where(Inquiry.site == requested)
        else:
            query = query.where(Inquiry.site.in_(supplier_sites))
    else:
        target_site = resolve_site(principal, site)
        if target_site is not None:
            query = query.where(Inquiry.site == target_site)

    result = await db.execute(query)
    return {"count": result.scalar_one() or 0}


@router.get("", response_model=PaginatedInquiries)
async def list_inquiries(
    status: Optional[str] = None,
    site: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_view_inquiries),
    supplier_sites: list[str] | None = Depends(maybe_supplier_sites),
):
    query = select(Inquiry).order_by(desc(Inquiry.created_at))
    query = _apply_status_filter(query, status)

    if from_date:
        query = query.where(func.date(Inquiry.created_at) >= from_date)
    if to_date:
        query = query.where(func.date(Inquiry.created_at) <= to_date)

    if supplier_sites is not None:
        if not supplier_sites:
            return PaginatedInquiries(items=[], total=0, page=page, limit=limit, pages=1)
        requested = site.upper() if site else None
        if requested and requested not in supplier_sites:
            return PaginatedInquiries(items=[], total=0, page=page, limit=limit, pages=1)
        if requested:
            query = query.where(Inquiry.site == requested)
        else:
            query = query.where(Inquiry.site.in_(supplier_sites))
    else:
        target_site = resolve_site(principal, site)
        if target_site is not None:
            query = query.where(Inquiry.site == target_site)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    inquiries = result.scalars().all()

    return PaginatedInquiries(
        items=[_to_list_item(i) for i in inquiries],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 1,
    )


@router.get("/{inquiry_id}", response_model=InquiryDetail)
async def get_inquiry(
    inquiry_id: str,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_view_inquiries),
):
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return _to_detail(inq)


@router.patch("/{inquiry_id}/respond", response_model=InquiryDetail)
async def respond_inquiry(
    inquiry_id: str,
    data: InquiryRespond,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_respond_inquiry")),
):
    """PIC UT responds per-item. Each response sets item status, replacement_pn, notes."""
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    # All items must still be pending (or partially pending — partial respond allowed)
    item_map = {item.id: item for item in inq.items}
    resp_map = {r.item_id: r for r in data.responses}

    # Validate: only respond to items that belong to this inquiry
    unknown = set(resp_map) - set(item_map)
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown item ids: {unknown}")

    now = datetime.now(timezone.utc)
    for item_id, r in resp_map.items():
        item = item_map[item_id]
        item.status = r.status
        item.replacement_pn = r.replacement_pn
        item.ut_site_code = r.ut_site_code
        item.ut_note = r.ut_note
        item.responded_by = principal.name
        item.responded_at = now

    await db.flush()
    await db.refresh(inq, ["items"])
    return _to_detail(inq)
