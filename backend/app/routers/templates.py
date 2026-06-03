"""
Download template XLSX endpoints.

GET /templates/readiness  → template upload readiness harian (admin only)
GET /templates/master     → template master Class V/G (admin only)
GET /templates/employees  → template bulk karyawan (admin only)
"""
import asyncio
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.core.auth import Principal
from app.utils.permissions import require_permission
from app.services.excel_templates import (
    XLSX_MIME,
    build_employees,
    build_master,
    build_readiness,
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/readiness")
async def download_readiness_template(
    principal: Principal = Depends(require_permission("can_upload_readiness")),
):
    try:
        data = await asyncio.to_thread(build_readiness, principal.site)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    site_tag = f"_{principal.site}" if principal.site else ""
    return StreamingResponse(
        io.BytesIO(data),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f"attachment; filename=template_readiness{site_tag}.xlsx"},
    )


@router.get("/master")
async def download_master_template(
    _: Principal = Depends(require_permission("can_manage_master")),
):
    try:
        data = await asyncio.to_thread(build_master)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return StreamingResponse(
        io.BytesIO(data),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": "attachment; filename=template_master_class_vg.xlsx"},
    )


@router.get("/employees")
async def download_employees_template(
    _: Principal = Depends(require_permission("can_manage_employees")),
):
    try:
        data = await asyncio.to_thread(build_employees)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return StreamingResponse(
        io.BytesIO(data),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": "attachment; filename=template_karyawan.xlsx"},
    )
