from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import get_current_principal
from app.models.site import Site

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("")
async def list_sites(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_principal),
):
    """Return all active sites. Used by supplier readiness filter and other site pickers."""
    result = await db.execute(
        select(Site).where(Site.is_active == True).order_by(Site.code)
    )
    sites = result.scalars().all()
    return [{"code": s.code, "name": s.name} for s in sites]
