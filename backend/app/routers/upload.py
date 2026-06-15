import asyncio
import math
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import Principal
from app.utils.permissions import require_permission
from app.models.upload_log import UploadLog
from app.models.ut_stock import UTUploadLog
from app.services.ut_stock_service import validate_ut_stock_upload, process_ut_stock_upload

router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def _check_extension(filename: str) -> bool:
    import os
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_EXTENSIONS


@router.post("/validate")
async def validate_upload():
    """Deprecated — readiness kini diupload oleh UT/Supplier via /upload/ut-stock/validate."""
    raise HTTPException(
        status_code=410,
        detail="Endpoint deprecated. Readiness kini diupload oleh UT/Supplier via POST /upload/ut-stock/validate.",
    )


@router.post("/publish")
async def publish_upload():
    """Deprecated — readiness kini diupload oleh UT/Supplier via /upload/ut-stock/publish."""
    raise HTTPException(
        status_code=410,
        detail="Endpoint deprecated. Readiness kini diupload oleh UT/Supplier via POST /upload/ut-stock/publish.",
    )


@router.get("/logs")
async def list_upload_logs(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_upload_readiness")),
):
    from app.models.user import User

    count_result = await db.execute(select(func.count(UploadLog.id)))
    total = count_result.scalar_one() or 0

    result = await db.execute(
        select(UploadLog, User)
        .join(User, User.id == UploadLog.uploaded_by)
        .order_by(UploadLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = result.all()

    return {
        "items": [
            {
                "id": log.id,
                "filename": log.filename,
                "uploaded_by": log.uploaded_by,
                "uploader_name": user.name if user else None,
                "rows_total": log.rows_total,
                "rows_processed": log.rows_processed,
                "rows_skipped": log.rows_skipped,
                "rows_error": log.rows_error,
                "status": log.status,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log, user in rows
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if total > 0 else 1,
    }


# ---------------------------------------------------------------------------
# UT Stock upload endpoints (for UT/Supplier role)
# ---------------------------------------------------------------------------

@router.post("/ut-stock/validate")
async def validate_ut_stock(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_readiness")),
):
    """Dry-run: parse file, cross-reference with master KPP, return preview without saving."""
    if not _check_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are accepted")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    parse_result, preview = await validate_ut_stock_upload(
        file_bytes, file.filename or "upload.xlsx", db
    )

    if parse_result.has_errors:
        raise HTTPException(status_code=422, detail=parse_result.errors[0]["reason"])

    return {
        "filename": file.filename,
        "total_rows": preview.total_rows,
        "matched_rows": preview.matched_rows,
        "skipped_rows": preview.skipped_rows,
        "sites_affected": preview.sites_affected,
        "warnings": preview.warnings,
        "preview": preview.preview,
    }


@router.post("/ut-stock/publish")
async def publish_ut_stock(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_readiness")),
):
    """Full upload: parse → resolve → replace existing stock data → save log."""
    if not _check_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are accepted")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    summary = await process_ut_stock_upload(
        file_bytes=file_bytes,
        filename=file.filename or "upload.xlsx",
        uploader_id=principal.id,
        db=db,
    )

    return {
        "batch_id": summary.batch_id,
        "total_rows": summary.total_rows,
        "matched_rows": summary.matched_rows,
        "skipped_rows": summary.skipped_rows,
        "sites_affected": summary.sites_affected,
        "warnings": summary.warnings,
    }


@router.get("/ut-stock/logs")
async def list_ut_stock_logs(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_upload_readiness")),
):
    """List UT stock upload history, newest first."""
    from app.models.user import User

    count_result = await db.execute(select(func.count(UTUploadLog.id)))
    total = count_result.scalar_one() or 0

    result = await db.execute(
        select(UTUploadLog, User)
        .join(User, User.id == UTUploadLog.uploaded_by, isouter=True)
        .order_by(UTUploadLog.uploaded_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = result.all()

    return {
        "items": [
            {
                "id": log.id,
                "batch_id": log.batch_id,
                "filename": log.filename,
                "uploaded_by": log.uploaded_by,
                "uploader_name": user.name if user else None,
                "total_rows": log.total_rows,
                "matched_rows": log.matched_rows,
                "skipped_rows": log.skipped_rows,
                "sites_affected": log.sites_affected,
                "uploaded_at": log.uploaded_at.isoformat() if log.uploaded_at else None,
            }
            for log, user in rows
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if total > 0 else 1,
    }


# ---------------------------------------------------------------------------
# Existing readiness upload log endpoints (admin)
# ---------------------------------------------------------------------------

@router.get("/logs/{log_id}")
async def get_upload_log(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_upload_readiness")),
):
    from app.models.user import User

    result = await db.execute(
        select(UploadLog, User)
        .join(User, User.id == UploadLog.uploaded_by)
        .where(UploadLog.id == log_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Log not found")

    log, user = row
    return {
        "id": log.id,
        "filename": log.filename,
        "uploaded_by": log.uploaded_by,
        "uploader_name": user.name if user else None,
        "rows_total": log.rows_total,
        "rows_processed": log.rows_processed,
        "rows_skipped": log.rows_skipped,
        "rows_error": log.rows_error,
        "error_detail": log.error_detail,
        "status": log.status,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }
