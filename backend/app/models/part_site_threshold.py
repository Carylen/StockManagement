from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PartSiteThreshold(Base):
    """Per-site MIN/MAX readiness target for a part.

    Set/maintained via the admin daily-readiness upload. UT/Supplier's
    on-the-fly status computation joins against this (not the global
    tb_m_parts.min_qty/max_qty) so each site can carry its own target.
    """
    __tablename__ = "tb_m_part_site_thresholds"

    part_number: Mapped[str] = mapped_column(
        String(50), ForeignKey("tb_m_parts.part_number", ondelete="CASCADE"), primary_key=True
    )
    site_code: Mapped[str] = mapped_column(
        String(10), ForeignKey("tb_m_sites.code", ondelete="RESTRICT"), primary_key=True
    )
    min_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    max_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True
    )
