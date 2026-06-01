import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Inquiry(Base):
    __tablename__ = "tb_t_inquiries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    site: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    submitted_by_nrp: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    submitted_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
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

    items: Mapped[list["InquiryItem"]] = relationship(
        "InquiryItem", back_populates="inquiry", cascade="all, delete-orphan", lazy="selectin"
    )


class InquiryItem(Base):
    __tablename__ = "tb_t_inquiry_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    inquiry_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_t_inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    part_number: Mapped[str] = mapped_column(String(50), nullable=False)
    part_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    qty: Mapped[int] = mapped_column(Integer, nullable=False)

    # Respond fields (item-level)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    replacement_pn: Mapped[str | None] = mapped_column(String(25), nullable=True)
    ut_site_code: Mapped[str | None] = mapped_column(String(25), nullable=True)
    ut_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    responded_by: Mapped[str | None] = mapped_column(String(100), nullable=True)

    inquiry: Mapped["Inquiry"] = relationship("Inquiry", back_populates="items")
