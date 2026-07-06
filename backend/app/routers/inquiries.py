import math
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, exists
from app.core.database import get_db
from app.core.auth import Principal
from app.utils.permissions import require_permission, require_any_permission
from app.utils.scoping import require_view_inquiries, resolve_site, maybe_supplier_sites
from app.core.auth import get_current_principal
from app.models.inquiry import Inquiry, InquiryItem
from app.models.part import Part
from app.schemas.inquiry import (
    InquiryCreate, InquiryRespond, InquiryReject,
    InquiryListItem, InquiryDetail, InquiryItemResponse, PaginatedInquiries,
)

router = APIRouter(prefix="/inquiries", tags=["inquiries"])

# approval_status values that are visible to supplier/UT
_SUPPLIER_VISIBLE = ("approved", "not_required")


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
        approval_status=inq.approval_status,
        reject_reason=inq.reject_reason,
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
        approval_status=inq.approval_status,
        approved_by_name=inq.approver.name if inq.approver else None,
        approved_at=inq.approved_at,
        reject_reason=inq.reject_reason,
    )


def _denied_pns_by_class(
    permissions: set[str],
    pns: list[str],
    part_kelas: dict[str, str],
) -> list[str]:
    """Return PNs the principal is not allowed to request based on class permissions."""
    has_g = "can_request_class_g" in permissions
    has_v = "can_request_class_v" in permissions
    return [
        pn for pn in pns
        if (part_kelas[pn] == "G" and not has_g)
        or (part_kelas[pn] == "V" and not has_v)
    ]


def _resolve_approval_status(permissions: set[str]) -> str:
    """No approval step needed when the submitter already holds approve permission."""
    return "not_required" if "can_approve_inquiry" in permissions else "pending"


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
    principal: Principal = Depends(
        require_any_permission("can_request_class_g", "can_request_class_v")
    ),
):
    """Submit inquiry. Requires can_request_class_g or can_request_class_v per item kelas."""
    if not principal.site:
        raise HTTPException(status_code=400, detail="Principal has no site assigned")

    pns = [p.part_number for p in data.parts]

    # Validate all PNs exist in master and fetch kelas
    part_result = await db.execute(
        select(Part.part_number, Part.description, Part.kelas).where(Part.part_number.in_(pns))
    )
    part_rows = {row.part_number: {"desc": row.description, "kelas": row.kelas}
                 for row in part_result.all()}

    unknown_pns = [pn for pn in pns if pn not in part_rows]
    if unknown_pns:
        raise HTTPException(
            status_code=400,
            detail=f"Part tidak ada di master: {', '.join(unknown_pns)}",
        )

    part_kelas = {pn: part_rows[pn]["kelas"] for pn in pns}
    denied = _denied_pns_by_class(set(principal.permissions), pns, part_kelas)
    if denied:
        raise HTTPException(
            status_code=403,
            detail=f"Tidak punya akses kelas untuk part: {', '.join(denied)}",
        )

    approval_status = _resolve_approval_status(set(principal.permissions))

    inq = Inquiry(
        site=principal.site,
        submitted_by_user_id=principal.id,
        approval_status=approval_status,
    )
    db.add(inq)
    await db.flush()

    for p in data.parts:
        db.add(InquiryItem(
            inquiry_id=inq.id,
            part_number=p.part_number,
            part_name=part_rows.get(p.part_number, {}).get("desc"),
            qty=p.qty,
            status="pending",
        ))

    await db.flush()
    await db.refresh(inq, ["items", "submitter", "approver"])
    return _to_detail(inq)


@router.get("/me", response_model=PaginatedInquiries)
async def my_inquiries(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(
        require_any_permission("can_submit_inquiry", "can_request_class_g", "can_request_class_v")
    ),
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
        # Suppliers only see approved/not_required inquiries
        query = query.where(Inquiry.approval_status.in_(_SUPPLIER_VISIBLE))
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
    approval_status: Optional[str] = None,
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
        # Suppliers only see approved/not_required inquiries
        query = query.where(Inquiry.approval_status.in_(_SUPPLIER_VISIBLE))
        requested = site.upper() if site else None
        if requested and requested not in supplier_sites:
            return PaginatedInquiries(items=[], total=0, page=page, limit=limit, pages=1)
        if requested:
            query = query.where(Inquiry.site == requested)
        else:
            query = query.where(Inquiry.site.in_(supplier_sites))
    else:
        if approval_status:
            query = query.where(Inquiry.approval_status == approval_status)
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
    principal: Principal = Depends(get_current_principal),
):
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    can_view = (
        "can_view_team_inquiry" in principal.permissions
        or "can_view_all_inquiries" in principal.permissions
        or inq.submitted_by_user_id == principal.id
    )
    if not can_view:
        raise HTTPException(status_code=403, detail="Tidak punya akses ke inquiry ini")

    return _to_detail(inq)


@router.patch("/{inquiry_id}/approve", response_model=InquiryDetail)
async def approve_inquiry(
    inquiry_id: str,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_approve_inquiry")),
):
    """Planner approves a pending inquiry at the same site."""
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if inq.site != principal.site:
        raise HTTPException(status_code=403, detail="Inquiry bukan dari site kamu")
    if inq.approval_status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Inquiry sudah dalam status '{inq.approval_status}', tidak bisa di-approve",
        )

    inq.approval_status = "approved"
    inq.approved_by_user_id = principal.id
    inq.approved_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(inq, ["items", "submitter", "approver"])
    return _to_detail(inq)


@router.patch("/{inquiry_id}/reject", response_model=InquiryDetail)
async def reject_inquiry(
    inquiry_id: str,
    data: InquiryReject,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_approve_inquiry")),
):
    """Planner rejects a pending inquiry with a mandatory reason."""
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if inq.site != principal.site:
        raise HTTPException(status_code=403, detail="Inquiry bukan dari site kamu")
    if inq.approval_status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Inquiry sudah dalam status '{inq.approval_status}', tidak bisa di-reject",
        )

    inq.approval_status = "rejected"
    inq.approved_by_user_id = principal.id
    inq.approved_at = datetime.now(timezone.utc)
    inq.reject_reason = data.reject_reason

    await db.flush()
    await db.refresh(inq, ["items", "submitter", "approver"])
    return _to_detail(inq)


@router.patch("/{inquiry_id}/respond", response_model=InquiryDetail)
async def respond_inquiry(
    inquiry_id: str,
    data: InquiryRespond,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_respond_inquiry")),
):
    """PIC UT responds per-item. Inquiry must be approved or not_required."""
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    if inq.approval_status not in _SUPPLIER_VISIBLE:
        raise HTTPException(
            status_code=403,
            detail=f"Inquiry masih dalam approval (status: {inq.approval_status}), belum bisa direspond",
        )

    item_map = {item.id: item for item in inq.items}
    resp_map = {r.item_id: r for r in data.responses}

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
