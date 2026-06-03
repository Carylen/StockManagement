"""
On-the-fly readiness query service.

Status is calculated at query time from tb_m_parts + tb_t_ut_stock:
  avail_stock IS NULL          → NO_DATA
  avail_stock = 0              → WARNING  (treat 0 as below min)
  avail_stock < min_qty        → WARNING
  avail_stock > max_qty        → OVER
  else                         → AMAN
"""
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.part import Part
from app.models.ut_stock import UTStock, UTUploadLog


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


@dataclass
class ReadinessStats:
    total_parts: int
    status_breakdown: dict[str, int] = field(default_factory=dict)
    readiness_oh_pct: float = 0.0
    readiness_min_pct: float = 0.0
    last_ut_upload: datetime | None = None


def _status_case(avail):
    """SQLAlchemy CASE expression for readiness status."""
    return case(
        (avail.is_(None), "NO_DATA"),
        (avail == 0, "WARNING"),
        (avail < Part.min_qty, "WARNING"),
        (avail > Part.max_qty, "OVER"),
        else_="AMAN",
    )


def _status_order_case(avail):
    """Lower number = higher priority (WARNING first)."""
    return case(
        (avail.is_(None), 4),
        (avail == 0, 1),
        (avail < Part.min_qty, 1),
        (avail > Part.max_qty, 2),
        else_=3,
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
    avail = UTStock.avail_stock
    status_expr = _status_case(avail).label("status")
    status_order_expr = _status_order_case(avail).label("status_order")

    join_cond = and_(
        UTStock.part_number == Part.part_number,
        UTStock.site_code == site_code,
        UTStock.is_latest == True,
    )

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

    # Status filter must be applied as a HAVING-like condition on the derived status.
    # We use a subquery so we can filter on the computed column.
    inner = (
        select(
            Part.part_number,
            Part.description,
            Part.mnemonic,
            Part.commodity,
            Part.kelas,
            Part.min_qty,
            Part.max_qty,
            Part.producer,
            avail.label("avail_stock"),
            UTStock.uploaded_at.label("last_uploaded_at"),
            status_expr,
            status_order_expr,
        )
        .outerjoin(UTStock, join_cond)
        .where(*base_filters)
        .subquery()
    )

    outer_filters = []
    if status_filter:
        outer_filters.append(inner.c.status == status_filter.upper())

    count_q = select(func.count()).select_from(inner)
    if outer_filters:
        count_q = count_q.where(*outer_filters)
    total_result = await db.execute(count_q)
    total = total_result.scalar_one() or 0

    # Build ORDER BY
    sort_col_map = {
        "part_number": inner.c.part_number,
        "description": inner.c.description,
        "commodity": inner.c.commodity,
        "avail_stock": inner.c.avail_stock,
        "min_qty": inner.c.min_qty,
        "status": inner.c.status_order,
    }
    sort_col = sort_col_map.get(sort_by, inner.c.status_order)
    from sqlalchemy import asc, desc
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

    return [
        ReadinessRow(
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
        )
        for r in rows
    ], total


async def get_readiness_stats(site_code: str, db: AsyncSession, kelas: str = "V") -> ReadinessStats:
    """Compute status breakdown + metrics for dashboard summary."""
    avail = UTStock.avail_stock
    status_expr = _status_case(avail).label("status")

    join_cond = and_(
        UTStock.part_number == Part.part_number,
        UTStock.site_code == site_code,
        UTStock.is_latest == True,
    )

    inner = (
        select(
            Part.min_qty,
            avail.label("avail_stock"),
            status_expr,
        )
        .outerjoin(UTStock, join_cond)
        .where(Part.kelas == kelas, Part.is_active == True)
        .subquery()
    )

    breakdown_q = select(inner.c.status, func.count().label("cnt")).group_by(inner.c.status)
    breakdown_result = await db.execute(breakdown_q)
    breakdown: dict[str, int] = {r.status: r.cnt for r in breakdown_result.all()}
    total = sum(breakdown.values())

    # Readiness metrics from raw avail/min values
    metrics_q = select(
        func.count().label("total"),
        func.sum(
            case((and_(inner.c.avail_stock.isnot(None), inner.c.avail_stock > 0), 1), else_=0)
        ).label("oh_count"),
        func.sum(
            case((and_(inner.c.avail_stock.isnot(None), inner.c.avail_stock >= inner.c.min_qty), 1), else_=0)
        ).label("min_count"),
    ).select_from(inner)
    metrics_result = await db.execute(metrics_q)
    m = metrics_result.one()

    oh_pct = round(((m.oh_count or 0) / m.total * 100) if m.total else 0, 1)
    min_pct = round(((m.min_count or 0) / m.total * 100) if m.total else 0, 1)

    # Last upload for this site (from UTStock)
    last_upload_result = await db.execute(
        select(func.max(UTStock.uploaded_at)).where(UTStock.site_code == site_code)
    )
    last_upload = last_upload_result.scalar_one_or_none()

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
        last_ut_upload=last_upload,
    )
