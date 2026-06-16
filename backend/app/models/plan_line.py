import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import String, Text, Date, DateTime, Boolean, Numeric, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class PlanLine(Base):
    """One planned part line, grain = unit (egi+cn) × work-package (apl_activity) × part (npn).

    Natural key = (period_id, egi, cn, npn, apl_activity). `is_ready` is always
    re-derived from `status` on write (never set manually). See design doc §4.2.
    """
    __tablename__ = "tb_t_plan_lines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_t_plan_periods.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # ── planner-owned (from upload) ──────────────────────────────────────
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
    is_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    removed_in_revision: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )

    period: Mapped["PlanPeriod"] = relationship("PlanPeriod", back_populates="lines")  # type: ignore  # noqa: F821

    __table_args__ = (
        UniqueConstraint("period_id", "egi", "cn", "npn", "apl_activity", name="uq_plan_line_natural_key"),
        Index("ix_plan_lines_period_apl_status", "period_id", "apl_activity", "status"),
        Index("ix_plan_lines_period_npn", "period_id", "npn"),
    )
