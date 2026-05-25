import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.core.auth import get_current_principal, require_role, require_user_role, Principal
from app.models.inquiry import Inquiry
from app.schemas.inquiry import InquiryCreate, InquiryRespond, InquiryResponse, PaginatedInquiries

router = APIRouter(prefix="/inquiries", tags=["inquiries"])


def _to_response(inq: Inquiry) -> InquiryResponse:
    return InquiryResponse(
        id=inq.id,
        submitted_by=inq.submitted_by,
        submitted_by_employee_id=inq.submitted_by_employee_id,
        site=inq.site,
        kelas=inq.kelas,
        part_name=inq.part_name,
        part_number=inq.part_number,
        qty_needed=inq.qty_needed,
        unit_asset=inq.unit_asset,
        date_needed=inq.date_needed,
        notes=inq.notes,
        status=inq.status,
        ut_site_code=inq.ut_site_code,
        replacement_pn=inq.replacement_pn,
        respond_notes=inq.respond_notes,
        responded_at=inq.responded_at,
        created_at=inq.created_at,
        updated_at=inq.updated_at,
        submitter_name=inq.submitter_display_name,
    )


@router.post("", response_model=InquiryResponse, status_code=201)
async def create_inquiry(
    data: InquiryCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_role("mechanic")),
):
    """Submit Class G inquiry. Mechanic only."""
    if not principal.site:
        raise HTTPException(status_code=400, detail="Principal has no site assigned")

    inq = Inquiry(
        site=principal.site,
        kelas="G",
        part_name=data.part_name,
        part_number=data.part_number,
        qty_needed=data.qty_needed,
        unit_asset=data.unit_asset,
        date_needed=data.date_needed,
        notes=data.notes,
        status="pending",
    )
    if principal.principal_type == "employee":
        inq.submitted_by_employee_id = principal.id
    else:
        inq.submitted_by = principal.id

    db.add(inq)
    await db.flush()
    await db.refresh(inq, ["submitter", "employee_submitter"])
    return _to_response(inq)


@router.get("/me", response_model=PaginatedInquiries)
async def my_inquiries(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
):
    if principal.principal_type == "employee":
        query = select(Inquiry).where(Inquiry.submitted_by_employee_id == principal.id)
    else:
        query = select(Inquiry).where(Inquiry.submitted_by == principal.id)

    query = query.order_by(desc(Inquiry.created_at))
    if status:
        query = query.where(Inquiry.status == status)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    inquiries = result.scalars().all()

    for inq in inquiries:
        await db.refresh(inq, ["submitter", "employee_submitter"])

    return PaginatedInquiries(
        items=[_to_response(i) for i in inquiries],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if limit > 0 else 0,
    )


@router.get("", response_model=PaginatedInquiries)
async def list_inquiries(
    status: Optional[str] = None,
    site: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_role("group_leader", "admin", "supplier")),
):
    query = select(Inquiry).order_by(desc(Inquiry.created_at))

    if status:
        query = query.where(Inquiry.status == status)
    if from_date:
        query = query.where(func.date(Inquiry.created_at) >= from_date)
    if to_date:
        query = query.where(func.date(Inquiry.created_at) <= to_date)
    if search:
        q = f"%{search}%"
        query = query.where(Inquiry.part_name.ilike(q))

    if principal.role == "supplier":
        # Supplier sees all sites unless a specific site is requested
        if site and site.upper() != "ALL":
            query = query.where(Inquiry.site == site)
    else:
        # Admin / GL: scoped to own site unless site param overrides
        target_site = site if (site and site.upper() != "ALL") else principal.site
        query = query.where(Inquiry.site == target_site)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    inquiries = result.scalars().all()

    for inq in inquiries:
        await db.refresh(inq, ["submitter", "employee_submitter"])

    return PaginatedInquiries(
        items=[_to_response(i) for i in inquiries],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if limit > 0 else 0,
    )


@router.get("/{inquiry_id}", response_model=InquiryResponse)
async def get_inquiry(
    inquiry_id: str,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
):
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    await db.refresh(inq, ["submitter", "employee_submitter"])
    return _to_response(inq)


@router.patch("/{inquiry_id}/respond", response_model=InquiryResponse)
async def respond_inquiry(
    inquiry_id: str,
    data: InquiryRespond,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_user_role("supplier")),
):
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if inq.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending inquiries can be responded to")

    if data.result == "invalid" and not data.replacement_pn:
        raise HTTPException(status_code=400, detail="replacement_pn is required when result is invalid")

    inq.status = data.result          # "valid" | "invalid"
    inq.ut_site_code = data.ut_site_code
    inq.replacement_pn = data.replacement_pn
    inq.respond_notes = data.note
    inq.responded_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(inq, ["submitter", "employee_submitter"])
    return _to_response(inq)
