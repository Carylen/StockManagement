import os
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import Principal
from app.utils.permissions import require_permission
from app.utils.scoping import has_all_sites
from app.services.admin_stock_service import validate_admin_stock_upload, process_admin_stock_upload

router = APIRouter(prefix="/upload/admin-stock", tags=["admin-stock-upload"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def _check_extension(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_EXTENSIONS


def _resolve_upload_site(principal: Principal, site: str | None) -> str:
    """Normal admins always upload for their own site. Only an all-sites
    principal (e.g. super_admin) may target another site, and must say
    which one explicitly — there's no implicit 'own site' for them."""
    if has_all_sites(principal):
        if not site:
            raise HTTPException(status_code=400, detail="Parameter 'site' wajib diisi untuk akun all-sites")
        return site.upper()
    return principal.site


@router.post("/validate")
async def validate_admin_stock(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_admin_stock")),
):
    """Dry-run: parse file, cross-reference with master KPP (Class V, active),
    return per-row rejection reasons + accepted preview without saving."""
    if not _check_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are accepted")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    parse_result, preview = await validate_admin_stock_upload(file_bytes, file.filename or "upload.xlsx", db)

    if parse_result.has_errors:
        raise HTTPException(status_code=422, detail=parse_result.errors[0]["reason"])

    return {
        "filename": file.filename,
        "total_rows": preview.total_rows,
        "accepted_rows": preview.accepted_rows,
        "rejected_rows": preview.rejected_rows,
        "preview": preview.preview,
        "rejected_detail": [
            {"row": r.row, "part_number": r.part_number, "reason": r.reason} for r in preview.rejected_detail
        ],
    }


@router.post("/publish")
async def publish_admin_stock(
    file: UploadFile = File(...),
    site: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_admin_stock")),
):
    """Full upload: parse → resolve (Class V, active) → upsert per (part_number, site) → log."""
    if not _check_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are accepted")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    target_site = _resolve_upload_site(principal, site)

    summary = await process_admin_stock_upload(
        file_bytes=file_bytes,
        filename=file.filename or "upload.xlsx",
        site=target_site,
        uploader_id=principal.id,
        db=db,
    )

    return {
        "log_id": summary.log_id,
        "site": summary.site,
        "total_rows": summary.total_rows,
        "rows_processed": summary.rows_processed,
        "rows_skipped": summary.rows_skipped,
        "rejected_detail": [
            {"row": r.row, "part_number": r.part_number, "reason": r.reason} for r in summary.rejected_detail
        ],
    }
