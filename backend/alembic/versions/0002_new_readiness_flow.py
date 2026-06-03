"""New readiness flow — UT stock upload replaces manual stock level entry.

Changes:
  1A. tb_m_parts     — add min_qty, max_qty, superseded_by
  1B. tb_m_plant_site_mapping  — new table (Plnt → site_code lookup)
  1C. tb_t_ut_stock            — new table (avail stock per part per site)
  1D. tb_t_ut_upload_log       — new table (upload audit trail)
  1E. tb_t_stock_levels        — rename to tb_t_stock_levels_deprecated

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column, String, Boolean

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1A. Add columns to tb_m_parts ─────────────────────────────────────
    op.add_column(
        "tb_m_parts",
        sa.Column("min_qty", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "tb_m_parts",
        sa.Column("max_qty", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "tb_m_parts",
        sa.Column(
            "superseded_by",
            sa.String(50),
            sa.ForeignKey("tb_m_parts.part_number", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_tb_m_parts_superseded_by",
        "tb_m_parts",
        ["superseded_by"],
        postgresql_where=sa.text("superseded_by IS NOT NULL"),
    )

    # ── 1B. tb_m_plant_site_mapping ───────────────────────────────────────
    op.create_table(
        "tb_m_plant_site_mapping",
        sa.Column("plnt_code", sa.String(10), primary_key=True),
        sa.Column(
            "site_code",
            sa.String(10),
            sa.ForeignKey("tb_m_sites.code", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("description", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_tb_m_plant_site_mapping_site_code", "tb_m_plant_site_mapping", ["site_code"])

    mapping_tbl = table(
        "tb_m_plant_site_mapping",
        column("plnt_code", String),
        column("site_code", String),
        column("description", String),
        column("is_active", Boolean),
    )
    op.bulk_insert(
        mapping_tbl,
        [
            {"plnt_code": "RTT", "site_code": "AGMR", "description": "Warehouse UT · AGMR", "is_active": True},
            {"plnt_code": "SMR", "site_code": "RANT", "description": "Warehouse UT · RANT", "is_active": True},
            {"plnt_code": "BTL", "site_code": "SPUT", "description": "Warehouse UT · SPUT", "is_active": True},
        ],
    )

    # ── 1C. tb_t_ut_stock ─────────────────────────────────────────────────
    op.create_table(
        "tb_t_ut_stock",
        sa.Column(
            "id",
            sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()::text"),
        ),
        sa.Column("part_number", sa.String(50), nullable=False),
        sa.Column("plnt_code", sa.String(10), nullable=False),
        sa.Column(
            "site_code",
            sa.String(10),
            sa.ForeignKey("tb_m_sites.code", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("avail_stock", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("upload_batch", sa.String(36), nullable=False),
        sa.Column("is_latest", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "uploaded_by",
            sa.String(36),
            sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_tb_t_ut_stock_site_latest",    "tb_t_ut_stock", ["site_code", "is_latest"])
    op.create_index("ix_tb_t_ut_stock_pn_site_latest", "tb_t_ut_stock", ["part_number", "site_code", "is_latest"])
    op.create_index("ix_tb_t_ut_stock_batch",          "tb_t_ut_stock", ["upload_batch"])

    # ── 1D. tb_t_ut_upload_log ────────────────────────────────────────────
    op.create_table(
        "tb_t_ut_upload_log",
        sa.Column(
            "id",
            sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()::text"),
        ),
        sa.Column("batch_id", sa.String(36), nullable=False, unique=True),
        sa.Column(
            "uploaded_by",
            sa.String(36),
            sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("filename", sa.String(255), nullable=True),
        sa.Column("total_rows",   sa.Integer, nullable=False, server_default="0"),
        sa.Column("matched_rows", sa.Integer, nullable=False, server_default="0"),
        sa.Column("skipped_rows", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sites_affected", sa.JSON, nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_tb_t_ut_upload_log_batch_id",    "tb_t_ut_upload_log", ["batch_id"], unique=True)
    op.create_index("ix_tb_t_ut_upload_log_uploaded_by", "tb_t_ut_upload_log", ["uploaded_by"])
    op.create_index("ix_tb_t_ut_upload_log_uploaded_at", "tb_t_ut_upload_log", ["uploaded_at"])

    # ── 1E. Rename tb_t_stock_levels → deprecated ─────────────────────────
    op.rename_table("tb_t_stock_levels", "tb_t_stock_levels_deprecated")


def downgrade() -> None:
    # Reverse 1E
    op.rename_table("tb_t_stock_levels_deprecated", "tb_t_stock_levels")

    # Reverse 1D
    op.drop_index("ix_tb_t_ut_upload_log_uploaded_at", "tb_t_ut_upload_log")
    op.drop_index("ix_tb_t_ut_upload_log_uploaded_by", "tb_t_ut_upload_log")
    op.drop_index("ix_tb_t_ut_upload_log_batch_id",    "tb_t_ut_upload_log")
    op.drop_table("tb_t_ut_upload_log")

    # Reverse 1C
    op.drop_index("ix_tb_t_ut_stock_batch",          "tb_t_ut_stock")
    op.drop_index("ix_tb_t_ut_stock_pn_site_latest", "tb_t_ut_stock")
    op.drop_index("ix_tb_t_ut_stock_site_latest",    "tb_t_ut_stock")
    op.drop_table("tb_t_ut_stock")

    # Reverse 1B
    op.drop_index("ix_tb_m_plant_site_mapping_site_code", "tb_m_plant_site_mapping")
    op.drop_table("tb_m_plant_site_mapping")

    # Reverse 1A
    op.drop_index("ix_tb_m_parts_superseded_by", "tb_m_parts")
    op.drop_column("tb_m_parts", "superseded_by")
    op.drop_column("tb_m_parts", "max_qty")
    op.drop_column("tb_m_parts", "min_qty")
