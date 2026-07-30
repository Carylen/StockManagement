"""
Service layer for UT/Supplier stock upload.

Steps:
  1. Parse file
  2. Resolve Site KPP — blank defaults to "AGMR"; otherwise must be a real,
     active site (tb_m_sites), else the row is skipped. The per-supplier
     plant/site allow-list (tb_m_plant_site_mapping) is NOT consulted here —
     multi-site-per-plant isn't enforced right now, so the "Description"
     column (formerly "Plnt") is free text, unvalidated.
  3. Cross-reference with master KPP (tb_m_parts), resolve supersession chain
  4. Replace data per (site, supplier) — mark that supplier's old rows for the
     affected sites is_latest=False, insert new batch. Scoped by supplier so one
     supplier's upload never invalidates another supplier's rows for a shared site.
  5. Save upload log
  6. Return summary
"""
import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.part import Part
from app.models.site import Site
from app.models.ut_stock import UTStock, UTUploadLog
from app.services.ut_stock_parser import UTParseResult, parse_ut_stock_file

DEFAULT_SITE_CODE = "AGMR"


def _resolve_site_code(raw_site_code: str | None, active_site_codes: set[str]) -> str | None:
    """Blank → default site. Otherwise must be a real, active site or it's unresolvable."""
    if not raw_site_code:
        return DEFAULT_SITE_CODE
    return raw_site_code if raw_site_code in active_site_codes else None


@dataclass
class UTUploadSummary:
    batch_id: str
    total_rows: int
    matched_rows: int
    skipped_rows: int
    sites_affected: list[str]
    warnings: list[str] = field(default_factory=list)


@dataclass
class UTValidatePreview:
    total_rows: int
    matched_rows: int
    skipped_rows: int
    sites_affected: list[str]
    warnings: list[str]
    preview: list[dict]  # first 10 matched rows


def _resolve_active_pn(pn: str, parts_dict: dict[str, Part]) -> str | None:
    """Follow superseded_by chain until we reach the active (canonical) PN.
    Returns None if the PN is not in master at all."""
    visited: set[str] = set()
    current = pn
    while True:
        if current in visited:
            return None  # circular chain guard
        visited.add(current)
        part = parts_dict.get(current)
        if part is None:
            return None
        if part.superseded_by:
            current = part.superseded_by
        else:
            return part.part_number


def _build_preview(
    parse_result: UTParseResult,
    active_site_codes: set[str],
    parts_dict: dict[str, Part],
    limit: int = 10,
) -> tuple[list[dict], int, int, list[str]]:
    """Dry-run pass. Returns (preview_rows, matched, skipped, warnings)."""
    unknown_sites: set[str] = set()
    matched: list[dict] = []
    skipped = 0

    for row in parse_result.rows:
        site_code = _resolve_site_code(row.site_code, active_site_codes)
        if site_code is None:
            unknown_sites.add(row.site_code or "")
            skipped += 1
            continue

        active_pn = _resolve_active_pn(row.part_number, parts_dict)
        if active_pn is None:
            skipped += 1
            continue

        part = parts_dict[active_pn]
        matched.append({
            "part_number": active_pn,
            "part_description": part.description,
            "description": row.description,
            "site_code": site_code,
            "avail_stock": row.avail_stock,
            "rtt_qty": row.rtt_qty,
            "tbd_qty": row.tbd_qty,
            "estimated_date": row.estimated_date.isoformat() if row.estimated_date else None,
        })

    warnings = [
        f"Site '{s}' tidak dikenal, baris diabaikan" for s in sorted(unknown_sites)
    ]
    preview = matched[:limit]
    return preview, len(matched), skipped + parse_result.skipped, warnings


async def validate_ut_stock_upload(
    file_bytes: bytes,
    filename: str,
    db: AsyncSession,
) -> tuple[UTParseResult, UTValidatePreview]:
    """Parse + dry-run without writing to DB. Returns (parse_result, preview)."""
    parse_result = await asyncio.to_thread(parse_ut_stock_file, file_bytes, filename)
    if parse_result.has_errors:
        return parse_result, UTValidatePreview(
            total_rows=0,
            matched_rows=0,
            skipped_rows=0,
            sites_affected=[],
            warnings=[e["reason"] for e in parse_result.errors],
            preview=[],
        )

    active_site_codes, parts_dict = await _fetch_lookup_data(parse_result, db)

    preview_rows, matched, skipped, warnings = _build_preview(parse_result, active_site_codes, parts_dict)

    sites_affected = sorted({
        resolved
        for row in parse_result.rows
        if (resolved := _resolve_site_code(row.site_code, active_site_codes)) is not None
    })

    return parse_result, UTValidatePreview(
        total_rows=parse_result.total,
        matched_rows=matched,
        skipped_rows=skipped,
        sites_affected=sites_affected,
        warnings=warnings,
        preview=preview_rows,
    )


async def process_ut_stock_upload(
    file_bytes: bytes,
    filename: str,
    uploader_id: str,
    supplier_id: str,
    db: AsyncSession,
) -> UTUploadSummary:
    """Full upload: parse → resolve → replace → log."""
    # Step 1 — Parse
    parse_result = await asyncio.to_thread(parse_ut_stock_file, file_bytes, filename)
    if parse_result.has_errors:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail=parse_result.errors[0]["reason"],
        )

    # Step 2 & 3 — Lookup data
    active_site_codes, parts_dict = await _fetch_lookup_data(parse_result, db)

    # Step 4 — Build rows to insert
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    unknown_sites: set[str] = set()
    sites_affected: set[str] = set()
    new_rows: list[UTStock] = []
    skipped = parse_result.skipped

    for row in parse_result.rows:
        site_code = _resolve_site_code(row.site_code, active_site_codes)
        if site_code is None:
            unknown_sites.add(row.site_code or "")
            skipped += 1
            continue

        active_pn = _resolve_active_pn(row.part_number, parts_dict)
        if active_pn is None:
            skipped += 1
            continue

        sites_affected.add(site_code)
        new_rows.append(UTStock(
            id=str(uuid.uuid4()),
            part_number=active_pn,
            description=row.description,
            site_code=site_code,
            supplier_id=supplier_id,
            avail_stock=row.avail_stock,
            rtt_qty=row.rtt_qty,
            tbd_qty=row.tbd_qty,
            estimated_date=row.estimated_date,
            upload_batch=batch_id,
            is_latest=True,
            uploaded_at=now,
            uploaded_by=uploader_id,
        ))

    # Mark this supplier's old rows as not-latest for affected sites — scoped by
    # supplier so another supplier's rows for the same site are left untouched.
    for site_code in sites_affected:
        await db.execute(
            update(UTStock)
            .where(
                UTStock.site_code == site_code,
                UTStock.supplier_id == supplier_id,
                UTStock.is_latest == True,
            )
            .values(is_latest=False)
        )

    # Insert new rows
    for stock_row in new_rows:
        db.add(stock_row)

    # Step 5 — Save upload log
    log = UTUploadLog(
        id=str(uuid.uuid4()),
        batch_id=batch_id,
        uploaded_by=uploader_id,
        supplier_id=supplier_id,
        filename=filename,
        total_rows=parse_result.total,
        matched_rows=len(new_rows),
        skipped_rows=skipped,
        sites_affected=sorted(sites_affected),
        uploaded_at=now,
    )
    db.add(log)

    warnings = [
        f"Site '{s}' tidak dikenal, baris diabaikan" for s in sorted(unknown_sites)
    ]

    return UTUploadSummary(
        batch_id=batch_id,
        total_rows=parse_result.total,
        matched_rows=len(new_rows),
        skipped_rows=skipped,
        sites_affected=sorted(sites_affected),
        warnings=warnings,
    )


async def _fetch_lookup_data(
    parse_result: UTParseResult,
    db: AsyncSession,
) -> tuple[set[str], dict[str, Part]]:
    """Fetch active site codes and the parts dict in two queries."""
    site_result = await db.execute(select(Site.code).where(Site.is_active == True))
    active_site_codes: set[str] = set(site_result.scalars().all())

    # All part numbers referenced in the file (including possible supersession targets)
    all_pns = {row.part_number for row in parse_result.rows}
    parts_result = await db.execute(
        select(Part).where(Part.part_number.in_(all_pns))
    )
    parts_list = parts_result.scalars().all()
    parts_dict: dict[str, Part] = {p.part_number: p for p in parts_list}

    # Pre-fetch supersession targets that may not be in all_pns
    supers_pns = {p.superseded_by for p in parts_list if p.superseded_by}
    if supers_pns - all_pns:
        extra_result = await db.execute(
            select(Part).where(Part.part_number.in_(supers_pns - all_pns))
        )
        for p in extra_result.scalars().all():
            parts_dict[p.part_number] = p

    return active_site_codes, parts_dict
