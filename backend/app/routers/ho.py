"""
HO (Head Office) management router.

All endpoints require elevated permissions — typically super_admin.

Prefix: /v1/ho
"""
import asyncio
import bcrypt
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.database import get_db
from app.core.auth import Principal
from app.core.rbac import ALL_ROLES
from app.utils.permissions import require_permission
from app.models.user import User
from app.models.site import Site
from app.models.permission import Permission, RolePermission, SupplierSite
from app.services.email import send_supplier_site_assigned

router = APIRouter(prefix="/ho", tags=["ho"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class UserCreateHO(BaseModel):
    name: str
    email: str
    password: str
    role: str
    site: str


class UserUpdateHO(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    site: Optional[str] = None
    is_active: Optional[bool] = None


class SiteCreate(BaseModel):
    code: str
    name: str


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class RolePermissionsUpdate(BaseModel):
    permissions: list[str]


class SupplierSiteAssign(BaseModel):
    site_code: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _user_out(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "site": u.site,
        "auth_method": u.auth_method,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def _site_out(s: Site) -> dict:
    return {"code": s.code, "name": s.name, "is_active": s.is_active}


# ── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
async def ho_list_users(
    role: Optional[str] = None,
    site: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_all_users")),
):
    query = select(User).where(User.auth_method == "password").order_by(User.role, User.name)
    if role:
        query = query.where(User.role == role)
    if site:
        query = query.where(User.site == site)
    result = await db.execute(query)
    return [_user_out(u) for u in result.scalars().all()]


@router.post("/users", status_code=201)
async def ho_create_user(
    data: UserCreateHO,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_manage_all_users")),
):
    if data.role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Valid: {ALL_ROLES}")
    existing = await db.execute(
        select(User).where(User.email == data.email, User.auth_method == "password")
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        name=data.name,
        email=data.email,
        password=_hash(data.password),
        auth_method="password",
        role=data.role,
        site=data.site,
        created_by=principal.id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return _user_out(user)


@router.get("/users/{user_id}")
async def ho_get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_all_users")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_out(user)


@router.patch("/users/{user_id}")
async def ho_update_user(
    user_id: str,
    data: UserUpdateHO,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_manage_all_users")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == principal.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own account via HO")
    if data.name is not None:
        user.name = data.name
    if data.role is not None:
        if data.role not in ALL_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role. Valid: {ALL_ROLES}")
        user.role = data.role
    if data.site is not None:
        user.site = data.site
    if data.is_active is not None:
        user.is_active = data.is_active
    user.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(user)
    return _user_out(user)


@router.delete("/users/{user_id}", status_code=204)
async def ho_delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_manage_all_users")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == principal.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.is_active = False
    user.updated_at = datetime.now(timezone.utc)
    await db.flush()


# ── Sites ────────────────────────────────────────────────────────────────────

@router.get("/sites")
async def ho_list_sites(
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_sites")),
):
    result = await db.execute(select(Site).order_by(Site.code))
    return [_site_out(s) for s in result.scalars().all()]


@router.post("/sites", status_code=201)
async def ho_create_site(
    data: SiteCreate,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_sites")),
):
    code = data.code.strip().upper()
    existing = await db.execute(select(Site).where(Site.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Site {code} already exists")
    site = Site(code=code, name=data.name.strip(), is_active=True)
    db.add(site)
    await db.flush()
    await db.refresh(site)
    return _site_out(site)


@router.patch("/sites/{code}")
async def ho_update_site(
    code: str,
    data: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_sites")),
):
    result = await db.execute(select(Site).where(Site.code == code.upper()))
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    if data.name is not None:
        site.name = data.name.strip()
    if data.is_active is not None:
        site.is_active = data.is_active
    await db.flush()
    await db.refresh(site)
    return _site_out(site)


@router.delete("/sites/{code}", status_code=204)
async def ho_delete_site(
    code: str,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_sites")),
):
    result = await db.execute(select(Site).where(Site.code == code.upper()))
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    site.is_active = False
    await db.flush()


# ── Roles & Permissions ───────────────────────────────────────────────────────

@router.get("/permissions")
async def ho_list_permissions(
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_roles")),
):
    result = await db.execute(
        select(Permission).order_by(Permission.group_name, Permission.code)
    )
    perms = result.scalars().all()
    return [
        {"code": p.code, "label": p.label, "group_name": p.group_name, "description": p.description}
        for p in perms
    ]


@router.get("/roles")
async def ho_list_roles(
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_roles")),
):
    result = await db.execute(select(RolePermission).order_by(RolePermission.role))
    rows = result.scalars().all()
    role_map: dict[str, list[str]] = {}
    for rp in rows:
        role_map.setdefault(rp.role, []).append(rp.permission)
    return [{"role": role, "permissions": perms} for role, perms in sorted(role_map.items())]


@router.put("/roles/{role}/permissions")
async def ho_update_role_permissions(
    role: str,
    data: RolePermissionsUpdate,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_roles")),
):
    if role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail=f"Unknown role: {role}. Valid: {ALL_ROLES}")

    # Validate all requested permission codes exist
    if data.permissions:
        existing_result = await db.execute(
            select(Permission.code).where(Permission.code.in_(data.permissions))
        )
        existing_codes = {r.code for r in existing_result.all()}
        unknown = set(data.permissions) - existing_codes
        if unknown:
            raise HTTPException(status_code=400, detail=f"Unknown permission codes: {sorted(unknown)}")

    # Replace all permissions for this role atomically
    await db.execute(delete(RolePermission).where(RolePermission.role == role))
    for perm_code in data.permissions:
        db.add(RolePermission(role=role, permission=perm_code))
    await db.flush()

    return {"role": role, "permissions": data.permissions}


# ── Suppliers ─────────────────────────────────────────────────────────────────

@router.get("/suppliers")
async def ho_list_suppliers(
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_suppliers")),
):
    result = await db.execute(
        select(User)
        .where(User.role == "supplier", User.auth_method == "password")
        .order_by(User.name)
    )
    suppliers = result.scalars().all()

    # Fetch all site assignments in one query
    ids = [s.id for s in suppliers]
    site_result = await db.execute(
        select(SupplierSite).where(SupplierSite.supplier_id.in_(ids))
    )
    site_rows = site_result.scalars().all()
    sites_by_supplier: dict[str, list[str]] = {}
    for row in site_rows:
        sites_by_supplier.setdefault(row.supplier_id, []).append(row.site_code)

    return [
        {**_user_out(s), "assigned_sites": sites_by_supplier.get(s.id, [])}
        for s in suppliers
    ]


@router.get("/suppliers/{supplier_id}/sites")
async def ho_get_supplier_sites(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_assign_supplier")),
):
    supplier = (await db.execute(
        select(User).where(User.id == supplier_id, User.role == "supplier")
    )).scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    result = await db.execute(
        select(SupplierSite).where(SupplierSite.supplier_id == supplier_id)
    )
    rows = result.scalars().all()
    return [{"site_code": r.site_code, "assigned_at": r.assigned_at.isoformat()} for r in rows]


@router.post("/suppliers/{supplier_id}/sites", status_code=201)
async def ho_assign_supplier_site(
    supplier_id: str,
    data: SupplierSiteAssign,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_assign_supplier")),
):
    supplier = (await db.execute(
        select(User).where(User.id == supplier_id, User.role == "supplier")
    )).scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    site_code = data.site_code.strip().upper()
    site = (await db.execute(select(Site).where(Site.code == site_code))).scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site {site_code} not found")

    existing = (await db.execute(
        select(SupplierSite).where(
            SupplierSite.supplier_id == supplier_id,
            SupplierSite.site_code == site_code,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Supplier already assigned to {site_code}")

    assignment = SupplierSite(
        supplier_id=supplier_id,
        site_code=site_code,
        assigned_by=principal.id,
    )
    db.add(assignment)
    await db.flush()

    # Fire-and-forget email — does not block or raise on failure
    asyncio.create_task(
        send_supplier_site_assigned(
            supplier_email=supplier.email,
            supplier_name=supplier.name,
            site_code=site_code,
            site_name=site.name,
        )
    )

    return {"supplier_id": supplier_id, "site_code": site_code}


@router.delete("/suppliers/{supplier_id}/sites/{site_code}", status_code=204)
async def ho_unassign_supplier_site(
    supplier_id: str,
    site_code: str,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_assign_supplier")),
):
    result = await db.execute(
        select(SupplierSite).where(
            SupplierSite.supplier_id == supplier_id,
            SupplierSite.site_code == site_code.upper(),
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(row)
    await db.flush()
