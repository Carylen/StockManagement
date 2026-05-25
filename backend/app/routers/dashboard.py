from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.database import get_db
from app.core.auth import get_current_principal, Principal
from app.models.part import Part
from app.models.stock import StockLevel
from app.models.inquiry import Inquiry
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


async def _get_latest_snapshot_date(db: AsyncSession, site: str) -> date | None:
    result = await db.execute(
        select(func.max(StockLevel.snapshot_date)).where(StockLevel.site == site)
    )
    return result.scalar_one_or_none()


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    site: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    # Supplier can request any specific site; others always use their own site
    if current_user.role == "supplier" and site and site.upper() != "ALL":
        resolved_site = site.upper()
    elif current_user.role != "supplier":
        resolved_site = current_user.site
    else:
        # supplier with no site param or site=ALL — return consolidated stub
        # (call per-site from frontend; consolidated endpoint not implemented here)
        raise HTTPException(status_code=400, detail="Supplier must specify ?site=AGMR|RANT|SPUT")
    site = resolved_site
    latest_date = await _get_latest_snapshot_date(db, site)

    if not latest_date:
        return DashboardSummary(
            site=site,
            last_updated=None,
            total_parts=0,
            status_count=StatusCount(),
            readyness=ReadynessMetrics(),
        )

    # Fetch all stock levels for latest snapshot
    result = await db.execute(
        select(StockLevel).where(
            StockLevel.site == site,
            StockLevel.snapshot_date == latest_date,
        )
    )
    levels = result.scalars().all()

    status_count = StatusCount(
        WARNING=sum(1 for s in levels if s.status == "WARNING"),
        AMAN=sum(1 for s in levels if s.status == "AMAN"),
        OVER=sum(1 for s in levels if s.status == "OVER"),
        MAX=sum(1 for s in levels if s.status == "MAX"),
    )

    parts_data = [
        {
            "rtt_qty": s.rtt_qty,
            "tbd_qty": s.tbd_qty,
            "min_qty": float(s.min_qty),
        }
        for s in levels
    ]
    readyness_metrics = compute_readyness(parts_data)

    # Get last updated timestamp
    last_updated_result = await db.execute(
        select(func.max(StockLevel.updated_at)).where(
            StockLevel.site == site,
            StockLevel.snapshot_date == latest_date,
        )
    )
    last_updated = last_updated_result.scalar_one_or_none()

    return DashboardSummary(
        site=site,
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
    """Return 5 most recently updated parts with status changes."""
    site = current_user.site
    latest_date = await _get_latest_snapshot_date(db, site)
    if not latest_date:
        return []

    result = await db.execute(
        select(StockLevel, Part)
        .join(Part, Part.id == StockLevel.part_id)
        .where(
            StockLevel.site == site,
            StockLevel.snapshot_date == latest_date,
            StockLevel.status == "WARNING",
        )
        .order_by(StockLevel.updated_at.desc())
        .limit(5)
    )
    rows = result.all()

    def _to_item(level: StockLevel, part: Part) -> StockLatestItem:
        return StockLatestItem(
            part_number=part.part_number,
            description=part.description,
            producer=part.producer,
            commodity=part.commodity,
            rtt_qty=level.rtt_qty,
            tbd_qty=level.tbd_qty,
            estimated_qty=level.estimated_qty,
            min_qty=float(level.min_qty),
            max_qty=float(level.max_qty),
            status=level.status,
            snapshot_date=str(level.snapshot_date),
            updated_at=level.updated_at,
        )

    items = [_to_item(level, part) for level, part in rows]

    # If less than 5 WARNING, fill with other recent parts
    if len(items) < 5:
        existing_pns = {i.part_number for i in items}
        result2 = await db.execute(
            select(StockLevel, Part)
            .join(Part, Part.id == StockLevel.part_id)
            .where(
                StockLevel.site == site,
                StockLevel.snapshot_date == latest_date,
            )
            .order_by(StockLevel.updated_at.desc())
            .limit(20)
        )
        for level, part in result2.all():
            if part.part_number not in existing_pns and len(items) < 5:
                items.append(_to_item(level, part))
                existing_pns.add(part.part_number)

    return items[:5]


@router.get("/inquiry-pending", response_model=InquiryPendingCount)
async def get_inquiry_pending(
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    """Return count of inquiries pending action for the current user's role."""
    role = current_user.role

    if role in ("mechanic",):
        # Show own drafts
        result = await db.execute(
            select(func.count(Inquiry.id)).where(
                Inquiry.submitted_by == current_user.id,
                Inquiry.status == "draft",
            )
        )
        count = result.scalar_one() or 0
        label = "Draft Anda"
    elif role in ("group_leader",):
        # Show drafts awaiting approval
        result = await db.execute(
            select(func.count(Inquiry.id)).where(Inquiry.status == "draft")
        )
        count = result.scalar_one() or 0
        label = "Menunggu Approval"
    elif role == "admin":
        # Show all pending + draft
        result = await db.execute(
            select(func.count(Inquiry.id)).where(
                Inquiry.status.in_(["draft", "pending"])
            )
        )
        count = result.scalar_one() or 0
        label = "Perlu Tindakan"
    elif role == "supplier":
        # Show pending inquiries
        result = await db.execute(
            select(func.count(Inquiry.id)).where(Inquiry.status == "pending")
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
    """Return 7-day inquiry submission counts for chart."""
    today = date.today()
    items = []

    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        result = await db.execute(
            select(func.count(Inquiry.id)).where(
                func.date(Inquiry.created_at) == day
            )
        )
        count = result.scalar_one() or 0
        items.append(InquiryPulseItem(date=str(day), count=count))

    return items


@router.get("/inquiry-counts", response_model=InquiryStatusCounts)
async def get_inquiry_counts(
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    """Return inquiry status counts (pending/valid/invalid/total) for the current site."""
    site = current_user.site

    async def _count(status: str) -> int:
        r = await db.execute(
            select(func.count(Inquiry.id)).where(
                Inquiry.site == site,
                Inquiry.status == status,
            )
        )
        return r.scalar_one() or 0

    pending = await _count("pending")
    valid = await _count("valid")
    invalid = await _count("invalid")

    total_result = await db.execute(
        select(func.count(Inquiry.id)).where(Inquiry.site == site)
    )
    total = total_result.scalar_one() or 0

    return InquiryStatusCounts(pending=pending, valid=valid, invalid=invalid, total=total)
