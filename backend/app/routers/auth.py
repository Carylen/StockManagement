import asyncio
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import bcrypt
from app.core.database import get_db
from app.core.auth import create_access_token, get_current_user, get_current_principal, Principal, _ROLE_NORM
from app.core.config import settings
from app.utils.permissions import get_permissions_for_role
from app.models.user import User
from app.models.site import Site
from app.models.permission import SupplierSite
from app.schemas.auth import (
    LoginRequest, NRPLoginRequest, ChangePasswordRequest,
    TokenResponse, UserInfo, EmployeeInfo,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def verify_password(plain: str, hashed: str) -> bool:
    return await asyncio.to_thread(bcrypt.checkpw, plain.encode("utf-8"), hashed.encode("utf-8"))


async def hash_password(plain: str) -> str:
    hashed = await asyncio.to_thread(bcrypt.hashpw, plain.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Email + password login for admin / supplier / super_admin."""
    result = await db.execute(
        select(User).where(User.email == data.email, User.auth_method == "password")
    )
    user = result.scalar_one_or_none()
    if not user or not user.password or not await verify_password(data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact your site admin.",
        )
    permissions = await get_permissions_for_role(db, user.role)
    token = create_access_token(
        {
            "sub": user.id,
            "role": user.role,
            "site": user.site,
            "name": user.name,
            "principal_type": "user",
            "permissions": permissions,
        },
        expires_delta=timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS),
    )
    return TokenResponse(
        access_token=token,
        user=UserInfo(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            site=user.site,
        ),
    )


@router.post("/login-nrp", response_model=TokenResponse)
async def login_nrp(data: NRPLoginRequest, db: AsyncSession = Depends(get_db)):
    """NRP-based login for plant workers (no password required)."""
    result = await db.execute(
        select(User).where(
            User.nrp == data.nrp.upper(),
            User.auth_method == "nrp",
            User.is_active == True,
        )
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NRP not found or employee is inactive, contact your site admin.",
        )
    normalized_role = _ROLE_NORM.get((employee.role or "").lower(), employee.role or "user")
    permissions = await get_permissions_for_role(db, normalized_role)
    token = create_access_token(
        {
            "sub": employee.id,
            "role": normalized_role,
            "site": employee.site,
            "name": employee.name,
            "permissions": permissions,
        },
        expires_delta=timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS),
    )
    return TokenResponse(
        access_token=token,
        employee=EmployeeInfo(
            id=employee.id,
            name=employee.name,
            nrp=employee.nrp or "",
            role=normalized_role,
            site=employee.site,
        ),
    )


@router.post("/change-password", status_code=204)
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
):
    """Change password for password-based accounts (admin / supplier / super_admin)."""
    if principal.auth_method != "password":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change is only available for password-based accounts",
        )
    result = await db.execute(select(User).where(User.id == principal.id))
    user = result.scalar_one_or_none()
    if not user or not await verify_password(data.old_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must be at least 8 characters",
        )
    from datetime import datetime, timezone
    user.password = await hash_password(data.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    await db.flush()


@router.get("/me/sites")
async def me_sites(
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
):
    """Return accessible sites for the current user.

    - supplier      → only sites assigned via tb_t_supplier_sites
    - can_view_all_sites (non-supplier) → all active sites
    - own-site principal → their own site
    """
    if principal.role == "supplier":
        result = await db.execute(
            select(SupplierSite.site_code, Site.name)
            .join(Site, Site.code == SupplierSite.site_code)
            .where(SupplierSite.supplier_id == principal.id, Site.is_active == True)
            .order_by(SupplierSite.site_code)
        )
        return [{"code": r.site_code, "name": r.name} for r in result.all()]

    if "can_view_all_sites" in principal.permissions:
        result = await db.execute(
            select(Site).where(Site.is_active == True).order_by(Site.code)
        )
        return [{"code": s.code, "name": s.name} for s in result.scalars()]

    if principal.site:
        result = await db.execute(
            select(Site).where(Site.code == principal.site, Site.is_active == True)
        )
        site = result.scalar_one_or_none()
        if site:
            return [{"code": site.code, "name": site.name}]
    return []


@router.get("/me")
async def me(principal: Principal = Depends(get_current_principal)):
    if principal.auth_method == "nrp":
        return EmployeeInfo(
            id=principal.id,
            name=principal.name,
            nrp=principal.nrp or "",
            role=principal.role,
            site=principal.site,
        )
    return UserInfo(
        id=principal.id,
        name=principal.name,
        email=principal.email or "",
        role=principal.role,
        site=principal.site,
    )
