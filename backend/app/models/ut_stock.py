import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import JSON, String, Boolean, DateTime, Date, Numeric, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class UTStock(Base):
    __tablename__ = "tb_t_ut_stock"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    part_number: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    site_code: Mapped[str] = mapped_column(
        String(10), ForeignKey("tb_m_sites.code", ondelete="RESTRICT"), nullable=False
    )
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="RESTRICT"), nullable=False
    )
    avail_stock: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    rtt_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tbd_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    upload_batch: Mapped[str] = mapped_column(String(36), nullable=False)
    is_latest: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    uploaded_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )


class UTUploadLog(Base):
    __tablename__ = "tb_t_ut_upload_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    batch_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    uploaded_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="RESTRICT"), nullable=False
    )
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_rows: Mapped[int] = mapped_column(nullable=False, default=0)
    matched_rows: Mapped[int] = mapped_column(nullable=False, default=0)
    skipped_rows: Mapped[int] = mapped_column(nullable=False, default=0)
    sites_affected: Mapped[list | None] = mapped_column(JSON, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
