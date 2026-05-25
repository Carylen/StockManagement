import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.core.database import get_db
from app.core.auth import require_user_role
from app.models.employee import Employee
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    PaginatedEmployees, BulkUploadResult,
)
from app.services.employee_parser import parse_employee_excel

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=PaginatedEmployees)
async def list_employees(
    search: Optional[str] = None,
    role: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    principal=Depends(require_user_role("admin")),
):
    query = (
        select(Employee)
        .where(Employee.site == principal.site)
        .order_by(Employee.name)
    )
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(Employee.nrp.ilike(term), Employee.name.ilike(term))
        )
    if role:
        query = query.where(Employee.role == role)

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
    principal=Depends(require_user_role("admin")),
):
    nrp = data.nrp.strip().upper()
    existing = await db.execute(
        select(Employee).where(Employee.nrp == nrp, Employee.site == principal.site)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"NRP {nrp} sudah terdaftar di site ini")

    emp = Employee(
        nrp=nrp,
        name=data.name.strip(),
        site=principal.site,
        role=data.role,
        shift=data.shift,
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
    principal=Depends(require_user_role("admin")),
):
    result = await db.execute(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.site == principal.site,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")

    if data.name is not None:
        emp.name = data.name.strip()
    if data.role is not None:
        emp.role = data.role
    if data.shift is not None:
        emp.shift = data.shift if data.shift != "" else None
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
    principal=Depends(require_user_role("admin")),
):
    result = await db.execute(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.site == principal.site,
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
    principal=Depends(require_user_role("admin")),
):
    content = await file.read()
    parsed = parse_employee_excel(content)

    if parsed["error"]:
        raise HTTPException(status_code=422, detail=parsed["error"])

    inserted = 0
    updated = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for row in parsed["rows"]:
        nrp = row["nrp"]
        existing = await db.execute(
            select(Employee).where(Employee.nrp == nrp, Employee.site == principal.site)
        )
        emp = existing.scalar_one_or_none()

        if emp is None:
            emp = Employee(
                nrp=nrp,
                name=row["name"],
                site=principal.site,
                role=row["role"],
                shift=row["shift"],
                is_active=True,
            )
            db.add(emp)
            inserted += 1
        else:
            emp.name = row["name"]
            emp.role = row["role"]
            emp.shift = row["shift"]
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
