import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import String, Text, Date, DateTime, Boolean, Numeric, Integer, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class PlanLine(Base):
    """One planned part line, grain = unit (egi+cn) × work-package (apl_activity) × part (npn).

    Natural key = (period_id, egi, cn, npn, apl_activity) — apl_activity is part
    of the grain because real uploads carry the same (egi,cn,npn) under
    different apl_activity values. `is_ready` is always re-derived from
    `ut_location` and `est_date` on write (never set manually) — see
    plan_collaboration_service.derive_readiness.

    `origin` tracks who introduced the line: BASELINE = admin-authored (the
    agreed scope), EXTRA = added by a planner outside that agreement. As of
    DELTA3, origin is pure metadata — EXTRA is visible to supplier/fill same
    as BASELINE. Only the carryover gate (plan_transition_service) still
    distinguishes between them.

    Carryover lineage columns (added DELTA3):
      carried_over_from_line_id — self-FK to the source line (null if original)
      carryover_count           — how many times this line has been carried over
      is_cancelled              — admin cancelled this line (stops carryover)
      cancelled_reason          — free-text reason for cancellation
      cancelled_by              — FK to the admin who cancelled
      cancelled_at              — when cancelled
      carryover_override        — one-shot admin permit to carry despite a blocker;
                                  always reset to False after a successful clone
    """
    __tablename__ = "tb_t_plan_lines"

    ORIGIN_BASELINE = "BASELINE"
    ORIGIN_EXTRA = "EXTRA"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_t_plan_periods.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # ── planner-owned (from upload) ──────────────────────────────────────
    activity: Mapped[str] = mapped_column(String(20), nullable=False)
    egi: Mapped[str] = mapped_column(String(50), nullable=False)
    cn: Mapped[str] = mapped_column(String(50), nullable=False)
    apl_activity: Mapped[str] = mapped_column(String(120), nullable=False)
    # NPN is intentionally NOT a FK to tb_m_parts — scheduled-plan uploads may
    # reference parts that are not (yet) in the master.
    npn: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    req_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    req_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # ── UT/supplier-owned (fill) ─────────────────────────────────────────
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="NOT_READY")
    ut_location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    est_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # ── system ───────────────────────────────────────────────────────────
    origin: Mapped[str] = mapped_column(String(10), nullable=False, default=ORIGIN_BASELINE)
    is_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    removed_in_revision: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )

    # ── carryover lineage (DELTA3) ────────────────────────────────────────
    carried_over_from_line_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_t_plan_lines.id", ondelete="SET NULL"), nullable=True
    )
    carryover_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cancelled_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    carryover_override: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    period: Mapped["PlanPeriod"] = relationship("PlanPeriod", back_populates="lines")  # type: ignore  # noqa: F821

    __table_args__ = (
        UniqueConstraint("period_id", "egi", "cn", "npn", "apl_activity", name="uq_plan_line_natural_key"),
        Index("ix_plan_lines_period_apl_status", "period_id", "apl_activity", "status"),
        Index("ix_plan_lines_period_npn", "period_id", "npn"),
        Index("ix_plan_lines_period_origin", "period_id", "origin"),
        Index("ix_plan_lines_carryover_from", "carried_over_from_line_id"),
        Index("ix_plan_lines_is_cancelled", "is_cancelled"),
    )
