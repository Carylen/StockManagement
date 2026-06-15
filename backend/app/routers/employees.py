import asyncio
import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.core.database import get_db
from app.core.auth import Principal
from app.utils.permissions import require_permission
from app.models.user import User
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    EmployeeSummary, PaginatedEmployees, BulkUploadResult,
)
from app.services.employee_parser import parse_employee_excel

router = APIRouter(prefix="/employees", tags=["employees"])

# "Employees" are unified-identity accounts that authenticate via NRP.
NRP_AUTH = User.auth_method == "nrp"


@router.get("/summary", response_model=EmployeeSummary)
async def get_employee_summary(
    db: AsyncSession = Depends(get_db),
    principal=Depends(require_permission("can_manage_employees")),
):
    site = principal.site

    total_result = await db.execute(
        select(func.count(User.id)).where(NRP_AUTH, User.site == site)
    )
    total = total_result.scalar_one() or 0

    active_result = await db.execute(
        select(func.count(User.id)).where(NRP_AUTH, User.site == site, User.is_active == True)
    )
    active = active_result.scalar_one() or 0

    dept_head_result = await db.execute(
        select(func.count(User.id)).where(
            NRP_AUTH,
            User.site == site,
            User.position == "dept_head",
        )
    )
    dept_head_count = dept_head_result.scalar_one() or 0

    return EmployeeSummary(
        total=total,
        active=active,
        inactive=total - active,
        dept_head_count=dept_head_count,
    )


@router.get("", response_model=PaginatedEmployees)
async def list_employees(
    search: Optional[str] = None,
    role: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    principal=Depends(require_permission("can_manage_employees")),
):
    query = (
        select(User)
        .where(NRP_AUTH, User.site == principal.site)
        .order_by(User.name)
    )
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(User.nrp.ilike(term), User.name.ilike(term))
        )
    if role:
        query = query.where(User.role == role)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    employees = result.scalars().all()

    return PaginatedEmployees(
        items=[EmployeeResponse.model_validate(e) for e in employees],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if limit > 0 else 0,
    )


@router.post("", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    data: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    principal=Depends(require_permission("can_manage_employees")),
):
    nrp = data.nrp.strip().upper()
    existing = await db.execute(
        select(User).where(NRP_AUTH, User.nrp == nrp, User.site == principal.site)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"NRP {nrp} sudah terdaftar di site ini")

    emp = User(
        auth_method="nrp",
        nrp=nrp,
        name=data.name.strip(),
        site=principal.site,
        role=data.role,
        position=data.position,
    )
    db.add(emp)
    await db.flush()
    await db.refresh(emp)
    return EmployeeResponse.model_validate(emp)


@router.patch("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    principal=Depends(require_permission("can_manage_employees")),
):
    result = await db.execute(
        select(User).where(
            NRP_AUTH,
            User.id == employee_id,
            User.site == principal.site,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")

    if data.name is not None:
        emp.name = data.name.strip()
    if data.role is not None:
        emp.role = data.role
    if data.position is not None:
        emp.position = data.position
    if data.is_active is not None:
        emp.is_active = data.is_active

    emp.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(emp)
    return EmployeeResponse.model_validate(emp)


@router.delete("/{employee_id}", status_code=204)
async def deactivate_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    principal=Depends(require_permission("can_manage_employees")),
):
    result = await db.execute(
        select(User).where(
            NRP_AUTH,
            User.id == employee_id,
            User.site == principal.site,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")
    emp.is_active = False
    emp.updated_at = datetime.now(timezone.utc)
    await db.flush()


@router.post("/bulk-upload", response_model=BulkUploadResult)
async def bulk_upload_employees(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    principal=Depends(require_permission("can_manage_employees")),
):
    content = await file.read()
    parsed = await asyncio.to_thread(parse_employee_excel, content)

    if parsed["error"]:
        raise HTTPException(status_code=422, detail=parsed["error"])

    inserted = 0
    updated = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for row in parsed["rows"]:
        nrp = row["nrp"]
        existing = await db.execute(
            select(User).where(NRP_AUTH, User.nrp == nrp, User.site == principal.site)
        )
        emp = existing.scalar_one_or_none()

        if emp is None:
            emp = User(
                auth_method="nrp",
                nrp=nrp,
                name=row["name"],
                site=principal.site,
                role=row["role"],
                position=row.get("position"),
                is_active=True,
            )
            db.add(emp)
            inserted += 1
        else:
            emp.name = row["name"]
            emp.role = row["role"]
            emp.position = row.get("position")
            emp.is_active = True
            emp.updated_at = now
            updated += 1

    await db.flush()

    return BulkUploadResult(
        inserted=inserted,
        updated=updated,
        skipped=skipped,
        errors=parsed["parse_errors"],
    )
