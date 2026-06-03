import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class User(Base):
    """Unified identity — one account table for every principal.

    Two authentication methods share this table:
      - auth_method="password": email + password (admin / supplier / super_admin)
      - auth_method="nrp":      NRP only, no password (plant workers: user / group_leader)

    Columns are nullable where a given auth_method doesn't use them
    (email/password for NRP accounts; nrp/position for password accounts).
    """
    __tablename__ = "tb_m_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    site: Mapped[str] = mapped_column(String(10), default="AGMR", nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Authentication
    auth_method: Mapped[str] = mapped_column(String(10), default="password", nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(150), unique=True, nullable=True, index=True)
    password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nrp: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    position: Mapped[str | None] = mapped_column(String(50), nullable=True)

    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("tb_m_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    upload_logs: Mapped[list["UploadLog"]] = relationship("UploadLog", back_populates="uploader")  # type: ignore
