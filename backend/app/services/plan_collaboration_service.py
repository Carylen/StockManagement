"""Single source of truth for scheduled-plan collaboration signals.

Everything here is computed-on-read from existing data (plan lines + line history
+ revisions + per-user seen watermark). No new columns, no cron/queue.

Field ownership (also the basis for "counterpart" detection):
  - planner-owned  : req_date
  - supplier-owned : ut_location, est_date (status is derived, not owned input)
"""
from datetime import datetime, date as date_

import sqlalchemy as sa
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.models.plan_line import PlanLine
from app.models.plan_line_history import PlanLineHistory
from app.models.plan_period import PlanPeriod
from app.models.plan_revision import PlanRevision
from app.models.plan_scope_seen import PlanScopeSeen
from app.schemas.plan import PlanLineOut, CoordinationItem

SUPPLIER_FIELDS = {"status", "ut_location", "est_date"}
PLANNER_FIELDS = {"req_date"}

READY_LITERAL = "READY"


# ── Readiness (derived from ut_location + est_date, never a direct input) ─
def derive_readiness(ut_location: str | None, est_date: date_ | None) -> tuple[str, bool]:
    """A line is ready iff ut_location is exactly the literal "ready"
    (case-insensitive) AND est_date is filled in. ut_location may otherwise
    hold any free-form location text (e.g. "KMSI BJM"), but only the literal
    match counts as ready. Returns (status, is_ready) — `status` stays a
    stored column for existing filters/badges, always re-derived here."""
    is_ready = (ut_location or "").strip().lower() == "ready" and est_date is not None
    return (READY_LITERAL if is_ready else "NOT_READY"), is_ready


# ── Origin (BASELINE/EXTRA) visibility ────────────────────────────────────
def origin_visibility_clause(principal: Principal, include_extra: bool = True):
    """SQLAlchemy WHERE clause restricting PlanLine rows to what `principal`
    may see:
      - admin (can_view_plan_achievement): BASELINE + EXTRA (all), unless
        `include_extra=False` (their own "hide extra" toggle).
      - planner (can_manage_scheduled_plan): BASELINE + their own EXTRA only
        — they can't see another planner's secret additions.
      - everyone else (supplier, etc.): BASELINE only, always.
    """
    perms = principal.permissions
    if "can_view_plan_achievement" in perms:
        return sa.true() if include_extra else PlanLine.origin == PlanLine.ORIGIN_BASELINE
    if "can_manage_scheduled_plan" in perms:
        return sa.or_(PlanLine.origin == PlanLine.ORIGIN_BASELINE, PlanLine.created_by == principal.id)
    return PlanLine.origin == PlanLine.ORIGIN_BASELINE


# ── Per-line derived flags ───────────────────────────────────────────────
def line_at_risk(line: PlanLine) -> bool:
    """A line is at risk while it is not yet ready."""
    return not line.is_ready


def line_needs_planner_revision(line: PlanLine) -> bool:
    """Supplier's estimate is later than the requested date → planner should revise."""
    return line.req_date is not None and line.est_date is not None and line.est_date > line.req_date


def to_line_out(line: PlanLine) -> PlanLineOut:
    """Build the API line model with collaboration flags filled in. Reused by
    every endpoint that returns plan lines so the flags are never duplicated."""
    out = PlanLineOut.model_validate(line)
    out.at_risk = line_at_risk(line)
    out.needs_planner_revision = line_needs_planner_revision(line)
    return out


# ── Per-scope coordination summary ───────────────────────────────────────
async def build_coordination(
    db: AsyncSession,
    period: PlanPeriod,
    viewer_id: str,
    viewer_side: str,  # "planner" | "supplier"
) -> list[CoordinationItem]:
    """Return one CoordinationItem per apl_activity in the period.

    coordination_status is evaluated in order:
      1. READY                   — every non-removed line is_ready
      2. NEEDS_PLANNER_REVISION  — any line with est_date > req_date
      3. SUPPLIER_RESPONDED      — latest supplier-field change newer than last revision
      4. AWAITING_SUPPLIER       — otherwise
    """
    counterpart = SUPPLIER_FIELDS if viewer_side == "planner" else PLANNER_FIELDS

    # BASELINE only — EXTRA lines aren't visible to/fillable by the supplier,
    # so they have no coordination story to tell here.
    lines = (await db.execute(
        select(PlanLine).where(
            PlanLine.period_id == period.id,
            PlanLine.removed_in_revision.is_(False),
            PlanLine.origin == PlanLine.ORIGIN_BASELINE,
        )
    )).scalars().all()

    by_apl: dict[str, list[PlanLine]] = {}
    for line in lines:
        by_apl.setdefault(line.apl_activity, []).append(line)

    # Last revision per apl_activity.
    rev_rows = (await db.execute(
        select(
            PlanRevision.apl_activity,
            func.max(PlanRevision.revision_no),
            func.max(PlanRevision.revised_at),
        )
        .where(PlanRevision.period_id == period.id)
        .group_by(PlanRevision.apl_activity)
    )).all()
    last_rev: dict[str, tuple[int, datetime]] = {apl: (rno, rat) for apl, rno, rat in rev_rows}

    # This viewer's last-seen watermark per apl_activity.
    seen_rows = (await db.execute(
        select(PlanScopeSeen.apl_activity, PlanScopeSeen.last_seen_at)
        .where(PlanScopeSeen.user_id == viewer_id, PlanScopeSeen.period_id == period.id)
    )).all()
    last_seen: dict[str, datetime] = {apl: ts for apl, ts in seen_rows}

    # History for this period (joined to lines to get the scope's apl_activity).
    hist_rows = (await db.execute(
        select(PlanLine.apl_activity, PlanLineHistory.field, PlanLineHistory.changed_at)
        .join(PlanLine, PlanLine.id == PlanLineHistory.line_id)
        .where(PlanLine.period_id == period.id)
    )).all()

    latest_supplier_change: dict[str, datetime] = {}
    unread: dict[str, int] = {}
    for apl, field, changed_at in hist_rows:
        if field in SUPPLIER_FIELDS:
            cur = latest_supplier_change.get(apl)
            if cur is None or changed_at > cur:
                latest_supplier_change[apl] = changed_at
        if field in counterpart:
            seen = last_seen.get(apl)
            if seen is None or changed_at > seen:
                unread[apl] = unread.get(apl, 0) + 1

    items: list[CoordinationItem] = []
    for apl, group in sorted(by_apl.items()):
        total = len(group)
        ready = sum(1 for line in group if line.is_ready)
        at_risk = sum(1 for line in group if line_at_risk(line))
        needs_rev = sum(1 for line in group if line_needs_planner_revision(line))
        pct = round(ready / total * 100, 1) if total else 0.0
        rno, rat = last_rev.get(apl, (None, None))

        if total > 0 and ready == total:
            status = "READY"
        elif needs_rev > 0:
            status = "NEEDS_PLANNER_REVISION"
        else:
            lsc = latest_supplier_change.get(apl)
            if lsc is not None and (rat is None or lsc > rat):
                status = "SUPPLIER_RESPONDED"
            else:
                status = "AWAITING_SUPPLIER"

        items.append(CoordinationItem(
            apl_activity=apl,
            coordination_status=status,
            readiness_pct=pct,
            unread_for_me=unread.get(apl, 0),
            at_risk_count=at_risk,
            needs_revision_count=needs_rev,
            last_revision_no=rno,
            last_revision_at=rat,
        ))
    return items
