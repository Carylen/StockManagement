"""Single source of truth for scheduled-plan collaboration signals.

Everything here is computed-on-read from existing data (plan lines + line history
+ revisions + per-user seen watermark). No new columns, no cron/queue.

Field ownership (also the basis for "counterpart" detection):
  - planner-owned  : req_date
  - supplier-owned : status, ut_location, est_date
"""
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plan_line import PlanLine
from app.models.plan_line_history import PlanLineHistory
from app.models.plan_period import PlanPeriod
from app.models.plan_revision import PlanRevision
from app.models.plan_scope_seen import PlanScopeSeen
from app.schemas.plan import PlanLineOut, CoordinationItem

SUPPLIER_FIELDS = {"status", "ut_location", "est_date"}
PLANNER_FIELDS = {"req_date"}


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

    lines = (await db.execute(
        select(PlanLine).where(
            PlanLine.period_id == period.id,
            PlanLine.removed_in_revision.is_(False),
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
