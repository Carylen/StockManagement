from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PlantSiteMapping(Base):
    """Allow-list of (plnt_code, site_code) combinations per supplier.

    plnt_code is only unique within a supplier's own namespace (different
    suppliers can reuse the same code), and one plant can ship to more than
    one site — so a row's site is *validated* against this table by the
    upload service, not derived from a single plnt_code -> site lookup.
    """
    __tablename__ = "tb_m_plant_site_mapping"
    __table_args__ = (
        PrimaryKeyConstraint("plnt_code", "supplier_id", "site_code", name="pk_plant_site_mapping"),
    )

    plnt_code: Mapped[str] = mapped_column(String(10))
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="CASCADE")
    )
    site_code: Mapped[str] = mapped_column(
        String(10), ForeignKey("tb_m_sites.code", ondelete="RESTRICT"), index=True
    )
    description: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
