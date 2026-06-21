import uuid
from datetime import datetime, timezone, date
from sqlalchemy import String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class PlanPeriod(Base):
    """A scheduled-plan event = (site × name × manual date window), admin-owned.

    Multi-activity container: `activity` lives on each PlanLine, not here — an
    event can bundle OVERHAUL/MIDLIFE/MANDATORY lines together. Admin sets
    start_date/due_date explicitly at creation (no day-5 auto-derivation).

    State (OPEN/LOCKED) is NOT stored — it is derived from due_date at read
    time (now_WIB <= due_date → OPEN, else LOCKED).
    """
    __tablename__ = "tb_t_plan_periods"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    site: Mapped[str] = mapped_column(
        String(10), ForeignKey("tb_m_sites.code", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    uploaded_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    revised_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lines: Mapped[list["PlanLine"]] = relationship(  # type: ignore  # noqa: F821
        "PlanLine", back_populates="period", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("site", "name", name="uq_plan_period_window"),
    )
