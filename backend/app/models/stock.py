import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, Integer, Numeric, Boolean, DateTime, Date, ForeignKey, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class StockLevel(Base):
    __tablename__ = "stock_levels"
    __table_args__ = (UniqueConstraint("part_id", "site", "snapshot_date", name="uq_stock_part_site_date"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    part_id: Mapped[str] = mapped_column(String(36), ForeignKey("parts.id"), nullable=False, index=True)
    site: Mapped[str] = mapped_column(String(10), default="AGMR", nullable=False)
    min_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    max_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    rtt_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tbd_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str | None] = mapped_column(String(10), nullable=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    part: Mapped["Part"] = relationship("Part", back_populates="stock_levels")  # type: ignore

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
    __tablename__ = "stock_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    part_id: Mapped[str] = mapped_column(String(36), ForeignKey("parts.id"), nullable=False, index=True)
    warehouse: Mapped[str] = mapped_column(String(5), nullable=False)
    old_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    new_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    source_file: Mapped[str | None] = mapped_column(String(255), nullable=True)
    uploaded_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @property
    def delta(self) -> int:
        return (self.new_qty or 0) - (self.old_qty or 0)

    # Relationships
    part: Mapped["Part"] = relationship("Part", back_populates="stock_history")  # type: ignore
    uploader: Mapped["User"] = relationship("User")  # type: ignore
