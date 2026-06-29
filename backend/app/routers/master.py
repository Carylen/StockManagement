"""
Master Class V/G router.

Endpoints:
  GET  /master/parts/meta    → latest upload metadata (for the Active Master card)
  GET  /master/parts         → paginated part list (all classes, no site scope)
  POST /master/parts/upload  → upload new master XLSX (admin only)
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update, bindparam

from app.core.database import get_db
from app.core.auth import Principal
from app.utils.permissions import require_permission
from app.utils.scoping import require_view_sites
from app.models.part import Part
from app.models.master_upload import MasterUpload
from app.models.user import User
from app.models.ut_stock import UTStock
from app.services.master_parser import (
    parse_master_xlsx, REQUIRED_MASTER_COLUMNS, safe_str, safe_float, infer_producer,
)


class PartPatchRequest(BaseModel):
    min_qty: Optional[float] = None
    max_qty: Optional[float] = None
    superseded_by: Optional[str] = None
    is_active: Optional[bool] = None

router = APIRouter(prefix="/master", tags=["master"])


# ── GET /master/parts/meta ───────────────────────────────────────────────────

@router.get("/parts/meta")
async def get_master_meta(
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_master")),
):
    result = await db.execute(
        select(MasterUpload, User)
        .join(User, User.id == MasterUpload.uploaded_by, isouter=True)
        .order_by(MasterUpload.uploaded_at.desc())
        .limit(1)
    )
    row = result.one_or_none()

    if row is None:
        # No master uploaded yet — return null-safe empty shape
        total_result = await db.execute(select(func.count(Part.id)).where(Part.is_active == True))
        total = total_result.scalar_one() or 0
        return {
            "filename": None,
            "uploaded_at": None,
            "uploader_name": None,
            "total": total,
            "class_v_count": 0,
            "class_g_count": 0,
            "komatsu_count": 0,
            "scania_count": 0,
        }

    upload, user = row
    return {
        "filename": upload.filename,
        "uploaded_at": upload.uploaded_at.isoformat() if upload.uploaded_at else None,
        "uploader_name": user.name if user else None,
        "total": upload.total_count,
        "class_v_count": upload.class_v_count,
        "class_g_count": upload.class_g_count,
        "komatsu_count": upload.komatsu_count,
        "scania_count": upload.scania_count,
    }


# ── GET /master/parts ────────────────────────────────────────────────────────

@router.get("/parts")
async def list_master_parts(
    limit: int = 50,
    page: int = 1,
    search: Optional[str] = None,
    kelas: Optional[str] = None,
    is_active: Optional[str] = None,   # "true" | "false" | "all" (default: all)
    has_supersession: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_view_sites),
):
    filters = []
    # is_active filter: default to all (no filter) for master management view
    is_active_val = (is_active or "all").lower()
    if is_active_val == "true":
        filters.append(Part.is_active == True)
    elif is_active_val == "false":
        filters.append(Part.is_active == False)
    # "all" → no filter

    if kelas and kelas.upper() in ("V", "G"):
        filters.append(Part.kelas == kelas.upper())
    if has_supersession is True:
        filters.append(Part.superseded_by.isnot(None))
    if search and search.strip():
        like = f"%{search.strip()}%"
        filters.append(
            or_(
                Part.part_number.ilike(like),
                Part.description.ilike(like),
                Part.mnemonic.ilike(like),
                Part.commodity.ilike(like),
            )
        )

    base_where = filters if filters else [True]
    count_result = await db.execute(select(func.count(Part.id)).where(*base_where))
    total = count_result.scalar_one() or 0

    result = await db.execute(
        select(Part)
        .where(*base_where)
        .order_by(Part.part_number)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    parts = result.scalars().all()

    return {
        "items": [
            {
                "part_number": p.part_number,
                "description": p.description,
                "mnemonic": p.mnemonic,
                "commodity": p.commodity,
                "kelas": p.kelas,
                "min_qty": float(p.min_qty),
                "max_qty": float(p.max_qty),
                "superseded_by": p.superseded_by,
                "is_active": p.is_active,
            }
            for p in parts
        ],
        "total": total,
    }


# ── PATCH /master/parts/{pn} ─────────────────────────────────────────────────

async def _has_circular_supersession(pn: str, new_target: str, db: AsyncSession) -> bool:
    """Return True if setting pn.superseded_by = new_target creates a cycle."""
    visited = {pn}
    current = new_target
    while current:
        if current in visited:
            return True
        visited.add(current)
        result = await db.execute(
            select(Part.superseded_by).where(Part.part_number == current)
        )
        current = result.scalar_one_or_none()
    return False


@router.patch("/parts/{pn}")
async def patch_master_part(
    pn: str,
    body: PartPatchRequest,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_master")),
):
    pn = pn.upper()
    part_result = await db.execute(select(Part).where(Part.part_number == pn))
    part = part_result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail=f"Part '{pn}' tidak ditemukan")

    warnings: list[str] = []
    updates: dict = {"updated_at": datetime.now(timezone.utc)}

    if body.min_qty is not None:
        updates["min_qty"] = body.min_qty
    if body.max_qty is not None:
        updates["max_qty"] = body.max_qty

    if body.superseded_by is not None:
        target = body.superseded_by.upper() if body.superseded_by else None
        if target:
            target_result = await db.execute(
                select(Part.part_number).where(Part.part_number == target)
            )
            if not target_result.scalar_one_or_none():
                raise HTTPException(status_code=422, detail=f"Part '{target}' tidak ada di master")
            if await _has_circular_supersession(pn, target, db):
                raise HTTPException(status_code=422, detail=f"Circular supersession terdeteksi: {pn} → {target}")
        updates["superseded_by"] = target

    if body.is_active is not None:
        if not body.is_active:
            # Warn if part still has active stock across any site
            avail_result = await db.execute(
                select(func.sum(UTStock.avail_stock))
                .where(UTStock.part_number == pn, UTStock.is_latest == True)
            )
            total_avail = avail_result.scalar_one_or_none() or 0
            if total_avail > 0:
                warnings.append(
                    f"Part '{pn}' masih memiliki avail_stock {total_avail} di warehouse. "
                    "Pastikan stok sudah habis sebelum menonaktifkan."
                )
        updates["is_active"] = body.is_active

    await db.execute(
        update(Part.__table__)
        .where(Part.__table__.c.part_number == pn)
        .values(**updates)
    )
    await db.commit()

    updated_result = await db.execute(select(Part).where(Part.part_number == pn))
    updated = updated_result.scalar_one()

    return {
        "part_number": updated.part_number,
        "min_qty": float(updated.min_qty),
        "max_qty": float(updated.max_qty),
        "superseded_by": updated.superseded_by,
        "is_active": updated.is_active,
        "warnings": warnings,
    }


# ── POST /master/parts/upload ────────────────────────────────────────────────

@router.post("/parts/upload")
async def upload_master(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_manage_master")),
):
    filename = file.filename or "master.xlsx"
    if not filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only XLSX/XLS files are accepted")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    try:
        df = await asyncio.to_thread(parse_master_xlsx, file_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse file: {e}")

    missing = REQUIRED_MASTER_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required columns: {', '.join(sorted(missing))}. Found: {', '.join(df.columns.tolist())}",
        )

    warnings: list[dict] = []

    # warn about duplicate part_numbers in the file before deduplication
    if "part_number" in df.columns:
        dup_groups = df[df.duplicated(subset=["part_number"], keep=False)].groupby("part_number")
        for pn, group in dup_groups:
            row_nums = ", ".join(str(int(i) + 2) for i in group.index)
            warnings.append({"code": "duplicate_pn", "pn": str(pn), "rows": row_nums})

    # deduplicate file rows by part_number, keep last occurrence
    df = df.drop_duplicates(subset=["part_number"], keep="last")

    # load existing part_numbers as a set — one query, strings only
    rows_existing = await db.execute(select(Part.part_number))
    existing: set[str] = {r.part_number for r in rows_existing}

    inserted = 0
    updated = 0
    skipped = 0
    errors: list[str] = []
    class_v = 0
    class_g = 0
    komatsu = 0
    scania = 0
    now = datetime.now(timezone.utc)

    # Detect which optional columns are present in the file
    has_min = "min_qty" in df.columns
    has_max = "max_qty" in df.columns
    has_superseded = "superseded_by" in df.columns

    new_parts: list[Part] = []
    update_maps: list[dict] = []

    for row in df.itertuples(index=True):
        row_num = int(row.Index) + 2  # type: ignore[attr-defined]

        part_number = safe_str(getattr(row, "part_number", None))
        if not part_number or part_number.upper() in ("PART NUMBER", "PART_NUMBER", "N/A", "-"):
            warnings.append({"code": "empty_pn", "row": row_num})
            skipped += 1
            continue

        raw_kelas = safe_str(getattr(row, "kelas", None) or "")
        kelas = (raw_kelas or "V").upper()
        if kelas not in ("V", "G"):
            errors.append(f"Row {row_num}: Part {part_number} — invalid class '{raw_kelas}', expected V or G")
            skipped += 1
            continue

        description = safe_str(getattr(row, "description", None))
        mnemonic    = safe_str(getattr(row, "mnemonic", None))
        commodity   = safe_str(getattr(row, "commodity", None))
        stockcode   = safe_str(getattr(row, "stockcode", None))
        producer    = infer_producer(mnemonic)

        # Optional min/max/superseded_by — only read if column exists in file
        min_qty_val = safe_float(getattr(row, "min_qty", None)) if has_min else None
        max_qty_val = safe_float(getattr(row, "max_qty", None)) if has_max else None
        superseded_raw = safe_str(getattr(row, "superseded_by", None)) if has_superseded else None
        superseded_val = superseded_raw.upper() if superseded_raw else None

        if part_number not in existing:
            new_parts.append(Part(
                part_number=part_number,
                description=description,
                kelas=kelas,
                mnemonic=mnemonic,
                commodity=commodity,
                stockcode=stockcode,
                producer=producer,
                is_active=True,
                min_qty=min_qty_val if min_qty_val is not None else 0,
                max_qty=max_qty_val if max_qty_val is not None else 0,
                superseded_by=superseded_val,
            ))
            inserted += 1
        else:
            upd: dict = {
                "_pn": part_number,
                "kelas": kelas,
                "is_active": True,
                "producer": producer,
                "updated_at": now,
            }
            if description is not None:
                upd["description"] = description
            if mnemonic is not None:
                upd["mnemonic"] = mnemonic
            if commodity is not None:
                upd["commodity"] = commodity
            if stockcode is not None:
                upd["stockcode"] = stockcode
            # Only update min/max/superseded_by if column was present in file
            if has_min and min_qty_val is not None:
                upd["min_qty"] = min_qty_val
            if has_max and max_qty_val is not None:
                upd["max_qty"] = max_qty_val
            if has_superseded and superseded_val is not None:
                upd["superseded_by"] = superseded_val
            update_maps.append(upd)
            updated += 1

        if kelas == "V":
            class_v += 1
        else:
            class_g += 1

        if producer == "KOMATSU":
            komatsu += 1
        else:
            scania += 1

    # bulk write — no per-row flush
    if new_parts:
        db.add_all(new_parts)
    if update_maps:
        await db.execute(
            update(Part.__table__).where(Part.__table__.c.part_number == bindparam("_pn")),
            update_maps,
        )

    total = class_v + class_g

    upload_record = MasterUpload(
        filename=filename,
        uploaded_by=principal.id,
        uploaded_at=now,
        total_count=total,
        class_v_count=class_v,
        class_g_count=class_g,
        komatsu_count=komatsu,
        scania_count=scania,
    )
    db.add(upload_record)
    await db.commit()

    return {
        "inserted": inserted,
        "updated": updated,
        "class_v": class_v,
        "class_g": class_g,
        "skipped": skipped,
        "errors": errors,
        "warnings": warnings,
    }

