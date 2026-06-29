"""Single source of truth for scheduled-plan origin (BASELINE/EXTRA) visibility.

Centralised here so that changing the visibility rule means editing exactly
one function, not grep-patching multiple routers and services.

DELTA3 changes:
  - Supplier (can_fill_scheduled_plan) now sees BASELINE + EXTRA — both are
    fillable and both count toward readiness %.
  - The `include_extra` toggle is for admin views that want a "baseline only"
    view of readiness numbers; it has no effect on supplier visibility.
"""
import sqlalchemy as sa
from app.core.auth import Principal
from app.models.plan_line import PlanLine


def apply_origin_scope(principal: Principal, include_extra: bool = True) -> sa.ColumnElement:
    """Return a SQLAlchemy WHERE clause restricting PlanLine rows by origin.

    Evaluated in role priority order:
      admin (can_view_plan_achievement | can_manage_plan_event):
            all lines; `include_extra=False` restricts to BASELINE only.
      planner (can_manage_scheduled_plan):
            BASELINE + own EXTRA; `include_extra=False` restricts to BASELINE.
      supplier (can_fill_scheduled_plan):
            BASELINE + EXTRA (both are fillable as of DELTA3). The toggle is
            ignored for supplier — they have no reason to exclude EXTRA.
      everyone else: BASELINE only.
    """
    perms = principal.permissions
    if "can_view_plan_achievement" in perms or "can_manage_plan_event" in perms:
        if not include_extra:
            return PlanLine.origin == PlanLine.ORIGIN_BASELINE
        return sa.true()
    if "can_manage_scheduled_plan" in perms:
        if not include_extra:
            return PlanLine.origin == PlanLine.ORIGIN_BASELINE
        return sa.or_(
            PlanLine.origin == PlanLine.ORIGIN_BASELINE,
            PlanLine.created_by == principal.id,
        )
    if "can_fill_scheduled_plan" in perms:
        return sa.true()
    return PlanLine.origin == PlanLine.ORIGIN_BASELINE
