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
from sqlalchemy.dialects.postgresql import insert as pg_insert
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
    warnings: list[dict] = field(default_factory=list)


@dataclass
class AdminStockUploadSummary:
    log_id: str
    site: str
    total_rows: int
    rows_processed: int
    rows_skipped: int
    status: str = "success"
    rejected_detail: list[RejectedRow] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)


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
        warnings=parse_result.warnings,
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

    # Multiple file rows can resolve (via supersession) to the same active PN;
    # keep the last one, same convention as the file-level duplicate handling
    # in the parser. Also required by Postgres — a single INSERT..ON CONFLICT
    # statement can't touch the same conflict target twice.
    by_active_pn: dict[str, AdminStockRow] = {}
    for row, active_pn in accepted:
        by_active_pn[active_pn] = row
    rows_processed = len(by_active_pn)

    db_error: str | None = None
    if by_active_pn:
        level_values = [
            {
                "id": str(uuid.uuid4()),
                "part_number": active_pn,
                "site": site,
                "description": row.description,
                "mnemonic": row.mnemonic,
                "commodity": row.commodity,
                "min_qty": row.min_qty,
                "max_qty": row.max_qty,
                "rtt_qty": row.rtt_qty,
                "tbd_qty": row.tbd_qty,
                "estimated_date": row.estimated_date,
                "status": row.status,
                "updated_at": now,
            }
            for active_pn, row in by_active_pn.items()
        ]
        threshold_values = [
            {
                "part_number": active_pn,
                "site_code": site,
                "min_qty": row.min_qty,
                "max_qty": row.max_qty,
                "updated_at": now,
                "updated_by": uploader_id,
            }
            for active_pn, row in by_active_pn.items()
        ]

        level_stmt = pg_insert(StockLevel.__table__).values(level_values)
        level_stmt = level_stmt.on_conflict_do_update(
            index_elements=["part_number", "site"],
            set_={
                "description": level_stmt.excluded.description,
                "mnemonic": level_stmt.excluded.mnemonic,
                "commodity": level_stmt.excluded.commodity,
                "min_qty": level_stmt.excluded.min_qty,
                "max_qty": level_stmt.excluded.max_qty,
                "rtt_qty": level_stmt.excluded.rtt_qty,
                "tbd_qty": level_stmt.excluded.tbd_qty,
                "estimated_date": level_stmt.excluded.estimated_date,
                "status": level_stmt.excluded.status,
                "updated_at": level_stmt.excluded.updated_at,
            },
        )

        threshold_stmt = pg_insert(PartSiteThreshold.__table__).values(threshold_values)
        threshold_stmt = threshold_stmt.on_conflict_do_update(
            index_elements=["part_number", "site_code"],
            set_={
                "min_qty": threshold_stmt.excluded.min_qty,
                "max_qty": threshold_stmt.excluded.max_qty,
                "updated_at": threshold_stmt.excluded.updated_at,
                "updated_by": threshold_stmt.excluded.updated_by,
            },
        )

        # ON CONFLICT makes each statement atomic (no read-then-write gap), so
        # concurrent uploads for the same site can no longer race each other
        # into a UniqueConstraint violation. The savepoint below means that if
        # the upsert itself still fails for some other reason (e.g. a bad
        # value that violates a column constraint), the failure is contained
        # here and doesn't roll back the UploadLog written below — so admins
        # can see the upload failed instead of it silently vanishing.
        try:
            async with db.begin_nested():
                await db.execute(level_stmt)
                await db.execute(threshold_stmt)
        except Exception as e:
            db_error = str(e)
            rows_processed = 0

    error_detail: dict = {
        "rejected": [{"row": r.row, "part_number": r.part_number, "reason": r.reason} for r in rejected],
    }
    if parse_result.warnings:
        error_detail["warnings"] = parse_result.warnings
    if db_error:
        error_detail["db_error"] = db_error

    if db_error:
        status = "failed"
    elif not rejected:
        status = "success"
    elif accepted:
        status = "partial"
    else:
        status = "failed"

    log = UploadLog(
        id=str(uuid.uuid4()),
        filename=filename,
        site=site,
        uploaded_by=uploader_id,
        rows_total=parse_result.total,
        rows_processed=rows_processed,
        rows_skipped=len(rejected),
        rows_error=0,
        error_detail=error_detail,
        status=status,
        created_at=now,
    )
    db.add(log)

    return AdminStockUploadSummary(
        log_id=log.id,
        site=site,
        total_rows=parse_result.total,
        rows_processed=rows_processed,
        rows_skipped=len(rejected),
        status=status,
        rejected_detail=rejected,
        warnings=parse_result.warnings,
    )
