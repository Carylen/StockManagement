"""
On-the-fly readiness query service.

Two upload sources feed the same readiness picture per (part_number, site):
  - UT/Supplier: avail_stock (tb_t_ut_stock), status computed here from
    avail_stock vs the per-site MIN/MAX threshold. UT can optionally also
    supply rtt/tbd, in which case avail_stock is recomputed as rtt+tbd
    (on-hand plus incoming, both counted as available).
  - Admin: a trusted daily snapshot (tb_t_stock_levels) with rtt/tbd/status/
    estimasi taken as-is from the uploaded file (not recomputed), which also
    sets the per-site MIN/MAX threshold (tb_m_part_site_thresholds) as a
    side effect of upload.

Per part+site, whichever source was updated most recently wins ("source"):
  StockLevel.updated_at newer than (or UT missing) → ADMIN (trusted status)
  UTStock present                                  → UT (computed status)
  neither                                          → NONE (NO_DATA)

MIN/MAX used for the UT-computed status (and shown in the catalog) come
from tb_m_part_site_thresholds when set for that site, else fall back to
the global tb_m_parts.min_qty/max_qty (flagged via is_fallback).
"""
from dataclasses import dataclass, field
from datetime import datetime, date

from sqlalchemy import Numeric, and_, asc, case, cast, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.part import Part
from app.models.part_site_threshold import PartSiteThreshold
from app.models.stock import StockLevel
from app.models.ut_stock import UTStock


@dataclass
class ReadinessRow:
    part_number: str
    description: str | None
    mnemonic: str | None
    commodity: str | None
    kelas: str
    min_qty: float
    max_qty: float
    producer: str | None
    avail_stock: float | None
    last_uploaded_at: datetime | None
    status: str
    is_fallback: bool = False
    source: str = "NONE"
    rtt_qty: int | None = None
    tbd_qty: int | None = None
    estimated_date: date | None = None


@dataclass
class ReadinessStats:
    total_parts: int
    status_breakdown: dict[str, int] = field(default_factory=dict)
    readiness_oh_pct: float = 0.0
    readiness_min_pct: float = 0.0
    readiness_fb_pct: float = 0.0
    last_ut_upload: datetime | None = None
    last_admin_upload: datetime | None = None


def _source_case(stocklevel_updated_at, ut_uploaded_at, ut_avail_stock):
    return case(
        (
            and_(
                stocklevel_updated_at.isnot(None),
                or_(ut_uploaded_at.is_(None), stocklevel_updated_at > ut_uploaded_at),
            ),
            "ADMIN",
        ),
        (ut_avail_stock.isnot(None), "UT"),
        else_="NONE",
    )


def _status_case(source_expr, stocklevel_status, avail, min_col, max_col):
    """Trusted status for ADMIN-sourced rows, computed status for UT-sourced rows."""
    return case(
        (source_expr == "ADMIN", func.coalesce(func.upper(stocklevel_status), "NO_DATA")),
        (
            source_expr == "UT",
            case(
                (avail.is_(None), "NO_DATA"),
                (avail == 0, "WARNING"),
                (avail < min_col, "WARNING"),
                (avail > max_col, "OVER"),
                else_="AMAN",
            ),
        ),
        else_="NO_DATA",
    )


def _status_order_case(status_expr):
    """Lower number = higher priority (WARNING first)."""
    return case(
        (status_expr == "WARNING", 1),
        (status_expr == "OVER", 2),
        (status_expr == "AMAN", 3),
        else_=4,
    )


def _build_readiness_subquery(site_code: str, base_filters: list):
    """Shared join/case shape backing both get_readiness() and get_readiness_one()."""
    threshold_cond = and_(
        PartSiteThreshold.part_number == Part.part_number,
        PartSiteThreshold.site_code == site_code,
    )
    ut_cond = and_(
        UTStock.part_number == Part.part_number,
        UTStock.site_code == site_code,
        UTStock.is_latest == True,
    )
    sl_cond = and_(
        StockLevel.part_number == Part.part_number,
        StockLevel.site == site_code,
    )

    effective_min = func.coalesce(PartSiteThreshold.min_qty, Part.min_qty)
    effective_max = func.coalesce(PartSiteThreshold.max_qty, Part.max_qty)
    is_fallback_expr = PartSiteThreshold.part_number.is_(None)

    source_expr = _source_case(StockLevel.updated_at, UTStock.uploaded_at, UTStock.avail_stock)
    status_expr = _status_case(source_expr, StockLevel.status, UTStock.avail_stock, effective_min, effective_max)
    status_order_expr = _status_order_case(status_expr)

    avail_display = case(
        (source_expr == "ADMIN", cast(StockLevel.rtt_qty, Numeric(10, 2))),
        (source_expr == "UT", UTStock.avail_stock),
        else_=None,
    )
    last_uploaded_expr = case(
        (source_expr == "ADMIN", StockLevel.updated_at),
        (source_expr == "UT", UTStock.uploaded_at),
        else_=None,
    )
    rtt_expr = case(
        (source_expr == "ADMIN", StockLevel.rtt_qty),
        (source_expr == "UT", UTStock.rtt_qty),
        else_=None,
    )
    tbd_expr = case(
        (source_expr == "ADMIN", StockLevel.tbd_qty),
        (source_expr == "UT", UTStock.tbd_qty),
        else_=None,
    )
    estimated_date_expr = case(
        (source_expr == "ADMIN", StockLevel.estimated_date),
        (source_expr == "UT", UTStock.estimated_date),
        else_=None,
    )

    return (
        select(
            Part.part_number,
            Part.description,
            Part.mnemonic,
            Part.commodity,
            Part.kelas,
            effective_min.label("min_qty"),
            effective_max.label("max_qty"),
            Part.producer,
            avail_display.label("avail_stock"),
            last_uploaded_expr.label("last_uploaded_at"),
            status_expr.label("status"),
            status_order_expr.label("status_order"),
            is_fallback_expr.label("is_fallback"),
            source_expr.label("source"),
            rtt_expr.label("rtt_qty"),
            tbd_expr.label("tbd_qty"),
            estimated_date_expr.label("estimated_date"),
        )
        .outerjoin(PartSiteThreshold, threshold_cond)
        .outerjoin(UTStock, ut_cond)
        .outerjoin(StockLevel, sl_cond)
        .where(*base_filters)
    )


def _row_to_readiness_row(r) -> ReadinessRow:
    return ReadinessRow(
        part_number=r["part_number"],
        description=r["description"],
        mnemonic=r["mnemonic"],
        commodity=r["commodity"],
        kelas=r["kelas"],
        min_qty=float(r["min_qty"]),
        max_qty=float(r["max_qty"]),
        producer=r["producer"],
        avail_stock=float(r["avail_stock"]) if r["avail_stock"] is not None else None,
        last_uploaded_at=r["last_uploaded_at"],
        status=r["status"],
        is_fallback=bool(r["is_fallback"]),
        source=r["source"],
        rtt_qty=r["rtt_qty"],
        tbd_qty=r["tbd_qty"],
        estimated_date=r["estimated_date"],
    )


async def get_readiness(
    site_code: str,
    db: AsyncSession,
    kelas: str = "V",
    status_filter: str | None = None,
    search: str | None = None,
    producer: str | None = None,
    commodity: str | None = None,
    page: int = 1,
    limit: int = 20,
    sort_by: str = "status",
    sort_dir: str = "asc",
) -> tuple[list[ReadinessRow], int]:
    """
    Returns (rows, total_count) for the given site.
    total_count reflects the count AFTER filters are applied.
    """
    base_filters = [Part.kelas == kelas, Part.is_active == True]

    if search:
        like = f"%{search}%"
        base_filters.append(
            or_(Part.part_number.ilike(like), Part.description.ilike(like))
        )
    if commodity:
        base_filters.append(Part.commodity.ilike(f"%{commodity}%"))
    if producer:
        base_filters.append(Part.producer == producer.upper())

    inner = _build_readiness_subquery(site_code, base_filters).subquery()

    outer_filters = []
    if status_filter:
        outer_filters.append(inner.c.status == status_filter.upper())

    count_q = select(func.count()).select_from(inner)
    if outer_filters:
        count_q = count_q.where(*outer_filters)
    total_result = await db.execute(count_q)
    total = total_result.scalar_one() or 0

    sort_col_map = {
        "part_number": inner.c.part_number,
        "description": inner.c.description,
        "commodity": inner.c.commodity,
        "avail_stock": inner.c.avail_stock,
        "min_qty": inner.c.min_qty,
        "status": inner.c.status_order,
    }
    sort_col = sort_col_map.get(sort_by, inner.c.status_order)
    order_fn = desc if sort_dir == "desc" else asc
    secondary = asc(inner.c.part_number)

    rows_q = (
        select(inner)
        .where(*outer_filters)
        .order_by(order_fn(sort_col), secondary)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows_result = await db.execute(rows_q)
    rows = rows_result.mappings().all()

    return [_row_to_readiness_row(r) for r in rows], total


async def get_readiness_one(part_number: str, site_code: str, db: AsyncSession) -> ReadinessRow | None:
    """Single-part readiness lookup — same resolution logic as get_readiness(),
    used by the part detail endpoint so list and detail stay consistent."""
    base_filters = [Part.part_number == part_number, Part.is_active == True]
    query = _build_readiness_subquery(site_code, base_filters)
    result = await db.execute(query)
    row = result.mappings().one_or_none()
    return _row_to_readiness_row(row) if row else None


async def get_readiness_stats(site_code: str, db: AsyncSession, kelas: str = "V") -> ReadinessStats:
    """Compute status breakdown + metrics for dashboard summary."""
    base_filters = [Part.kelas == kelas, Part.is_active == True]
    inner = _build_readiness_subquery(site_code, base_filters).subquery()

    breakdown_q = select(inner.c.status, func.count().label("cnt")).group_by(inner.c.status)
    breakdown_result = await db.execute(breakdown_q)
    breakdown: dict[str, int] = {r.status: r.cnt for r in breakdown_result.all()}
    total = sum(breakdown.values())

    # "Fulfilled" (fb): rtt+tbd covers MIN for ADMIN-sourced rows (tbd = incoming
    # stock counted as a commitment); for UT-sourced rows there's no tbd concept,
    # so it falls back to the same avail_stock >= MIN check as min_count.
    fb_expr = case(
        (
            inner.c.source == "ADMIN",
            case(
                (
                    (func.coalesce(inner.c.rtt_qty, 0) + func.coalesce(inner.c.tbd_qty, 0)) >= inner.c.min_qty,
                    1,
                ),
                else_=0,
            ),
        ),
        (
            inner.c.source == "UT",
            case(
                (and_(inner.c.avail_stock.isnot(None), inner.c.avail_stock >= inner.c.min_qty), 1),
                else_=0,
            ),
        ),
        else_=0,
    )

    metrics_q = select(
        func.count().label("total"),
        func.sum(
            case((and_(inner.c.avail_stock.isnot(None), inner.c.avail_stock > 0), 1), else_=0)
        ).label("oh_count"),
        func.sum(
            case((and_(inner.c.avail_stock.isnot(None), inner.c.avail_stock >= inner.c.min_qty), 1), else_=0)
        ).label("min_count"),
        func.sum(fb_expr).label("fb_count"),
    ).select_from(inner)
    metrics_result = await db.execute(metrics_q)
    m = metrics_result.one()

    oh_pct = round(((m.oh_count or 0) / m.total * 100) if m.total else 0, 1)
    min_pct = round(((m.min_count or 0) / m.total * 100) if m.total else 0, 1)
    fb_pct = round(((m.fb_count or 0) / m.total * 100) if m.total else 0, 1)

    last_ut_result = await db.execute(
        select(func.max(UTStock.uploaded_at)).where(UTStock.site_code == site_code)
    )
    last_ut_upload = last_ut_result.scalar_one_or_none()

    last_admin_result = await db.execute(
        select(func.max(StockLevel.updated_at)).where(StockLevel.site == site_code)
    )
    last_admin_upload = last_admin_result.scalar_one_or_none()

    return ReadinessStats(
        total_parts=total,
        status_breakdown={
            "WARNING": breakdown.get("WARNING", 0),
            "AMAN": breakdown.get("AMAN", 0),
            "OVER": breakdown.get("OVER", 0),
            "NO_DATA": breakdown.get("NO_DATA", 0),
        },
        readiness_oh_pct=oh_pct,
        readiness_min_pct=min_pct,
        readiness_fb_pct=fb_pct,
        last_ut_upload=last_ut_upload,
        last_admin_upload=last_admin_upload,
    )
