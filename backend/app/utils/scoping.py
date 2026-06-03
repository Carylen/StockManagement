"""Site-scoping helpers + composed permission dependencies.

Centralizes the "which site(s) can this principal see" logic so routers don't
repeat `role == 'supplier'` checks. Scope is driven purely by permissions.
"""
from typing import Optional

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import Principal, get_current_principal
from app.utils.permissions import require_any_permission

# ── Composed permission dependencies (reuse across routers) ─────────────
# Anyone who can see site/stock data (own site OR all sites).
require_view_sites = require_any_permission("can_view_own_site", "can_view_all_sites")
# Anyone who can see inquiries (their team's OR everyone's).
require_view_inquiries = require_any_permission("can_view_team_inquiry", "can_view_all_inquiries")


def has_all_sites(principal: Principal) -> bool:
    return "can_view_all_sites" in principal.permissions


def resolve_site(principal: Principal, requested: Optional[str]) -> Optional[str]:
    """Resolve the concrete site to scope a query to, or None for 'all sites'.

    - all-sites principals (can_view_all_sites): honor ?site; None when omitted
      or 'ALL' (meaning: don't filter by site).
    - own-site principals: always pinned to their own site (?site ignored).
    """
    if has_all_sites(principal):
        if requested and requested.upper() != "ALL":
            return requested.upper()
        return None
    return principal.site


async def maybe_supplier_sites(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[str] | None:
    """For suppliers: returns their assigned site codes (may be empty list).
    For all other roles: returns None (caller applies normal resolve_site logic).
    """
    if principal.role != "supplier":
        return None
    from app.models.permission import SupplierSite
    result = await db.execute(
        select(SupplierSite.site_code).where(SupplierSite.supplier_id == principal.id)
    )
    return [row.site_code for row in result.all()]


async def get_supplier_sites(
    principal: Principal = Depends(require_any_permission("can_view_all_sites")),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """Return site codes accessible to the current principal.

    - Suppliers: only sites explicitly assigned in tb_t_supplier_sites.
    - Other all-sites principals (super_admin): all sites (empty list = unrestricted).
    """
    from app.models.permission import SupplierSite

    if principal.role != "supplier":
        return []  # empty = unrestricted (caller interprets as "all")

    result = await db.execute(
        select(SupplierSite.site_code).where(SupplierSite.supplier_id == principal.id)
    )
    return [row.site_code for row in result.all()]
