import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PlanRevision(Base):
    """One planner revision round for an apl_activity within a period.

    revision_no is max(revision_no)+1 per (period_id, apl_activity). The actual
    per-line req_date changes are recorded in tb_r_plan_line_history; this row is
    the round header (who/when/note).
    """
    __tablename__ = "tb_t_plan_revisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_t_plan_periods.id", ondelete="CASCADE"), nullable=False, index=True
    )
    apl_activity: Mapped[str] = mapped_column(String(120), nullable=False)
    revision_no: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    revised_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )
    revised_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
