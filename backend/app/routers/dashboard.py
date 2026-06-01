from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, exists
from app.core.database import get_db
from app.core.auth import get_current_principal, Principal
from app.models.stock import StockLevel
from app.models.inquiry import Inquiry, InquiryItem
from app.schemas.dashboard import (
    DashboardSummary,
    StatusCount,
    ReadynessMetrics,
    StockLatestItem,
    InquiryPendingCount,
    InquiryPulseItem,
    InquiryStatusCounts,
)
from app.services.stock_calc import compute_readyness

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    site: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    if current_user.role == "supplier" and site and site.upper() != "ALL":
        resolved_site = site.upper()
    elif current_user.role == "supplier":
        # supplier without ?site → return empty; caller should always specify site
        return DashboardSummary(
            site="",
            last_updated=None,
            total_parts=0,
            status_count=StatusCount(),
            readyness=ReadynessMetrics(),
        )
    else:
        resolved_site = current_user.site

    result = await db.execute(
        select(StockLevel).where(StockLevel.site == resolved_site)
    )
    levels = result.scalars().all()

    if not levels:
        return DashboardSummary(
            site=resolved_site,
            last_updated=None,
            total_parts=0,
            status_count=StatusCount(),
            readyness=ReadynessMetrics(),
        )

    status_count = StatusCount(
        WARNING=sum(1 for s in levels if s.status == "WARNING"),
        AMAN=sum(1 for s in levels if s.status == "AMAN"),
        OVER=sum(1 for s in levels if s.status == "OVER"),
        MAX=sum(1 for s in levels if s.status == "MAX"),
    )

    parts_data = [
        {"rtt_qty": s.rtt_qty, "tbd_qty": s.tbd_qty, "min_qty": float(s.min_qty)}
        for s in levels
    ]
    readyness_metrics = compute_readyness(parts_data)

    last_updated = max((s.updated_at for s in levels), default=None)

    return DashboardSummary(
        site=resolved_site,
        last_updated=last_updated,
        total_parts=len(levels),
        status_count=status_count,
        readyness=ReadynessMetrics(**readyness_metrics),
    )


@router.get("/stock-latest", response_model=list[StockLatestItem])
async def get_stock_latest(
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    site = current_user.site

    def _to_item(level: StockLevel) -> StockLatestItem:
        return StockLatestItem(
            part_number=level.part_number,
            description=level.description,
            commodity=level.commodity,
            rtt_qty=level.rtt_qty,
            tbd_qty=level.tbd_qty,
            estimated_date=level.estimated_date,
            min_qty=float(level.min_qty),
            max_qty=float(level.max_qty),
            status=level.status,
            updated_at=level.updated_at,
        )

    # Priority: WARNING parts first, up to 5
    warning_result = await db.execute(
        select(StockLevel)
        .where(StockLevel.site == site, StockLevel.status == "WARNING")
        .order_by(StockLevel.updated_at.desc())
        .limit(5)
    )
    items = [_to_item(l) for l in warning_result.scalars().all()]

    if len(items) < 5:
        existing_pns = {i.part_number for i in items}
        fill_result = await db.execute(
            select(StockLevel)
            .where(StockLevel.site == site)
            .order_by(StockLevel.updated_at.desc())
            .limit(20)
        )
        for level in fill_result.scalars().all():
            if level.part_number not in existing_pns and len(items) < 5:
                items.append(_to_item(level))
                existing_pns.add(level.part_number)

    return items[:5]


@router.get("/inquiry-pending", response_model=InquiryPendingCount)
async def get_inquiry_pending(
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    role = current_user.role
    has_pending = exists().where(
        InquiryItem.inquiry_id == Inquiry.id,
        InquiryItem.status == "pending",
    )

    if role == "mechanic":
        result = await db.execute(
            select(func.count(Inquiry.id)).where(
                Inquiry.submitted_by_nrp == current_user.nrp,
                Inquiry.site == current_user.site,
                has_pending,
            )
        )
        count = result.scalar_one() or 0
        label = "Menunggu Konfirmasi UT"
    elif role in ("group_leader", "admin"):
        result = await db.execute(
            select(func.count(Inquiry.id)).where(
                Inquiry.site == current_user.site,
                has_pending,
            )
        )
        count = result.scalar_one() or 0
        label = "Inquiry Pending"
    elif role == "supplier":
        result = await db.execute(
            select(func.count(Inquiry.id)).where(has_pending)
        )
        count = result.scalar_one() or 0
        label = "Inquiry Masuk"
    else:
        count = 0
        label = ""

    return InquiryPendingCount(count=count, role_label=label)


@router.get("/inquiry-pulse", response_model=list[InquiryPulseItem])
async def get_inquiry_pulse(
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    today = date.today()
    items = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        result = await db.execute(
            select(func.count(Inquiry.id)).where(func.date(Inquiry.created_at) == day)
        )
        count = result.scalar_one() or 0
        items.append(InquiryPulseItem(date=str(day), count=count))
    return items


@router.get("/inquiry-counts", response_model=InquiryStatusCounts)
async def get_inquiry_counts(
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    site = current_user.site

    total_result = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.site == site)
    )
    total = total_result.scalar_one() or 0

    has_pending = exists().where(
        InquiryItem.inquiry_id == Inquiry.id,
        InquiryItem.status == "pending",
    )
    pending_result = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.site == site, has_pending)
    )
    pending = pending_result.scalar_one() or 0

    return InquiryStatusCounts(
        pending=pending,
        done=total - pending,
        total=total,
    )
