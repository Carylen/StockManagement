"""
Service layer for the Scheduled-Plan module.

Responsibilities:
  - derive period state (OPEN/LOCKED) from due_date — no cron
  - merge uploaded rows into an admin-created event/period (additive — never
    soft-removes a line just because a later upload omits it)
  - aggregate exact-duplicate natural keys within one file (sum req_qty)

Periods ("events") are created explicitly by admin with manual dates — there
is no more day-5/upload-timestamp derivation. See plan_collaboration_service
for origin (BASELINE/EXTRA) visibility and readiness-from-ut_location rules.
"""
import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.plan_period import PlanPeriod
from app.models.plan_line import PlanLine
from app.models.plan_line_history import PlanLineHistory
from app.models.permission import SupplierSite
from app.services.plan_parser import parse_plan_file, PlanRow, PlanParseResult, COLUMN_ALIASES

WIB = timezone(timedelta(hours=7))


# ── Period state ──────────────────────────────────────────────────────────

def now_wib() -> datetime:
    return datetime.now(WIB)


def period_state(due: date, ref: datetime | None = None) -> str:
    ref = ref or now_wib()
    return "OPEN" if ref.date() <= due else "LOCKED"


# ── Upload result ─────────────────────────────────────────────────────────

@dataclass
class PlanRowMergeResult:
    rows_total: int
    rows_inserted: int
    rows_updated: int
    rows_merged: int
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
# Readiness is derived from ut_location + est_date (see plan_collaboration_
# service.derive_readiness) — the supplier never sends a separate status
# value, and the fill file never carries a Status column. Rows are matched
# by natural key (egi, cn, apl_activity, npn) — the same key used everywhere
# else in this module — not by an internal row id, so the column aliases for
# those four fields are reused straight from plan_parser.COLUMN_ALIASES.

_FILL_ALIASES = {
    **{k: v for k, v in COLUMN_ALIASES.items() if k in ("egi", "cn", "apl_activity", "npn")},
    "ut_location": ["ut location", "ut_location", "location", "lokasi"],
    "est_date":    ["est date", "est_date", "estimasi", "estimated date", "tanggal estimasi"],
}
_FILL_KEY_COLUMNS = ("egi", "cn", "apl_activity", "npn")


@dataclass
class FillImportRow:
    egi: str
    cn: str
    apl_activity: str
    npn: str
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
    """Parse a supplier fill file (xlsx/csv). Matches lines by natural key
    (egi, cn, apl_activity, npn)."""
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

    missing = [c for c in _FILL_KEY_COLUMNS if c not in df.columns]
    if missing:
        return {
            "error": f"Kolom {', '.join(c.upper() for c in missing)} tidak ditemukan",
            "rows": [], "errors": [],
        }

    rows: list[FillImportRow] = []
    errors: list[dict] = []
    for idx, r in df.iterrows():
        egi = str(r.get("egi", "")).strip().upper()
        cn = str(r.get("cn", "")).strip().upper()
        apl = str(r.get("apl_activity", "")).strip().upper()
        npn = str(r.get("npn", "")).strip().upper()
        if not (egi and cn and apl and npn) or npn.lower() in ("nan", "none"):
            continue
        loc = str(r.get("ut_location", "")).strip()
        loc = loc if loc and loc.lower() not in ("nan", "none") else None
        rows.append(FillImportRow(
            egi=egi, cn=cn, apl_activity=apl, npn=npn,
            ut_location=loc, est_date=_parse_import_date(r.get("est_date")),
        ))
    return {"error": None, "rows": rows, "errors": errors}


# ── Accessible periods (site scoping) ─────────────────────────────────────

async def list_accessible_periods(db: AsyncSession, principal, site: str | None = None) -> list[PlanPeriod]:
    """Periods visible to `principal`: planner/admin (can_manage_scheduled_plan,
    can_view_plan_achievement, can_manage_plan_event) see all sites (optionally
    narrowed by `site`); everyone else (supplier) sees only their assigned
    sites. Single source of truth for this scoping — used by both the
    `/periods` list endpoint and the attention digest so they never drift."""
    q = select(PlanPeriod)
    if site:
        q = q.where(PlanPeriod.site == site)

    perms = principal.permissions
    if not any(p in perms for p in ("can_manage_scheduled_plan", "can_view_plan_achievement", "can_manage_plan_event")):
        assigned = (await db.execute(
            select(SupplierSite.site_code).where(SupplierSite.supplier_id == principal.id)
        )).scalars().all()
        q = q.where(PlanPeriod.site.in_(assigned or ["__none__"]))

    q = q.order_by(PlanPeriod.start_date.desc())
    return (await db.execute(q)).scalars().all()


# ── Read-model aggregation (overview / achievement) ──────────────────────

async def aggregate_period(
    db: AsyncSession,
    period: PlanPeriod,
    include_extra: bool = True,
) -> list[dict]:
    """Count-based readiness for one event, grouped by activity then apl_activity.

     EXTRA lines now count toward readiness by default. Admin can pass
    include_extra=False for a "baseline only" view. Ignores removed/cancelled lines.
    """
    where_clauses = [
        PlanLine.period_id == period.id,
        PlanLine.removed_in_revision.is_(False),
        PlanLine.is_cancelled.is_(False),
    ]
    if not include_extra:
        where_clauses.append(PlanLine.origin == PlanLine.ORIGIN_BASELINE)

    rows = await db.execute(
        select(
            PlanLine.activity,
            PlanLine.apl_activity,
            func.count().label("total"),
            func.sum(case((PlanLine.is_ready.is_(True), 1), else_=0)).label("ready"),
        )
        .where(*where_clauses)
        .group_by(PlanLine.activity, PlanLine.apl_activity)
        .order_by(PlanLine.activity, PlanLine.apl_activity)
    )

    by_activity: dict[str, dict] = {}
    for r in rows:
        act = by_activity.setdefault(r.activity, {
            "activity": r.activity, "ready": 0, "total": 0, "apl_activities": [],
        })
        rt, rr = int(r.total), int(r.ready or 0)
        act["ready"] += rr
        act["total"] += rt
        act["apl_activities"].append({
            "apl_activity": r.apl_activity, "ready": rr, "total": rt,
            "pct": round(rr / rt * 100, 1) if rt else 0.0,
        })

    out = list(by_activity.values())
    for act in out:
        act["readiness_pct"] = round(act["ready"] / act["total"] * 100, 1) if act["total"] else 0.0
    return out


@dataclass
class PlanRowDiff:
    """Pure read-only classification of parsed rows against `period`'s
    current lines — no DB mutation. Shared by merge_plan_lines (direct
    commit) and the upload-preview session (DELTA3) so both use the exact
    same matching algorithm."""
    inserted: list[PlanRow]
    updated: list[tuple[PlanLine, PlanRow]]
    rows_merged: int
    rows_total: int


async def diff_plan_rows(
    *,
    period: PlanPeriod,
    rows: list[PlanRow],
    db: AsyncSession,
) -> PlanRowDiff:
    """Classify parsed rows against `period`'s existing lines by natural key
    (egi, cn, npn, apl_activity), aggregating exact-duplicate keys within the
    file (sum req_qty). Read-only — callers decide what to do with the result.
    """
    aggregated: dict[tuple, PlanRow] = {}
    merged = 0
    for r in rows:
        k = _natural_key(r)
        if k in aggregated:
            aggregated[k].req_qty += r.req_qty
            merged += 1
        else:
            aggregated[k] = PlanRow(**vars(r))  # shallow copy, don't mutate the parser's row

    existing_lines_res = await db.execute(
        select(PlanLine).where(PlanLine.period_id == period.id)
    )
    existing_lines = {
        (l.egi, l.cn, l.npn, l.apl_activity): l for l in existing_lines_res.scalars().all()
    }

    inserted: list[PlanRow] = []
    updated: list[tuple[PlanLine, PlanRow]] = []
    for k, r in aggregated.items():
        line = existing_lines.get(k)
        if line is None:
            inserted.append(r)
        else:
            updated.append((line, r))

    return PlanRowDiff(inserted=inserted, updated=updated, rows_merged=merged, rows_total=len(rows))


async def merge_plan_lines(
    *,
    period: PlanPeriod,
    rows: list[PlanRow],
    origin: str,
    actor_id: str,
    db: AsyncSession,
) -> PlanRowMergeResult:
    """Merge parsed rows into `period` — additive: a line already in the
    period is never removed just because a later upload omits it (admin
    baseline and planner extras both accumulate over time). A row matching an
    existing natural key (egi, cn, npn, apl_activity) updates that line's
    planner-owned fields in place and keeps its original `origin`/creator; a
    new natural key is inserted with `origin`/`created_by` set to this call's
    actor.
    """
    diff = await diff_plan_rows(period=period, rows=rows, db=db)
    now = datetime.now(timezone.utc)

    for r in diff.inserted:
        db.add(PlanLine(
            id=str(uuid.uuid4()),
            period_id=period.id,
            activity=r.activity, egi=r.egi, cn=r.cn, apl_activity=r.apl_activity, npn=r.npn,
            description=r.description or None,
            req_qty=Decimal(str(r.req_qty)),
            req_date=r.req_date,
            status=r.status,
            ut_location=r.ut_location,
            est_date=r.est_date,
            is_ready=(r.status == "READY"),
            origin=origin,
            created_by=actor_id,
            updated_by=actor_id,
        ))
    for line, r in diff.updated:
        # existing — update planner-owned fields, PRESERVE UT fields + origin
        line.activity = r.activity
        line.description = r.description or None
        line.req_qty = Decimal(str(r.req_qty))
        if r.req_date is not None:
            line.req_date = r.req_date
        line.removed_in_revision = False
        line.updated_by = actor_id
        line.updated_at = now

    return PlanRowMergeResult(
        rows_total=diff.rows_total, rows_inserted=len(diff.inserted),
        rows_updated=len(diff.updated), rows_merged=diff.rows_merged,
    )


async def parse_and_validate_plan_file(
    *,
    file_bytes: bytes,
    filename: str,
    period: PlanPeriod,
) -> PlanParseResult:
    """Parse a scheduled-plan Excel and validate it against `period` (single
    site, must match the period's site). Raises HTTPException on parse/
    validation failure. NPN is intentionally not validated against the parts
    master. Shared by the direct-merge path and the upload-preview path so
    both apply identical validation."""
    parse = await asyncio.to_thread(parse_plan_file, file_bytes, filename)
    if parse.has_errors and not parse.rows:
        raise HTTPException(status_code=422, detail=parse.errors[0]["reason"])
    if not parse.rows:
        raise HTTPException(status_code=422, detail="Tidak ada baris valid pada file")
    if len(parse.sites) > 1:
        raise HTTPException(
            status_code=422,
            detail=f"File mencampur beberapa site: {', '.join(sorted(parse.sites))}. Upload per-site.",
        )
    file_site = next(iter(parse.sites))
    if file_site != period.site:
        raise HTTPException(
            status_code=422,
            detail=f"File untuk site {file_site}, event ini untuk site {period.site}",
        )
    return parse


async def parse_and_merge_plan_file(
    *,
    file_bytes: bytes,
    filename: str,
    period: PlanPeriod,
    origin: str,
    actor_id: str,
    db: AsyncSession,
) -> PlanRowMergeResult:
    """Parse + validate, then merge every row into `period` (single event,
    multi-activity — ACTIVITY is just a per-line attribute now)."""
    parse = await parse_and_validate_plan_file(file_bytes=file_bytes, filename=filename, period=period)
    result = await merge_plan_lines(period=period, rows=parse.rows, origin=origin, actor_id=actor_id, db=db)
    result.errors = list(parse.errors)
    period.source_filename = filename
    period.revised_at = datetime.now(timezone.utc)
    return result


async def parse_and_diff_plan_file(
    *,
    file_bytes: bytes,
    filename: str,
    period: PlanPeriod,
    db: AsyncSession,
) -> tuple[PlanRowDiff, PlanParseResult]:
    """Parse + validate, then classify rows against `period` WITHOUT writing
    to plan_lines — used by the upload-preview session (DELTA3)."""
    parse = await parse_and_validate_plan_file(file_bytes=file_bytes, filename=filename, period=period)
    diff = await diff_plan_rows(period=period, rows=parse.rows, db=db)
    return diff, parse


# ── Upload-session row (de)serialization — JSON-safe round trip of a
# parsed PlanRow, used to persist preview sessions and rehydrate them at
# confirm time (so confirm can re-run merge_plan_lines against the period's
# *current* state rather than replaying a stale classification). ──────────

def _row_to_dict(r: PlanRow) -> dict:
    return {
        "excel_row": r.excel_row, "distrik": r.distrik, "egi": r.egi, "cn": r.cn,
        "activity": r.activity, "apl_activity": r.apl_activity, "npn": r.npn,
        "description": r.description, "req_qty": r.req_qty, "status": r.status,
        "ut_location": r.ut_location,
        "req_date": r.req_date.isoformat() if r.req_date else None,
        "est_date": r.est_date.isoformat() if r.est_date else None,
    }


def _row_from_dict(d: dict) -> PlanRow:
    return PlanRow(
        excel_row=d["excel_row"], distrik=d["distrik"], egi=d["egi"], cn=d["cn"],
        activity=d["activity"], apl_activity=d["apl_activity"], npn=d["npn"],
        description=d["description"], req_qty=d["req_qty"], status=d["status"],
        ut_location=d.get("ut_location"),
        req_date=date.fromisoformat(d["req_date"]) if d.get("req_date") else None,
        est_date=date.fromisoformat(d["est_date"]) if d.get("est_date") else None,
    )
