import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Part(Base):
    __tablename__ = "parts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    part_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    producer: Mapped[str | None] = mapped_column(String(10), nullable=True)
    commodity: Mapped[str | None] = mapped_column(String(10), nullable=True)
    kelas: Mapped[str] = mapped_column("class", String(1), default="V", nullable=False)
    stockcode: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    mnemonic: Mapped[str | None] = mapped_column(String(20), nullable=True)
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
    stock_levels: Mapped[list["StockLevel"]] = relationship("StockLevel", back_populates="part")  # type: ignore
    stock_history: Mapped[list["StockHistory"]] = relationship("StockHistory", back_populates="part")  # type: ignore
