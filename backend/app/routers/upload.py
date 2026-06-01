import asyncio
import math
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import require_user_role, Principal
from app.models.stock import StockLevel
from app.models.upload_log import UploadLog
from app.services.csv_parser import parse_readiness_file

router = APIRouter(prefix="/upload", tags=["upload"])

# In-memory session store: { session_id: { "rows": [...], "filename": str, "user_id": str, "errors": [...] } }
_validation_sessions: dict = {}

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def _check_extension(filename: str) -> bool:
    import os
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_EXTENSIONS


class PublishRequest(BaseModel):
    session_id: str


@router.post("/validate")
async def validate_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_user_role("admin")),
):
    """Validate readiness CSV/XLSX. Site is taken from the uploading admin's site."""
    if not _check_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are accepted")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    result = await asyncio.to_thread(parse_readiness_file, file_bytes, file.filename or "upload.xlsx")

    session_id = str(uuid.uuid4())
    _validation_sessions[session_id] = {
        "rows": result.rows,
        "filename": file.filename,
        "user_id": principal.id,
        "site": principal.site,
        "errors": result.errors,
        "skipped": result.skipped,
    }

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows_total": result.total,
        "rows_valid": result.processed,
        "rows_error": result.error_count,
        "rows_skipped": result.skipped,
        "error_detail": result.errors[:10],
        "skipped_detail": [],
        "preview": result.rows[:20],
    }


@router.post("/publish")
async def publish_upload(
    data: PublishRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_user_role("admin")),
):
    """Commit validated session to database. REPLACES all stock_levels for this site."""
    session = _validation_sessions.get(data.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or has expired")
    if session["user_id"] != principal.id:
        raise HTTPException(status_code=403, detail="Session does not belong to you")

    rows = session["rows"]
    filename = session["filename"]
    site = session["site"]
    errors = list(session.get("errors", []))
    skipped = session.get("skipped", 0)

    now = datetime.now(timezone.utc)
    rows_processed = 0

    try:
        # REPLACE: delete all existing stock levels for this site
        await db.execute(delete(StockLevel).where(StockLevel.site == site))

        # Insert new rows from the validated session
        for row in rows:
            try:
                level = StockLevel(
                    part_number=row["part_number"],
                    site=site,
                    description=row.get("description"),
                    commodity=row.get("commodity"),
                    min_qty=row["min_qty"],
                    max_qty=row["max_qty"],
                    rtt_qty=row["rtt_qty"],
                    tbd_qty=row["tbd_qty"],
                    estimated_date=row.get("estimated_date"),
                    status=row["status"],
                    updated_at=now,
                )
                db.add(level)
                rows_processed += 1
            except Exception as e:
                errors.append({"row": 0, "reason": str(e)})
    except Exception as e:
        errors.append({"row": 0, "reason": f"Delete failed: {str(e)}"})

    rows_error = len(errors)
    upload_status = "success" if rows_error == 0 else ("partial" if rows_processed > 0 else "failed")

    log = UploadLog(
        filename=filename,
        uploaded_by=principal.id,
        rows_total=len(rows) + skipped + rows_error,
        rows_processed=rows_processed,
        rows_skipped=skipped,
        rows_error=rows_error,
        error_detail={"errors": errors[:50]} if errors else None,
        status=upload_status,
        created_at=now,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)

    del _validation_sessions[data.session_id]

    return {
        "status": upload_status,
        "rows_processed": rows_processed,
        "rows_error": rows_error,
        "rows_skipped": skipped,
        "log_id": log.id,
    }


@router.get("/logs")
async def list_upload_logs(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_user_role("admin")),
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


@router.get("/logs/{log_id}")
async def get_upload_log(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_user_role("admin")),
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
