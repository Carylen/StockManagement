from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AppSetting(Base):
    """Generic key-value store for HO-editable business-tuning values.

    Value is always stored as text; callers cast to the type they expect
    (see app.services.app_settings_service).
    """
    __tablename__ = "tb_m_app_settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("tb_m_users.id"), nullable=True)
