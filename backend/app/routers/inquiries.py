import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.inquiry import Inquiry
from app.models.user import User
from app.schemas.inquiry import (
    InquiryCreate, InquiryApprove, InquiryReject,
    InquiryRespond, InquiryResponse, PaginatedInquiries,
)

router = APIRouter(prefix="/inquiries", tags=["inquiries"])


def _to_response(inq: Inquiry) -> InquiryResponse:
    return InquiryResponse(
        id=inq.id,
        submitted_by=inq.submitted_by,
        reviewed_by=inq.reviewed_by,
        site=inq.site,
        part_name=inq.part_name,
        part_number=inq.part_number,
        qty_needed=inq.qty_needed,
        unit_asset=inq.unit_asset,
        date_needed=inq.date_needed,
        notes=inq.notes,
        status=inq.status,
        rejection_reason=inq.rejection_reason,
        supplier_notes=inq.supplier_notes,
        reviewed_at=inq.reviewed_at,
        responded_at=inq.responded_at,
        created_at=inq.created_at,
        updated_at=inq.updated_at,
        submitter_name=inq.submitter.name if inq.submitter else None,
        reviewer_name=inq.reviewer.name if inq.reviewer else None,
    )


@router.post("", response_model=InquiryResponse, status_code=201)
async def create_inquiry(
    data: InquiryCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("mechanic", "group_leader", "admin")),
):
    inq = Inquiry(
        submitted_by=current_user.id,
        site=current_user.site,
        part_name=data.part_name,
        part_number=data.part_number,
        qty_needed=data.qty_needed,
        unit_asset=data.unit_asset,
        date_needed=data.date_needed,
        notes=data.notes,
        status="draft",
    )
    db.add(inq)
    await db.flush()
    await db.refresh(inq, ["submitter", "reviewer"])
    return _to_response(inq)


@router.get("/me", response_model=PaginatedInquiries)
async def my_inquiries(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = (
        select(Inquiry)
        .where(Inquiry.submitted_by == current_user.id)
        .order_by(desc(Inquiry.created_at))
    )
    if status:
        query = query.where(Inquiry.status == status)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    inquiries = result.scalars().all()

    for inq in inquiries:
        await db.refresh(inq, ["submitter", "reviewer"])

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
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("group_leader", "admin", "supplier")),
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

    if current_user.role == "supplier":
        query = query.where(Inquiry.status.in_(["pending", "available", "unavailable", "partial"]))

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    inquiries = result.scalars().all()

    for inq in inquiries:
        await db.refresh(inq, ["submitter", "reviewer"])

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
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry tidak ditemukan")
    await db.refresh(inq, ["submitter", "reviewer"])
    return _to_response(inq)


@router.patch("/{inquiry_id}/approve", response_model=InquiryResponse)
async def approve_inquiry(
    inquiry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("group_leader", "admin")),
):
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry tidak ditemukan")
    if inq.status != "draft":
        raise HTTPException(status_code=400, detail=f"Inquiry sudah berstatus '{inq.status}', tidak bisa di-approve")
    inq.status = "pending"
    inq.reviewed_by = current_user.id
    inq.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(inq, ["submitter", "reviewer"])
    return _to_response(inq)


@router.patch("/{inquiry_id}/reject", response_model=InquiryResponse)
async def reject_inquiry(
    inquiry_id: str,
    data: InquiryReject,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("group_leader", "admin")),
):
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry tidak ditemukan")
    if inq.status != "draft":
        raise HTTPException(status_code=400, detail="Hanya inquiry berstatus draft yang bisa ditolak")
    inq.status = "rejected"
    inq.rejection_reason = data.rejection_reason
    inq.reviewed_by = current_user.id
    inq.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(inq, ["submitter", "reviewer"])
    return _to_response(inq)


@router.patch("/{inquiry_id}/respond", response_model=InquiryResponse)
async def respond_inquiry(
    inquiry_id: str,
    data: InquiryRespond,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("supplier")),
):
    valid_statuses = {"available", "unavailable", "partial"}
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status harus salah satu dari: {', '.join(valid_statuses)}")

    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inq = result.scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry tidak ditemukan")
    if inq.status != "pending":
        raise HTTPException(status_code=400, detail="Hanya inquiry berstatus pending yang bisa direspon")

    inq.status = data.status
    inq.supplier_notes = data.supplier_notes
    inq.responded_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(inq, ["submitter", "reviewer"])
    return _to_response(inq)
