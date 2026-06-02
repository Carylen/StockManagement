import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, desc, asc
from app.core.database import get_db
from app.core.auth import get_current_principal, Principal
from app.models.part import Part
from app.models.stock import StockLevel, StockHistory
from app.schemas.part import PartResponse, PartListResponse, PaginatedParts, StockInfo, StockHistoryItem
from datetime import timedelta

router = APIRouter(prefix="/parts", tags=["parts"])


@router.get("/filters")
async def get_part_filters(
    site: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    """Return distinct commodity and producer values for filter dropdowns."""
    if current_user.role == "supplier" and site and site.upper() != "ALL":
        resolved_site = site.upper()
    else:
        resolved_site = current_user.site

    commodity_result = await db.execute(
        select(StockLevel.commodity)
        .where(StockLevel.site == resolved_site, StockLevel.commodity.isnot(None))
        .distinct()
        .order_by(StockLevel.commodity)
    )
    commodities = [r[0] for r in commodity_result.all() if r[0]]

    producer_result = await db.execute(
        select(Part.producer)
        .where(
            Part.is_active == True,
            Part.producer.isnot(None),
            Part.part_number.in_(
                select(StockLevel.part_number).where(StockLevel.site == resolved_site)
            ),
        )
        .distinct()
        .order_by(Part.producer)
    )
    producers = [r[0] for r in producer_result.all() if r[0]]

    return {"commodities": commodities, "producers": producers}


@router.get("", response_model=PaginatedParts)
async def list_parts(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    commodity: Optional[str] = Query(None),
    producer: Optional[str] = Query(None),
    site: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    sort_by: str = Query("part_number"),
    sort_dir: str = Query("asc"),
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    # Supplier can specify any site; non-supplier always uses their own site
    if current_user.role == "supplier" and site and site.upper() != "ALL":
        resolved_site = site.upper()
    else:
        resolved_site = current_user.site

    filters = [StockLevel.site == resolved_site]

    if search:
        like = f"%{search}%"
        filters.append(
            or_(StockLevel.part_number.ilike(like), StockLevel.description.ilike(like))
        )
    if status:
        filters.append(StockLevel.status == status.upper())
    if commodity:
        filters.append(StockLevel.commodity.ilike(f"%{commodity}%"))
    if producer:
        filters.append(
            StockLevel.part_number.in_(
                select(Part.part_number).where(Part.producer == producer.upper(), Part.is_active == True)
            )
        )

    count_q = select(func.count(StockLevel.id)).where(*filters)
    total_result = await db.execute(count_q)
    total = total_result.scalar_one() or 0

    sort_col_map = {
        "part_number": StockLevel.part_number,
        "description": StockLevel.description,
        "commodity": StockLevel.commodity,
        "rtt_qty": StockLevel.rtt_qty,
        "status": StockLevel.status,
    }
    sort_col = sort_col_map.get(sort_by, StockLevel.part_number)
    order = desc(sort_col) if sort_dir == "desc" else asc(sort_col)

    query = (
        select(StockLevel)
        .where(*filters)
        .order_by(order)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    levels = result.scalars().all()

    items = [
        PartListResponse(
            id=level.id,
            part_number=level.part_number,
            description=level.description,
            mnemonic=level.mnemonic,
            commodity=level.commodity,
            rtt_qty=level.rtt_qty,
            tbd_qty=level.tbd_qty,
            total_qty=level.total_qty,
            min_qty=float(level.min_qty),
            max_qty=float(level.max_qty),
            status=level.status,
            estimated_date=level.estimated_date,
        )
        for level in levels
    ]

    return PaginatedParts(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 1,
    )


@router.get("/autocomplete")
async def autocomplete_parts(
    q: Optional[str] = Query(None),
    kelas: Optional[str] = Query(None),
    limit: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(get_current_principal),
):
    """Lightweight type-ahead from master tb_m_parts. Used by inquiry/new dropdown."""
    if not q or len(q.strip()) < 2:
        return []
    like = f"%{q.strip()}%"
    filters = [
        Part.is_active == True,
        or_(Part.part_number.ilike(like), Part.description.ilike(like)),
    ]
    if kelas and kelas.upper() in ("V", "G"):
        filters.append(Part.kelas == kelas.upper())

    result = await db.execute(
        select(Part.part_number, Part.description, Part.mnemonic, Part.kelas)
        .where(*filters)
        .order_by(Part.part_number)
        .limit(limit)
    )
    return [
        {"part_number": r.part_number, "description": r.description, "mnemonic": r.mnemonic, "kelas": r.kelas}
        for r in result.all()
    ]


@router.get("/{part_number}", response_model=PartResponse)
async def get_part(
    part_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    site = current_user.site

    # Get stock data from tb_t_stock_levels
    sl_result = await db.execute(
        select(StockLevel).where(
            StockLevel.part_number == part_number,
            StockLevel.site == site,
        )
    )
    level = sl_result.scalar_one_or_none()

    # Also try master for extra metadata (mnemonic, kelas, producer)
    master_result = await db.execute(
        select(Part).where(Part.part_number == part_number, Part.is_active == True)
    )
    master = master_result.scalar_one_or_none()

    if not level and not master:
        raise HTTPException(status_code=404, detail="Part tidak ditemukan")

    current_stock = None
    if level:
        current_stock = StockInfo(
            rtt_qty=level.rtt_qty,
            tbd_qty=level.tbd_qty,
            total_qty=level.total_qty,
            min_qty=float(level.min_qty),
            max_qty=float(level.max_qty),
            status=level.status,
            estimated_date=level.estimated_date,
        )

    return PartResponse(
        id=master.id if master else level.id,
        part_number=part_number,
        description=level.description if level else (master.description if master else None),
        producer=master.producer if master else None,
        commodity=level.commodity if level else (master.commodity if master else None),
        kelas=master.kelas if master else "V",
        is_active=master.is_active if master else True,
        current_stock=current_stock,
        created_at=master.created_at if master else level.updated_at,
        updated_at=master.updated_at if master else level.updated_at,
    )


@router.get("/{part_number}/history", response_model=list[StockHistoryItem])
async def get_part_history(
    part_number: str,
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(get_current_principal),
):
    result = await db.execute(
        select(Part).where(Part.part_number == part_number, Part.is_active == True)
    )
    part = result.scalar_one_or_none()
    if not part:
        return []

    from datetime import datetime, timezone
    since = datetime.now(timezone.utc) - timedelta(days=days)
    hist_result = await db.execute(
        select(StockHistory)
        .where(
            StockHistory.part_id == part.id,
            StockHistory.synced_at >= since,
        )
        .order_by(StockHistory.synced_at.desc())
    )
    history = hist_result.scalars().all()

    return [
        StockHistoryItem(
            id=h.id,
            warehouse=h.warehouse,
            old_qty=h.old_qty,
            new_qty=h.new_qty,
            delta=h.delta,
            source_file=h.source_file,
            synced_at=h.synced_at,
        )
        for h in history
    ]
