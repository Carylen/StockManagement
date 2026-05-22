import io
import uuid
import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import require_role, get_current_user
from app.models.user import User
from app.models.part import Part
from app.models.stock import StockLevel, StockHistory
from app.models.upload_log import UploadLog
from app.services.csv_parser import parse_ut_file

router = APIRouter(prefix="/upload", tags=["upload"])

# In-memory session store for validation previews
# { session_id: { "rows": [...], "filename": str, "user_id": str, "errors": [...] } }
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
    current_user: User = Depends(require_role("admin")),
):
    """
    Step 1: Validate uploaded CSV/XLSX file.
    Returns session_id + preview of rows with errors.
    """
    if not _check_extension(file.filename or ""):
        raise HTTPException(
            status_code=400,
            detail="Hanya file CSV atau XLSX yang diizinkan",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File kosong")

    result = parse_ut_file(file_bytes, file.filename or "upload.xlsx")

    session_id = str(uuid.uuid4())
    _validation_sessions[session_id] = {
        "rows": result.rows,
        "filename": file.filename,
        "user_id": current_user.id,
        "errors": result.errors,
        "skipped": result.skipped,
    }

    # Return preview (first 20 rows)
    preview = result.rows[:20]

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows_total": result.total,
        "rows_valid": result.processed,
        "rows_error": result.error_count,
        "rows_skipped": result.skipped,
        "error_detail": result.errors[:10],
        "skipped_detail": [],
        "preview": preview,
    }


@router.post("/publish")
async def publish_upload(
    data: PublishRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Step 2: Publish validated session to database.
    Creates/updates parts and stock_levels, records history.
    """
    session = _validation_sessions.get(data.session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session tidak ditemukan atau sudah kadaluarsa",
        )

    if session["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Session bukan milik Anda")

    rows = session["rows"]
    filename = session["filename"]
    errors = session.get("errors", [])
    skipped = session.get("skipped", 0)

    rows_processed = 0
    rows_error = len(errors)
    now = datetime.now(timezone.utc)

    for row in rows:
        try:
            part_number = row["part_number"]

            # Upsert Part
            part_result = await db.execute(
                select(Part).where(Part.part_number == part_number)
            )
            part = part_result.scalar_one_or_none()

            if part is None:
                part = Part(
                    part_number=part_number,
                    description=row.get("description"),
                    producer=row.get("producer"),
                    commodity=row.get("commodity"),
                    kelas=row.get("kelas", "V"),
                )
                db.add(part)
                await db.flush()
            else:
                if row.get("description"):
                    part.description = row["description"]
                if row.get("producer"):
                    part.producer = row["producer"]
                if row.get("commodity"):
                    part.commodity = row["commodity"]
                part.is_active = True
                part.updated_at = now

            # Upsert StockLevel
            snapshot_date = row["snapshot_date"]
            site = current_user.site

            sl_result = await db.execute(
                select(StockLevel).where(
                    StockLevel.part_id == part.id,
                    StockLevel.site == site,
                    StockLevel.snapshot_date == snapshot_date,
                )
            )
            level = sl_result.scalar_one_or_none()

            old_rtt = level.rtt_qty if level else None
            old_tbd = level.tbd_qty if level else None

            if level is None:
                level = StockLevel(
                    part_id=part.id,
                    site=site,
                    min_qty=row["min_qty"],
                    max_qty=row["max_qty"],
                    rtt_qty=row["rtt_qty"],
                    tbd_qty=row["tbd_qty"],
                    status=row["status"],
                    snapshot_date=snapshot_date,
                    updated_at=now,
                )
                db.add(level)
            else:
                level.min_qty = row["min_qty"]
                level.max_qty = row["max_qty"]
                level.rtt_qty = row["rtt_qty"]
                level.tbd_qty = row["tbd_qty"]
                level.status = row["status"]
                level.updated_at = now

            await db.flush()

            # Record stock history for changes
            if old_rtt != row["rtt_qty"]:
                history = StockHistory(
                    part_id=part.id,
                    warehouse="RTT",
                    old_qty=old_rtt,
                    new_qty=row["rtt_qty"],
                    source_file=filename,
                    uploaded_by=current_user.id,
                    synced_at=now,
                )
                db.add(history)

            if old_tbd != row["tbd_qty"]:
                history = StockHistory(
                    part_id=part.id,
                    warehouse="TBD",
                    old_qty=old_tbd,
                    new_qty=row["tbd_qty"],
                    source_file=filename,
                    uploaded_by=current_user.id,
                    synced_at=now,
                )
                db.add(history)

            rows_processed += 1
        except Exception as e:
            rows_error += 1
            errors.append({"row": 0, "reason": str(e)})

    # Create upload log
    upload_status = "success" if rows_error == 0 else ("partial" if rows_processed > 0 else "failed")
    log = UploadLog(
        filename=filename,
        uploaded_by=current_user.id,
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

    # Clean up session
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
    current_user: User = Depends(require_role("admin")),
):
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

    items = []
    for log, user in rows:
        items.append({
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
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if total > 0 else 1,
    }


@router.get("/logs/{log_id}")
async def get_upload_log(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(UploadLog, User)
        .join(User, User.id == UploadLog.uploaded_by)
        .where(UploadLog.id == log_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Log tidak ditemukan")

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
