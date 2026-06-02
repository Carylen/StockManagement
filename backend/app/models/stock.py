import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, Integer, Numeric, DateTime, Date, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class StockLevel(Base):
    """Daily readiness snapshot — REPLACE semantics (one row per part_number per site).

    No FK to tb_m_parts so upload can include parts not yet in master.
    commodity and description are stored directly from the upload file.
    """
    __tablename__ = "tb_t_stock_levels"
    __table_args__ = (UniqueConstraint("part_number", "site", name="uq_stock_pn_site"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    part_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    site: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mnemonic: Mapped[str | None] = mapped_column(String(50), nullable=True)
    commodity: Mapped[str | None] = mapped_column(String(10), nullable=True)
    min_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    max_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    rtt_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tbd_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    estimated_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str | None] = mapped_column(String(10), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @property
    def total_qty(self) -> int:
        return (self.rtt_qty or 0) + (self.tbd_qty or 0)

    @property
    def readyness_oh(self) -> bool:
        return (self.rtt_qty or 0) > 0

    @property
    def readyness_min(self) -> bool:
        return (self.rtt_qty or 0) >= float(self.min_qty or 0)

    @property
    def readyness_fb(self) -> bool:
        return ((self.rtt_qty or 0) + (self.tbd_qty or 0)) >= float(self.min_qty or 0)


class StockHistory(Base):
    """History of RTT/TBD changes per part. Kept for audit; no longer written by daily uploads."""
    __tablename__ = "tb_r_stock_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    part_id: Mapped[str] = mapped_column(String(36), ForeignKey("tb_m_parts.id"), nullable=False, index=True)
    warehouse: Mapped[str] = mapped_column(String(5), nullable=False)
    old_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    new_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    source_file: Mapped[str | None] = mapped_column(String(255), nullable=True)
    uploaded_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("tb_m_users.id"), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @property
    def delta(self) -> int:
        return (self.new_qty or 0) - (self.old_qty or 0)

    part: Mapped["Part"] = relationship("Part", back_populates="stock_history")  # type: ignore
    uploader: Mapped["User"] = relationship("User")  # type: ignore
