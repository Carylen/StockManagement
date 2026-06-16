from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PlanScopeSeen(Base):
    """Per-user 'last seen' watermark for a collaboration scope (period × apl_activity).

    Used to compute unread_for_me (counterpart changes after last_seen_at) without
    any cron/queue — purely computed-on-read.
    """
    __tablename__ = "tb_r_plan_scope_seen"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="CASCADE"), primary_key=True
    )
    period_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_t_plan_periods.id", ondelete="CASCADE"), primary_key=True
    )
    apl_activity: Mapped[str] = mapped_column(String(120), primary_key=True)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
