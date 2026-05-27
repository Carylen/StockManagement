import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class MasterUpload(Base):
    __tablename__ = "tb_m_master_uploads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("tb_m_users.id"), nullable=False, index=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    total_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    class_v_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    class_g_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    komatsu_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    scania_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
