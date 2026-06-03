import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Text, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Part(Base):
    __tablename__ = "tb_m_parts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    part_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    producer: Mapped[str | None] = mapped_column(String(10), nullable=True)
    commodity: Mapped[str | None] = mapped_column(String(10), nullable=True)
    kelas: Mapped[str] = mapped_column("class", String(1), default="V", nullable=False)
    stockcode: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    mnemonic: Mapped[str | None] = mapped_column(String(20), nullable=True)
    min_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    max_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    superseded_by: Mapped[str | None] = mapped_column(
        String(50),
        ForeignKey("tb_m_parts.part_number", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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
    stock_history: Mapped[list["StockHistory"]] = relationship("StockHistory", back_populates="part")  # type: ignore
