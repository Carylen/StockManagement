import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Role(Base):
    """Master catalog of roles (managed by HO super_admin)."""
    __tablename__ = "tb_m_roles"

    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class Permission(Base):
    """Master catalog of permissions (RBAC foundation)."""
    __tablename__ = "tb_m_permissions"

    code: Mapped[str] = mapped_column(String(60), primary_key=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    group_name: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class RolePermission(Base):
    """Join table mapping a role to a permission code."""
    __tablename__ = "tb_m_role_permissions"

    role: Mapped[str] = mapped_column(
        String(40), ForeignKey("tb_m_roles.code", ondelete="CASCADE"), primary_key=True
    )
    permission: Mapped[str] = mapped_column(
        String(60), ForeignKey("tb_m_permissions.code", ondelete="CASCADE"), primary_key=True
    )


class SupplierSite(Base):
    """Sites assigned to a supplier user by HO (super_admin)."""
    __tablename__ = "tb_t_supplier_sites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tb_m_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    site_code: Mapped[str] = mapped_column(
        String(10), ForeignKey("tb_m_sites.code", ondelete="CASCADE"), nullable=False
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    assigned_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tb_m_users.id"), nullable=True
    )

    __table_args__ = (
        UniqueConstraint("supplier_id", "site_code", name="uq_supplier_site"),
    )
