import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.part import Part
from app.models.stock import StockLevel, StockHistory
from app.schemas.part import PartResponse, PartListResponse, PaginatedParts, StockInfo, StockHistoryItem
from datetime import date, timedelta

router = APIRouter(prefix="/parts", tags=["parts"])


async def _get_latest_date(db: AsyncSession, site: str) -> date | None:
    result = await db.execute(
        select(func.max(StockLevel.snapshot_date)).where(StockLevel.site == site)
    )
    return result.scalar_one_or_none()


@router.get("", response_model=PaginatedParts)
async def list_parts(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    producer: Optional[str] = Query(None),
    commodity: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("part_number"),
    sort_dir: str = Query("asc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    site = current_user.site
    latest_date = await _get_latest_date(db, site)

    # Build base query joining Part with latest StockLevel
    if latest_date:
        base = (
            select(Part, StockLevel)
            .outerjoin(
                StockLevel,
                and_(
                    StockLevel.part_id == Part.id,
                    StockLevel.site == site,
                    StockLevel.snapshot_date == latest_date,
                ),
            )
            .where(Part.is_active == True)
        )
    else:
        base = select(Part, None).where(Part.is_active == True)

    # Apply filters
    filters = [Part.is_active == True]
    if search:
        like = f"%{search}%"
        filters.append(
            or_(Part.part_number.ilike(like), Part.description.ilike(like))
        )
    if producer:
        filters.append(Part.producer == producer.upper())
    if commodity:
        filters.append(Part.commodity.ilike(f"%{commodity}%"))
    if status and latest_date:
        filters.append(StockLevel.status == status.upper())

    if latest_date:
        query = (
            select(Part, StockLevel)
            .outerjoin(
                StockLevel,
                and_(
                    StockLevel.part_id == Part.id,
                    StockLevel.site == site,
                    StockLevel.snapshot_date == latest_date,
                ),
            )
            .where(*filters)
        )
    else:
        query = select(Part).where(*[f for f in filters if not str(f).startswith("stock")])

    # Count total
    if latest_date:
        count_q = (
            select(func.count(Part.id))
            .outerjoin(
                StockLevel,
                and_(
                    StockLevel.part_id == Part.id,
                    StockLevel.site == site,
                    StockLevel.snapshot_date == latest_date,
                ),
            )
            .where(*filters)
        )
    else:
        count_q = select(func.count(Part.id)).where(Part.is_active == True)
        if search:
            like = f"%{search}%"
            count_q = count_q.where(
                or_(Part.part_number.ilike(like), Part.description.ilike(like))
            )

    total_result = await db.execute(count_q)
    total = total_result.scalar_one() or 0

    # Sorting
    sort_col_map = {
        "part_number": Part.part_number,
        "description": Part.description,
        "producer": Part.producer,
        "commodity": Part.commodity,
        "rtt_qty": StockLevel.rtt_qty if latest_date else Part.part_number,
        "status": StockLevel.status if latest_date else Part.part_number,
    }
    sort_col = sort_col_map.get(sort_by, Part.part_number)
    if sort_dir == "desc":
        query = query.order_by(desc(sort_col))
    else:
        query = query.order_by(asc(sort_col))

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    items = []
    for row in rows:
        if latest_date:
            part, level = row
        else:
            part = row[0] if isinstance(row, tuple) else row
            level = None

        item = PartListResponse(
            id=part.id,
            part_number=part.part_number,
            description=part.description,
            producer=part.producer,
            commodity=part.commodity,
            kelas=part.kelas,
            rtt_qty=level.rtt_qty if level else None,
            tbd_qty=level.tbd_qty if level else None,
            total_qty=level.total_qty if level else None,
            min_qty=float(level.min_qty) if level else None,
            max_qty=float(level.max_qty) if level else None,
            status=level.status if level else None,
            snapshot_date=str(level.snapshot_date) if level else None,
        )
        items.append(item)

    pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedParts(items=items, total=total, page=page, limit=limit, pages=pages)


@router.get("/{part_number}", response_model=PartResponse)
async def get_part(
    part_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    site = current_user.site

    result = await db.execute(
        select(Part).where(Part.part_number == part_number, Part.is_active == True)
    )
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part tidak ditemukan")

    latest_date = await _get_latest_date(db, site)
    current_stock = None

    if latest_date:
        sl_result = await db.execute(
            select(StockLevel).where(
                StockLevel.part_id == part.id,
                StockLevel.site == site,
                StockLevel.snapshot_date == latest_date,
            )
        )
        level = sl_result.scalar_one_or_none()
        if level:
            current_stock = StockInfo(
                rtt_qty=level.rtt_qty,
                tbd_qty=level.tbd_qty,
                total_qty=level.total_qty,
                min_qty=float(level.min_qty),
                max_qty=float(level.max_qty),
                status=level.status,
                snapshot_date=str(level.snapshot_date),
            )

    return PartResponse(
        id=part.id,
        part_number=part.part_number,
        description=part.description,
        producer=part.producer,
        commodity=part.commodity,
        kelas=part.kelas,
        is_active=part.is_active,
        current_stock=current_stock,
        created_at=part.created_at,
        updated_at=part.updated_at,
    )


@router.get("/{part_number}/history", response_model=list[StockHistoryItem])
async def get_part_history(
    part_number: str,
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Part).where(Part.part_number == part_number, Part.is_active == True)
    )
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part tidak ditemukan")

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
