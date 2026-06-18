"""Permission utilities — DB lookup + FastAPI dependency guards.

These guards work for *both* principal types (user and employee), because
effective permissions are carried on the JWT and surfaced via
``get_current_principal`` (see app/core/auth.py).
"""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal, get_current_principal
from app.models.permission import RolePermission
from app.models.user_permission_override import UserPermissionOverride


async def get_permissions_for_role(db: AsyncSession, role: str) -> list[str]:
    """Return the permission codes granted to a role (from tb_m_role_permissions)."""
    result = await db.execute(
        select(RolePermission.permission).where(RolePermission.role == role)
    )
    return list(result.scalars().all())


async def resolve_effective_permissions(db: AsyncSession, user_id: str, role: str) -> list[str]:
    """THE single source of truth for a user's effective permissions.

    effective = role permissions
              ∪ active ALLOW overrides
              − active DENY  overrides        (DENY wins over ALLOW and over role)

    An override is active while expires_at IS NULL or in the future — so expiry
    needs no cron, it is simply ignored here. Computed-on-read: callers get the
    current truth without any cache to invalidate (role/override edits take
    effect on the next request).
    """
    role_perms = set(await get_permissions_for_role(db, role))
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(UserPermissionOverride.permission_code, UserPermissionOverride.effect).where(
            UserPermissionOverride.user_id == user_id,
            or_(
                UserPermissionOverride.expires_at.is_(None),
                UserPermissionOverride.expires_at > now,
            ),
        )
    )
    allow: set[str] = set()
    deny: set[str] = set()
    for code, effect in res.all():
        (allow if effect == "ALLOW" else deny).add(code)
    return sorted((role_perms | allow) - deny)


def _denied(detail_msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "PERMISSION_DENIED", "message": detail_msg},
    )


def require_permission(permission: str):
    """FastAPI dependency — require the principal to hold a specific permission."""
    async def checker(principal: Principal = Depends(get_current_principal)) -> Principal:
        if permission not in principal.permissions:
            raise _denied(f"Required permission: {permission}")
        return principal

    return checker


def require_any_permission(*permissions: str):
    """Require the principal to hold at least one of the given permissions."""
    async def checker(principal: Principal = Depends(get_current_principal)) -> Principal:
        if not any(p in principal.permissions for p in permissions):
            raise _denied(f"Required any of: {', '.join(permissions)}")
        return principal

    return checker


def require_all_permissions(*permissions: str):
    """Require the principal to hold every one of the given permissions."""
    async def checker(principal: Principal = Depends(get_current_principal)) -> Principal:
        missing = [p for p in permissions if p not in principal.permissions]
        if missing:
            raise _denied(f"Missing permissions: {', '.join(missing)}")
        return principal

    return checker
