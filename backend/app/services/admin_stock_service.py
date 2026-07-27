"""
Service layer for the admin daily-readiness upload.

Steps:
  1. Parse file (status trusted as-is, but validated against AMAN/WARNING/OVER)
  2. Cross-reference part_number with master KPP (tb_m_parts), resolve
     supersession chain — stricter than UT: must resolve to a Class V,
     active part, or the row is rejected with a specific reason.
  3. Upsert per (part_number, site) into tb_t_stock_levels (no full-site
     wipe — parts not present in today's file are left untouched and
     naturally age out relative to a fresher UT upload).
  4. Upsert the per-site MIN/MAX threshold as a side effect.
  5. Save upload log (site-scoped, with itemized rejection detail).
  6. Return summary.
"""
import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.part import Part
from app.models.part_site_threshold import PartSiteThreshold
from app.models.stock import StockLevel
from app.models.upload_log import UploadLog
from app.services.admin_stock_parser import (
    AdminStockParseResult,
    AdminStockRow,
    parse_admin_stock_file,
)


@dataclass
class RejectedRow:
    row: int
    part_number: str | None
    reason: str


@dataclass
class AdminStockValidatePreview:
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    preview: list[dict]  # first N accepted rows
    rejected_detail: list[RejectedRow]


@dataclass
class AdminStockUploadSummary:
    log_id: str
    site: str
    total_rows: int
    rows_processed: int
    rows_skipped: int
    rejected_detail: list[RejectedRow] = field(default_factory=list)


def _resolve_active_pn_strict(pn: str, parts_dict: dict[str, Part]) -> tuple[str | None, str | None]:
    """Like ut_stock_service._resolve_active_pn, but also requires the
    resolved part to be Class V and active. Returns (active_pn, None) on
    success, or (None, reason) on rejection."""
    visited: set[str] = set()
    current = pn
    while True:
        if current in visited:
            return None, "Rantai supersession berputar (circular)"
        visited.add(current)
        part = parts_dict.get(current)
        if part is None:
            return None, "Part number tidak ditemukan di master"
        if part.superseded_by:
            current = part.superseded_by
            continue
        if part.kelas != "V":
            return None, f"Part number adalah Kelas {part.kelas}, bukan Kelas V"
        if not part.is_active:
            return None, "Part number tidak aktif (is_active=False) di master"
        return part.part_number, None


async def _fetch_parts_dict(pns: set[str], db: AsyncSession) -> dict[str, Part]:
    """Fetch parts referenced in the file, plus any supersession targets
    not already covered, so chains resolve even if the target PN itself
    isn't in the uploaded file."""
    parts_result = await db.execute(select(Part).where(Part.part_number.in_(pns)))
    parts_list = parts_result.scalars().all()
    parts_dict: dict[str, Part] = {p.part_number: p for p in parts_list}

    supers_pns = {p.superseded_by for p in parts_list if p.superseded_by}
    if supers_pns - pns:
        extra_result = await db.execute(select(Part).where(Part.part_number.in_(supers_pns - pns)))
        for p in extra_result.scalars().all():
            parts_dict[p.part_number] = p

    return parts_dict


def _resolve_rows(
    parse_result: AdminStockParseResult, parts_dict: dict[str, Part]
) -> tuple[list[tuple[AdminStockRow, str]], list[RejectedRow]]:
    """Returns (accepted rows w/ resolved active PN, rejected detail)."""
    accepted: list[tuple[AdminStockRow, str]] = []
    rejected: list[RejectedRow] = [
        RejectedRow(row=r.row, part_number=r.part_number, reason=r.reason)
        for r in parse_result.rejected
    ]
    for row in parse_result.rows:
        active_pn, reason = _resolve_active_pn_strict(row.part_number, parts_dict)
        if active_pn is None:
            rejected.append(RejectedRow(row=row.row, part_number=row.part_number, reason=reason or "Tidak valid"))
            continue
        accepted.append((row, active_pn))
    rejected.sort(key=lambda r: r.row)
    return accepted, rejected


async def validate_admin_stock_upload(
    file_bytes: bytes,
    filename: str,
    db: AsyncSession,
    preview_limit: int = 20,
) -> tuple[AdminStockParseResult, AdminStockValidatePreview]:
    """Parse + dry-run without writing to DB."""
    parse_result = await asyncio.to_thread(parse_admin_stock_file, file_bytes, filename)
    if parse_result.has_errors:
        return parse_result, AdminStockValidatePreview(
            total_rows=0, accepted_rows=0, rejected_rows=0, preview=[], rejected_detail=[],
        )

    all_pns = {row.part_number for row in parse_result.rows}
    parts_dict = await _fetch_parts_dict(all_pns, db)
    accepted, rejected = _resolve_rows(parse_result, parts_dict)

    preview = [
        {
            "row": row.row,
            "part_number": active_pn,
            "description": row.description,
            "min_qty": row.min_qty,
            "max_qty": row.max_qty,
            "rtt_qty": row.rtt_qty,
            "tbd_qty": row.tbd_qty,
            "total_qty": row.rtt_qty + row.tbd_qty,
            "estimated_date": row.estimated_date.isoformat() if row.estimated_date else None,
            "status": row.status,
        }
        for row, active_pn in accepted[:preview_limit]
    ]

    return parse_result, AdminStockValidatePreview(
        total_rows=parse_result.total,
        accepted_rows=len(accepted),
        rejected_rows=len(rejected),
        preview=preview,
        rejected_detail=rejected,
    )


async def process_admin_stock_upload(
    file_bytes: bytes,
    filename: str,
    site: str,
    uploader_id: str,
    db: AsyncSession,
) -> AdminStockUploadSummary:
    """Full upload: parse → resolve → upsert per (part_number, site) → log."""
    parse_result = await asyncio.to_thread(parse_admin_stock_file, file_bytes, filename)
    if parse_result.has_errors:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail=parse_result.errors[0]["reason"])

    all_pns = {row.part_number for row in parse_result.rows}
    parts_dict = await _fetch_parts_dict(all_pns, db)
    accepted, rejected = _resolve_rows(parse_result, parts_dict)

    now = datetime.now(timezone.utc)

    if accepted:
        active_pns = {active_pn for _, active_pn in accepted}
        existing_levels_result = await db.execute(
            select(StockLevel).where(StockLevel.part_number.in_(active_pns), StockLevel.site == site)
        )
        existing_levels = {lvl.part_number: lvl for lvl in existing_levels_result.scalars().all()}

        existing_thresholds_result = await db.execute(
            select(PartSiteThreshold).where(
                PartSiteThreshold.part_number.in_(active_pns), PartSiteThreshold.site_code == site
            )
        )
        existing_thresholds = {t.part_number: t for t in existing_thresholds_result.scalars().all()}

        for row, active_pn in accepted:
            level = existing_levels.get(active_pn)
            if level is None:
                level = StockLevel(id=str(uuid.uuid4()), part_number=active_pn, site=site)
                db.add(level)
                existing_levels[active_pn] = level
            level.description = row.description
            level.mnemonic = row.mnemonic
            level.commodity = row.commodity
            level.min_qty = row.min_qty
            level.max_qty = row.max_qty
            level.rtt_qty = row.rtt_qty
            level.tbd_qty = row.tbd_qty
            level.estimated_date = row.estimated_date
            level.status = row.status
            level.updated_at = now

            threshold = existing_thresholds.get(active_pn)
            if threshold is None:
                threshold = PartSiteThreshold(part_number=active_pn, site_code=site)
                db.add(threshold)
                existing_thresholds[active_pn] = threshold
            threshold.min_qty = row.min_qty
            threshold.max_qty = row.max_qty
            threshold.updated_at = now
            threshold.updated_by = uploader_id

    log = UploadLog(
        id=str(uuid.uuid4()),
        filename=filename,
        site=site,
        uploaded_by=uploader_id,
        rows_total=parse_result.total,
        rows_processed=len(accepted),
        rows_skipped=len(rejected),
        rows_error=0,
        error_detail={"rejected": [{"row": r.row, "part_number": r.part_number, "reason": r.reason} for r in rejected]},
        status="success" if not rejected else ("partial" if accepted else "failed"),
        created_at=now,
    )
    db.add(log)

    return AdminStockUploadSummary(
        log_id=log.id,
        site=site,
        total_rows=parse_result.total,
        rows_processed=len(accepted),
        rows_skipped=len(rejected),
        rejected_detail=rejected,
    )
