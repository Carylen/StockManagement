from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, exists
from app.core.database import get_db
from app.core.auth import Principal
from app.utils.scoping import require_view_sites, resolve_site
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
from app.services.readiness_service import get_readiness, get_readiness_stats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    site: Optional[str] = Query(None),
    kelas: str = Query("V"),
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_view_sites),
):
    resolved_site = resolve_site(current_user, site)
    if resolved_site is None:
        return DashboardSummary(
            site="",
            last_updated=None,
            total_parts=0,
            status_count=StatusCount(),
            readyness=ReadynessMetrics(),
        )

    stats = await get_readiness_stats(resolved_site, db, kelas=kelas.upper())

    if stats.total_parts == 0:
        return DashboardSummary(
            site=resolved_site,
            last_updated=None,
            total_parts=0,
            status_count=StatusCount(),
            readyness=ReadynessMetrics(),
            last_ut_upload=stats.last_ut_upload,
        )

    return DashboardSummary(
        site=resolved_site,
        last_updated=stats.last_ut_upload,
        total_parts=stats.total_parts,
        status_count=StatusCount(
            WARNING=stats.status_breakdown.get("WARNING", 0),
            AMAN=stats.status_breakdown.get("AMAN", 0),
            OVER=stats.status_breakdown.get("OVER", 0),
            NO_DATA=stats.status_breakdown.get("NO_DATA", 0),
        ),
        readyness=ReadynessMetrics(
            oh_pct=stats.readiness_oh_pct,
            min_pct=stats.readiness_min_pct,
            fb_pct=0.0,
        ),
        last_ut_upload=stats.last_ut_upload,
    )


@router.get("/stock-latest", response_model=list[StockLatestItem])
async def get_stock_latest(
    site: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_view_sites),
):
    resolved_site = resolve_site(current_user, site) or current_user.site
    if not resolved_site:
        return []

    # WARNING first, then OVER, then AMAN — sorted by status priority, limited to 5
    rows, _ = await get_readiness(
        site_code=resolved_site,
        db=db,
        sort_by="status",
        sort_dir="asc",
        page=1,
        limit=5,
    )

    return [
        StockLatestItem(
            part_number=r.part_number,
            description=r.description,
            commodity=r.commodity,
            avail_stock=r.avail_stock,
            min_qty=r.min_qty or 0.0,
            max_qty=r.max_qty or 0.0,
            status=r.status,
            updated_at=r.last_uploaded_at,
        )
        for r in rows
    ]


@router.get("/inquiry-pending", response_model=InquiryPendingCount)
async def get_inquiry_pending(
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_view_sites),
):
    role = current_user.role
    has_pending = exists().where(
        InquiryItem.inquiry_id == Inquiry.id,
        InquiryItem.status == "pending",
    )

    if role == "user":
        result = await db.execute(
            select(func.count(Inquiry.id)).where(
                Inquiry.submitted_by_user_id == current_user.id,
                Inquiry.site == current_user.site,
                has_pending,
            )
        )
        count = result.scalar_one() or 0
        label = "Menunggu Konfirmasi UT"
    elif role == "admin":
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
    current_user: Principal = Depends(require_view_sites),
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
    current_user: Principal = Depends(require_view_sites),
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
