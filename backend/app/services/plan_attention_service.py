"""Attention digest (DELTA3 section C) — aggregates existing collaboration
and readiness signals into one prioritized list per role.

Purely computed-on-read: no new columns, no cron. Reuses
plan_collaboration_service.build_coordination (coordination_status, unread_
for_me) and plan_service.list_accessible_periods/period_state — this module
never recomputes that logic, only aggregates and sorts it.
"""
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.models.plan_line import PlanLine
from app.models.plan_period import PlanPeriod
from app.services.plan_service import list_accessible_periods, now_wib, period_state
from app.services.plan_collaboration_service import build_coordination
from app.services.plan_transition_service import get_blockers
from app.schemas.plan import AttentionItem

# Only periods still relevant to "what needs attention now" are considered —
# OPEN periods plus anything LOCKED within the last 2 weeks. Long-closed
# periods don't need a digest entry.
_RELEVANCE_WINDOW_DAYS = 14
_LOCK_WARNING_DAYS = 7

_PRIORITY = {
    "NEEDS_REVISION": 4,
    "TRANSITION_BLOCKERS": 4,   #  carryover blockers need admin action
    "EVENT_NEARING_LOCK": 3,
    "UNFILLED_ITEMS": 3,
    "UNREAD_SUPPLIER_UPDATE": 2,
    "UNREAD_PLANNER_REVISION": 2,
    "EXTRA_ITEMS_PENDING": 1,
}


def _days_remaining(due_date) -> int:
    return (due_date - now_wib().date()).days


def _link(period_id: str, apl_activity: str | None, *, role: str) -> str:
    base = {
        "planner": "/inquiry/scheduled",
        "supplier": "/supplier/plan-fill",
        "admin": "/scheduled-plan/overview",
    }[role]
    if apl_activity:
        return f"{base}?period={period_id}&apl={apl_activity}"
    return f"{base}?period={period_id}"


async def build_attention(db: AsyncSession, principal: Principal) -> list[AttentionItem]:
    perms = principal.permissions
    is_planner = "can_manage_scheduled_plan" in perms
    is_supplier = "can_fill_scheduled_plan" in perms
    is_admin = "can_view_plan_achievement" in perms or "can_manage_plan_event" in perms

    periods = await list_accessible_periods(db, principal)
    today = now_wib().date()
    periods = [p for p in periods if (today - p.due_date).days <= _RELEVANCE_WINDOW_DAYS]

    items: list[AttentionItem] = []

    for period in periods:
        days_remaining = _days_remaining(period.due_date)

        if is_planner:
            coordination = await build_coordination(db, period, viewer_id=principal.id, viewer_side="planner")
            for c in coordination:
                if c.needs_revision_count > 0:
                    items.append(AttentionItem(
                        type="NEEDS_REVISION", period_id=period.id, period_name=period.name,
                        site=period.site, apl_activity=c.apl_activity, count=c.needs_revision_count,
                        link=_link(period.id, c.apl_activity, role="planner"),
                    ))
                if c.unread_for_me > 0:
                    items.append(AttentionItem(
                        type="UNREAD_SUPPLIER_UPDATE", period_id=period.id, period_name=period.name,
                        site=period.site, apl_activity=c.apl_activity, count=c.unread_for_me,
                        link=_link(period.id, c.apl_activity, role="planner"),
                    ))

        if is_supplier:
            coordination = await build_coordination(db, period, viewer_id=principal.id, viewer_side="supplier")
            for c in coordination:
                if c.unread_for_me > 0:
                    items.append(AttentionItem(
                        type="UNREAD_PLANNER_REVISION", period_id=period.id, period_name=period.name,
                        site=period.site, apl_activity=c.apl_activity, count=c.unread_for_me,
                        link=_link(period.id, c.apl_activity, role="supplier"),
                    ))
            if days_remaining <= _LOCK_WARNING_DAYS:
                #  EXTRA lines are now fillable — count all non-cancelled lines.
                unfilled = (await db.execute(
                    select(func.count()).where(
                        PlanLine.period_id == period.id,
                        PlanLine.removed_in_revision.is_(False),
                        PlanLine.is_cancelled.is_(False),
                        PlanLine.is_ready.is_(False),
                    )
                )).scalar_one() or 0
                if unfilled:
                    items.append(AttentionItem(
                        type="UNFILLED_ITEMS", period_id=period.id, period_name=period.name,
                        site=period.site, count=int(unfilled), days_remaining=days_remaining,
                        link=_link(period.id, None, role="supplier"),
                    ))

        if is_admin:
            if 0 <= days_remaining <= _LOCK_WARNING_DAYS:
                items.append(AttentionItem(
                    type="EVENT_NEARING_LOCK", period_id=period.id, period_name=period.name,
                    site=period.site, days_remaining=days_remaining,
                    link=_link(period.id, None, role="admin"),
                ))
            extra = (await db.execute(
                select(func.count()).where(
                    PlanLine.period_id == period.id,
                    PlanLine.removed_in_revision.is_(False),
                    PlanLine.is_cancelled.is_(False),
                    PlanLine.origin == PlanLine.ORIGIN_EXTRA,
                )
            )).scalar_one() or 0
            if extra:
                items.append(AttentionItem(
                    type="EXTRA_ITEMS_PENDING", period_id=period.id, period_name=period.name,
                    site=period.site, count=int(extra),
                    link=_link(period.id, None, role="admin"),
                ))
            #  carryover blockers for LOCKED events that need admin decision
            if period_state(period.due_date) == "LOCKED":
                blockers = await get_blockers(db, period.id)
                if blockers:
                    items.append(AttentionItem(
                        type="TRANSITION_BLOCKERS", period_id=period.id, period_name=period.name,
                        site=period.site, count=len(blockers),
                        link=f"/scheduled-plan/overview?period={period.id}&tab=blockers",
                    ))

    items.sort(key=lambda it: (-_PRIORITY.get(it.type, 0), it.days_remaining if it.days_remaining is not None else 999))
    return items
