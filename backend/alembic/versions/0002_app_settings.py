"""App settings table — HO-editable business-tuning values.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column, String

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tb_m_app_settings",
        sa.Column("key", sa.String(60), primary_key=True),
        sa.Column("value", sa.String(255), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", sa.String(36), nullable=True),
        sa.ForeignKeyConstraint(["updated_by"], ["tb_m_users.id"], ondelete="SET NULL"),
    )

    # Seed defaults from the app-level catalog (single source of truth), same
    # pattern as the RBAC seed in 0001. Imported inside upgrade() so
    # lightweight alembic commands that scan version files don't need the app
    # package.
    from app.services.app_settings_service import DEFAULTS

    settings_tbl = table("tb_m_app_settings", column("key", String), column("value", String))
    op.bulk_insert(
        settings_tbl,
        [{"key": k, "value": str(v)} for k, v in DEFAULTS.items()],
    )

    # New permission for this feature. Use ON CONFLICT DO NOTHING: a fresh
    # install running 0001 with an already-updated app/core/rbac.py will have
    # seeded this permission already (0001's RBAC seed reads rbac.py's current
    # content at migration-run time), while an existing production DB that
    # ran 0001 before this permission existed still needs it inserted here.
    op.execute(
        "INSERT INTO tb_m_permissions (code, label, group_name) "
        "VALUES ('can_manage_settings', 'Kelola pengaturan aplikasi', 'HO') "
        "ON CONFLICT (code) DO NOTHING"
    )
    op.execute(
        "INSERT INTO tb_m_role_permissions (role, permission) "
        "VALUES ('super_admin', 'can_manage_settings') "
        "ON CONFLICT (role, permission) DO NOTHING"
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM tb_m_role_permissions WHERE role = 'super_admin' AND permission = 'can_manage_settings'"
    )
    op.execute("DELETE FROM tb_m_permissions WHERE code = 'can_manage_settings'")
    op.drop_table("tb_m_app_settings")
