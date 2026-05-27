import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Integer, Text, DateTime, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Inquiry(Base):
    __tablename__ = "tb_r_inquiries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # One of submitted_by or submitted_by_employee_id must be set (not both)
    submitted_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("tb_m_users.id"), nullable=True, index=True)
    submitted_by_employee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_employees.id"), nullable=True, index=True
    )
    site: Mapped[str] = mapped_column(String(10), default="AGMR", nullable=False, index=True)
    kelas: Mapped[str] = mapped_column("class", String(1), default="G", nullable=False)
    part_name: Mapped[str] = mapped_column(String(200), nullable=False)
    part_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    qty_needed: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_asset: Mapped[str | None] = mapped_column(String(100), nullable=True)
    date_needed: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    # UT response fields (v2.0)
    ut_site_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    replacement_pn: Mapped[str | None] = mapped_column(String(50), nullable=True)
    respond_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
    submitter: Mapped["User | None"] = relationship(  # type: ignore
        "User", foreign_keys=[submitted_by], back_populates="submitted_inquiries"
    )
    employee_submitter: Mapped["Employee | None"] = relationship(  # type: ignore
        "Employee", foreign_keys=[submitted_by_employee_id], back_populates="submitted_inquiries"
    )

    @property
    def submitter_display_name(self) -> str | None:
        if self.submitter:
            return self.submitter.name
        if self.employee_submitter:
            return self.employee_submitter.name
        return None
