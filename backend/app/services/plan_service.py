"""
Service layer for the Scheduled-Plan module.

Responsibilities:
  - derive the monthly period window from the upload datetime (WIB)
  - derive period state (OPEN/LOCKED) from due_date — no cron
  - find/create the period for (site, activity, start_date)
  - validate NPN against tb_m_parts (skip + record unknown ones)
  - merge file rows into plan lines (preserve UT fields on re-upload)
  - aggregate exact-duplicate natural keys within one file (sum req_qty)
"""
import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.part import Part
from app.models.plan_period import PlanPeriod
from app.models.plan_line import PlanLine
from app.models.plan_line_history import PlanLineHistory
from app.services.plan_parser import parse_plan_file, PlanRow

WIB = timezone(timedelta(hours=7))


# ── Period window / state helpers ────────────────────────────────────────

def now_wib() -> datetime:
    return datetime.now(WIB)


def period_window(ref: datetime) -> tuple[date, date]:
    """start = day 5 of the upload month; due = day 5 of the next month (WIB)."""
    start = date(ref.year, ref.month, 5)
    if ref.month == 12:
        due = date(ref.year + 1, 1, 5)
    else:
        due = date(ref.year, ref.month + 1, 5)
    return start, due


def period_state(due: date, ref: datetime | None = None) -> str:
    ref = ref or now_wib()
    return "OPEN" if ref.date() <= due else "LOCKED"


# ── Upload summary ───────────────────────────────────────────────────────

@dataclass
class PeriodUploadResult:
    """One processed (site, activity) period inside a bundle upload."""
    period_id: str
    activity: str
    is_revision: bool
    rows_inserted: int
    rows_updated: int
    rows_merged: int
    rows_marked_removed: int


@dataclass
class SkippedPeriod:
    activity: str
    reason: str


@dataclass
class PlanUploadSummary:
    site: str
    start_date: date
    due_date: date
    rows_total: int
    # aggregate counts across all processed periods
    rows_inserted: int
    rows_updated: int
    rows_merged: int
    rows_skipped: int
    rows_marked_removed: int
    periods: list[PeriodUploadResult] = field(default_factory=list)
    skipped_periods: list[SkippedPeriod] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)


def _natural_key(r: PlanRow) -> tuple[str, str, str, str]:
    return (r.egi, r.cn, r.npn, r.apl_activity)


# ── Audit ────────────────────────────────────────────────────────────────

def _norm(v) -> str | None:
    if v is None or v == "":
        return None
    if isinstance(v, date):
        return v.isoformat()
    return str(v)


def record_history(db: AsyncSession, line_id: str, field: str, old, new, changed_by: str | None) -> bool:
    """Append a history row if the value actually changed. Returns True if recorded.

    Caller is responsible for committing.
    """
    o, n = _norm(old), _norm(new)
    if o == n:
        return False
    db.add(PlanLineHistory(
        line_id=line_id, field=field, old_value=o, new_value=n, changed_by=changed_by,
    ))
    return True


# ── Supplier fill import (Excel / CSV bulk update) ───────────────────────

_FILL_ALIASES = {
    "line_id":     ["line id", "line_id", "id"],
    "status":      ["status", "readiness", "ready", "readyness"],
    "ut_location": ["ut location", "ut_location", "location", "lokasi"],
    "est_date":    ["est date", "est_date", "estimasi", "estimated date", "tanggal estimasi"],
}

_READY_TRUE = {"ready", "siap", "y", "yes", "true", "1"}


@dataclass
class FillImportRow:
    line_id: str
    status: str            # READY | NOT_READY
    ut_location: str | None
    est_date: date | None


def _parse_import_date(v) -> date | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() in ("nan", "none"):
        return None
    try:
        import pandas as pd
        ts = pd.to_datetime(s, dayfirst=True, errors="coerce")
        if pd.isna(ts):
            return None
        return ts.date()
    except Exception:
        return None


def parse_fill_file(file_bytes: bytes, filename: str) -> dict:
    """Parse a supplier fill file (xlsx/csv). Matches lines by 'Line ID'."""
    import io
    import pandas as pd

    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes), dtype=str)
        else:
            df = pd.read_excel(io.BytesIO(file_bytes), dtype=str)
    except Exception as exc:
        return {"error": f"Gagal membaca file: {exc}", "rows": [], "errors": []}

    df.columns = [str(c).strip().lower() for c in df.columns]
    colmap: dict[str, str] = {}
    for canon, aliases in _FILL_ALIASES.items():
        for a in aliases:
            if a in df.columns and canon not in colmap.values():
                colmap[a] = canon
                break
    df = df.rename(columns=colmap)

    if "line_id" not in df.columns:
        return {"error": "Kolom 'Line ID' tidak ditemukan", "rows": [], "errors": []}

    rows: list[FillImportRow] = []
    errors: list[dict] = []
    for idx, r in df.iterrows():
        lid = str(r.get("line_id", "")).strip()
        if not lid or lid.lower() in ("nan", "none"):
            continue
        raw_status = str(r.get("status", "")).strip().lower()
        status = "READY" if raw_status in _READY_TRUE else "NOT_READY"
        loc = str(r.get("ut_location", "")).strip()
        loc = loc if loc and loc.lower() not in ("nan", "none") else None
        rows.append(FillImportRow(
            line_id=lid, status=status, ut_location=loc,
            est_date=_parse_import_date(r.get("est_date")),
        ))
    return {"error": None, "rows": rows, "errors": errors}


# ── Read-model aggregation (overview / achievement) ──────────────────────

async def aggregate_period(db: AsyncSession, period: PlanPeriod) -> dict:
    """Count-based readiness for one period, grouped by apl_activity.

    Ignores removed_in_revision lines. Since a period is a single activity,
    the returned dict represents that one activity plus its apl breakdown.
    """
    rows = await db.execute(
        select(
            PlanLine.apl_activity,
            func.count().label("total"),
            func.sum(case((PlanLine.is_ready.is_(True), 1), else_=0)).label("ready"),
        )
        .where(
            PlanLine.period_id == period.id,
            PlanLine.removed_in_revision.is_(False),
        )
        .group_by(PlanLine.apl_activity)
        .order_by(PlanLine.apl_activity)
    )

    apls: list[dict] = []
    total = ready_total = 0
    for r in rows:
        rt = int(r.total)
        rr = int(r.ready or 0)
        total += rt
        ready_total += rr
        apls.append({
            "apl_activity": r.apl_activity,
            "ready": rr,
            "total": rt,
            "pct": round(rr / rt * 100, 1) if rt else 0.0,
        })

    overall = round(ready_total / total * 100, 1) if total else 0.0
    return {
        "activity": period.activity,
        "readiness_pct": overall,
        "ready": ready_total,
        "total": total,
        "apl_activities": apls,
    }


async def _process_activity_group(
    *,
    site: str,
    activity: str,
    rows: list[PlanRow],
    start: date,
    due: date,
    filename: str,
    uploader_id: str,
    db: AsyncSession,
) -> tuple[PeriodUploadResult | None, SkippedPeriod | None]:
    """Merge one activity's rows into its (site, activity, start) period.

    Treats `rows` as the authoritative full snapshot for THIS period only:
    inserts/updates present lines and soft-removes absent ones. A LOCKED
    existing period is skipped (returns a SkippedPeriod) so one stale period
    never blocks the rest of the bundle.
    """
    existing = await db.execute(
        select(PlanPeriod).where(
            PlanPeriod.site == site,
            PlanPeriod.activity == activity,
            PlanPeriod.start_date == start,
        )
    )
    period = existing.scalar_one_or_none()
    is_revision = period is not None

    # LOCKED period → skip this activity, keep processing the bundle (option B).
    if period is not None and period_state(period.due_date) == "LOCKED":
        return None, SkippedPeriod(activity=activity, reason="LOCKED (lewat due date)")

    if period is None:
        period = PlanPeriod(
            id=str(uuid.uuid4()),
            site=site,
            activity=activity,
            start_date=start,
            due_date=due,
            source_filename=filename,
            uploaded_by=uploader_id,
        )
        db.add(period)
        await db.flush()
    else:
        period.revised_at = datetime.now(timezone.utc)
        period.source_filename = filename

    # Aggregate exact-duplicate natural keys within this activity (sum req_qty)
    aggregated: dict[tuple, PlanRow] = {}
    merged = 0
    for r in rows:
        k = _natural_key(r)
        if k in aggregated:
            aggregated[k].req_qty += r.req_qty
            merged += 1
        else:
            # shallow copy so we don't mutate the parser's row
            aggregated[k] = PlanRow(**vars(r))

    existing_lines_res = await db.execute(
        select(PlanLine).where(PlanLine.period_id == period.id)
    )
    existing_lines = {
        (l.egi, l.cn, l.npn, l.apl_activity): l for l in existing_lines_res.scalars().all()
    }

    inserted = updated = 0
    seen_keys: set[tuple] = set()
    now = datetime.now(timezone.utc)

    for k, r in aggregated.items():
        seen_keys.add(k)
        line = existing_lines.get(k)
        if line is None:
            # new line — seed UT status from the file's initial value
            db.add(PlanLine(
                id=str(uuid.uuid4()),
                period_id=period.id,
                egi=r.egi, cn=r.cn, apl_activity=r.apl_activity, npn=r.npn,
                description=r.description or None,
                req_qty=Decimal(str(r.req_qty)),
                req_date=r.req_date,
                status=r.status,
                ut_location=r.ut_location,
                est_date=r.est_date,
                is_ready=(r.status == "READY"),
                removed_in_revision=False,
                updated_by=uploader_id,
            ))
            inserted += 1
        else:
            # existing — update planner-owned fields, PRESERVE UT fields
            line.description = r.description or None
            line.req_qty = Decimal(str(r.req_qty))
            if r.req_date is not None:
                line.req_date = r.req_date
            line.removed_in_revision = False
            line.updated_by = uploader_id
            line.updated_at = now
            updated += 1

    # Lines absent from this file → soft-remove (scoped to this period only)
    removed = 0
    for k, line in existing_lines.items():
        if k not in seen_keys and not line.removed_in_revision:
            line.removed_in_revision = True
            line.updated_at = now
            removed += 1

    return PeriodUploadResult(
        period_id=period.id,
        activity=activity,
        is_revision=is_revision,
        rows_inserted=inserted,
        rows_updated=updated,
        rows_merged=merged,
        rows_marked_removed=removed,
    ), None


async def process_plan_upload(
    file_bytes: bytes,
    filename: str,
    uploader_id: str,
    uploader_site: str,
    all_sites: bool,
    db: AsyncSession,
) -> PlanUploadSummary:
    # 1. Parse (header-based)
    parse = await asyncio.to_thread(parse_plan_file, file_bytes, filename)
    if parse.has_errors and not parse.rows:
        raise HTTPException(status_code=422, detail=parse.errors[0]["reason"])

    # 2. One file = one site (multiple ACTIVITY allowed — processed per period below)
    if len(parse.sites) > 1:
        raise HTTPException(status_code=422, detail=f"File mencampur beberapa site: {', '.join(sorted(parse.sites))}. Upload per-site.")
    if not parse.rows:
        raise HTTPException(status_code=422, detail="Tidak ada baris valid pada file")

    site = next(iter(parse.sites))

    # Site-scope guard: a site-bound uploader (e.g. planner) may only upload
    # for their own site, so they cannot disturb another site's data.
    if not all_sites and site != uploader_site:
        raise HTTPException(
            status_code=403,
            detail=f"File untuk site {site}, Anda hanya bisa upload site {uploader_site}",
        )

    # 3. NPN validation against master (once for the whole file)
    npns = {r.npn for r in parse.rows}
    parts_res = await db.execute(select(Part.part_number).where(Part.part_number.in_(npns)))
    known_npns = set(parts_res.scalars().all())

    errors = list(parse.errors)
    npn_skipped = 0
    valid_rows: list[PlanRow] = []
    for r in parse.rows:
        if r.npn not in known_npns:
            errors.append({"row": r.excel_row, "code": "npn_not_in_master", "npn": r.npn, "reason": f"NPN {r.npn} tidak ada di master"})
            npn_skipped += 1
        else:
            valid_rows.append(r)

    # 4. Group valid rows by ACTIVITY → one period per activity
    groups: dict[str, list[PlanRow]] = {}
    for r in valid_rows:
        groups.setdefault(r.activity, []).append(r)

    start, due = period_window(now_wib())

    # 5. Process each activity group; single commit happens in the router (atomic)
    periods: list[PeriodUploadResult] = []
    skipped_periods: list[SkippedPeriod] = []
    for activity in sorted(groups):
        result, skipped = await _process_activity_group(
            site=site,
            activity=activity,
            rows=groups[activity],
            start=start,
            due=due,
            filename=filename,
            uploader_id=uploader_id,
            db=db,
        )
        if result is not None:
            periods.append(result)
        if skipped is not None:
            skipped_periods.append(skipped)

    return PlanUploadSummary(
        site=site,
        start_date=start,
        due_date=due,
        rows_total=parse.total,
        rows_inserted=sum(p.rows_inserted for p in periods),
        rows_updated=sum(p.rows_updated for p in periods),
        rows_merged=sum(p.rows_merged for p in periods),
        rows_skipped=parse.skipped + npn_skipped,
        rows_marked_removed=sum(p.rows_marked_removed for p in periods),
        periods=periods,
        skipped_periods=skipped_periods,
        errors=errors,
    )
