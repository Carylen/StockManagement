import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class UserPermissionOverride(Base):
    """Per-user exception layered on top of role permissions.

    effect=ALLOW grants a permission the role lacks; effect=DENY revokes one the
    role has. DENY wins. An override is active while expires_at IS NULL or in the
    future (see app.utils.permissions.resolve_effective_permissions).
    """
    __tablename__ = "tb_m_user_permission_overrides"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    permission_code: Mapped[str] = mapped_column(
        String(60), ForeignKey("tb_m_permissions.code", ondelete="CASCADE"), nullable=False
    )
    effect: Mapped[str] = mapped_column(String(10), nullable=False)  # ALLOW | DENY
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    granted_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("user_id", "permission_code", name="uq_user_permission_override"),
    )
