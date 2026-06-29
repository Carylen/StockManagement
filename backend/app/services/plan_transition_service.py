"""Event-transition service: carryover cloning + blocker gate.

This is the ONLY place that contains:
  - the is_blocker() formula (§3 of DELTA3_EXTRA_CARRYOVER.md)
  - the execute_carryover() clone operation

Router endpoints for badge, dashboard panel, and hard gate all call
get_blockers() from here — never re-compute the logic themselves.

No new infrastructure: computed-on-read, no cron/queue/Redis.
"""
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plan_line import PlanLine
from app.models.plan_period import PlanPeriod
from app.services.plan_service import period_state, record_history

# Maximum times a line can be carried over before admin must re-decide.
MAX_CARRYOVER_PERIODS: int = 3

BlockerReason = Literal["FIRST_TIME_EXTRA", "THRESHOLD_REACHED"]


@dataclass
class BlockerItem:
    line_id: str
    origin: str
    reason: BlockerReason
    egi: str
    cn: str
    apl_activity: str
    npn: str
    carryover_count: int


def is_blocker(line: PlanLine) -> BlockerReason | None:
    """Formula §3 — single implementation used by everything.

    is_blocker(line) =
        line.is_ready == False
        AND line.is_cancelled == False
        AND line.carryover_override == False
        AND (
            line.carryover_count >= MAX_CARRYOVER_PERIODS    -- threshold
            OR (line.origin == EXTRA AND line.carryover_count == 0)  -- first-time EXTRA
        )

    Returns the reason string or None if this line is not a blocker.
    """
    if line.is_ready or line.is_cancelled or line.carryover_override:
        return None
    if line.carryover_count >= MAX_CARRYOVER_PERIODS:
        return "THRESHOLD_REACHED"
    if line.origin == PlanLine.ORIGIN_EXTRA and line.carryover_count == 0:
        return "FIRST_TIME_EXTRA"
    return None


async def get_blockers(
    db: AsyncSession,
    event_id: str | None = None,
) -> list[BlockerItem]:
    """Return all carryover blockers for one or all LOCKED events.

    event_id=None → scans every LOCKED period (used by badge + panel).
    event_id=<id> → scans only that period (used by hard gate at create-event).

    Always uses the same is_blocker() formula — no branching.
    """
    q = (
        select(PlanLine, PlanPeriod)
        .join(PlanPeriod, PlanLine.period_id == PlanPeriod.id)
        .where(
            PlanLine.removed_in_revision.is_(False),
            PlanLine.is_ready.is_(False),
            PlanLine.is_cancelled.is_(False),
        )
    )
    if event_id:
        q = q.where(PlanLine.period_id == event_id)

    rows = (await db.execute(q)).all()

    blockers: list[BlockerItem] = []
    for line, period in rows:
        # When scanning all events, restrict to LOCKED periods only.
        if not event_id and period_state(period.due_date) != "LOCKED":
            continue
        reason = is_blocker(line)
        if reason:
            blockers.append(BlockerItem(
                line_id=line.id,
                origin=line.origin,
                reason=reason,
                egi=line.egi,
                cn=line.cn,
                apl_activity=line.apl_activity,
                npn=line.npn,
                carryover_count=line.carryover_count,
            ))
    return blockers


async def execute_carryover(
    db: AsyncSession,
    source_period: PlanPeriod,
    new_period: PlanPeriod,
    actor_id: str,
) -> int:
    """Clone all carryover-eligible lines from source_period into new_period.

    Call ONLY after get_blockers() returned an empty list — this function
    trusts the caller has verified the gate is clear.

    Clone rules per §3:
      - Only not-ready, not-cancelled, not-removed lines are candidates.
      - carryover_count incremented by 1.
      - carryover_override always reset to False (one-shot permit).
      - origin preserved (EXTRA stays EXTRA, BASELINE stays BASELINE).
      - ut_location and est_date cleared (new fill cycle).
      - req_date carried over as-is (planner can revise in new event).
      - carried_over_from_line_id set to the source line's id.

    Returns the number of lines cloned.
    """
    candidates = (await db.execute(
        select(PlanLine).where(
            PlanLine.period_id == source_period.id,
            PlanLine.removed_in_revision.is_(False),
            PlanLine.is_ready.is_(False),
            PlanLine.is_cancelled.is_(False),
        )
    )).scalars().all()

    cloned = 0
    for src in candidates:
        db.add(PlanLine(
            id=str(uuid.uuid4()),
            period_id=new_period.id,
            activity=src.activity,
            egi=src.egi,
            cn=src.cn,
            apl_activity=src.apl_activity,
            npn=src.npn,
            description=src.description,
            req_qty=src.req_qty,
            req_date=src.req_date,
            origin=src.origin,
            status="NOT_READY",
            ut_location=None,
            est_date=None,
            is_ready=False,
            removed_in_revision=False,
            created_by=actor_id,
            updated_by=actor_id,
            carried_over_from_line_id=src.id,
            carryover_count=src.carryover_count + 1,
            carryover_override=False,
        ))
        cloned += 1

    return cloned


def record_cancel(
    db: AsyncSession,
    line: PlanLine,
    reason: str,
    actor_id: str,
) -> None:
    """Apply cancellation to a line and write history. Idempotent if already cancelled."""
    if line.is_cancelled:
        return
    now = datetime.now(timezone.utc)
    record_history(db, line.id, "is_cancelled", "false", "true", actor_id)
    record_history(db, line.id, "cancelled_reason", None, reason, actor_id)
    line.is_cancelled = True
    line.cancelled_reason = reason
    line.cancelled_by = actor_id
    line.cancelled_at = now
    line.updated_by = actor_id


def record_promote(
    db: AsyncSession,
    line: PlanLine,
    actor_id: str,
) -> None:
    """Promote an EXTRA line to BASELINE. Writes history."""
    if line.origin == PlanLine.ORIGIN_BASELINE:
        return
    record_history(db, line.id, "origin", PlanLine.ORIGIN_EXTRA, PlanLine.ORIGIN_BASELINE, actor_id)
    line.origin = PlanLine.ORIGIN_BASELINE
    line.updated_by = actor_id


def record_carryover_override(
    db: AsyncSession,
    line: PlanLine,
    note: str | None,
    actor_id: str,
) -> None:
    """Set carryover_override=True on a blocked line. Writes history."""
    record_history(db, line.id, "carryover_override", "false", "true", actor_id)
    if note:
        record_history(db, line.id, "carryover_override_note", None, note, actor_id)
    line.carryover_override = True
    line.updated_by = actor_id
