import uuid
from datetime import datetime, timezone
from sqlalchemy import String, JSON, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PlanUploadSession(Base):
    """Lazy-expire preview session for a planner's scheduled-plan upload
    (DELTA3): rows are parsed and diffed against the period but NOT written
    to plan_lines until /confirm. Unconfirmed sessions are never cleaned up
    by a cron — a new preview for the same (period, uploader) simply deletes
    its own stale PENDING rows first (see scheduled_plans.upload_plan_preview).
    """
    __tablename__ = "tb_t_plan_upload_sessions"

    STATUS_PENDING = "PENDING"
    STATUS_CONFIRMED = "CONFIRMED"
    STATUS_DISCARDED = "DISCARDED"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_t_plan_periods.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # {"origin": "EXTRA", "rows": [...serialized PlanRow dicts...], "errors": [...]}
    diff_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default=STATUS_PENDING)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_plan_upload_sessions_period_user_status", "period_id", "uploaded_by", "status"),
    )
