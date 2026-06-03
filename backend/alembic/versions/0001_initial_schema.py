"""Initial schema v2.0 — all tables (incl. RBAC foundation)

Revision ID: 0001
Revises:
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column, String

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tb_m_sites ────────────────────────────────────────────────────────
    op.create_table(
        "tb_m_sites",
        sa.Column("code", sa.String(10), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.execute("INSERT INTO tb_m_sites (code, name, is_active) VALUES ('AGMR', 'Asam-Asam Mine', true)")
    op.execute("INSERT INTO tb_m_sites (code, name, is_active) VALUES ('RANT', 'Rantau Warehouse', true)")
    op.execute("INSERT INTO tb_m_sites (code, name, is_active) VALUES ('SPUT', 'Sputra Banjarmasin', true)")

    # ── tb_m_users (unified identity — password + nrp auth in one table) ────
    op.create_table(
        "tb_m_users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("site", sa.String(10), nullable=False, server_default="AGMR"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        # Authentication
        sa.Column("auth_method", sa.String(10), nullable=False, server_default="password"),
        sa.Column("email", sa.String(150), nullable=True),       # set for auth_method='password'
        sa.Column("password", sa.String(255), nullable=True),    # set for auth_method='password'
        sa.Column("nrp", sa.String(20), nullable=True),          # set for auth_method='nrp'
        sa.Column("position", sa.String(50), nullable=True),
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("tb_m_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    # email unique (NULLs allowed for nrp accounts — Postgres permits multiple NULLs)
    op.create_index("ux_tb_m_users_email", "tb_m_users", ["email"], unique=True)
    op.create_index("ix_tb_m_users_site", "tb_m_users", ["site"])
    op.create_index("ix_tb_m_users_auth_method", "tb_m_users", ["auth_method"])
    op.create_index("ix_tb_m_users_nrp", "tb_m_users", ["nrp"])
    # nrp unique per site, only for accounts that have an nrp
    op.create_index(
        "ux_tb_m_users_nrp_site", "tb_m_users", ["nrp", "site"],
        unique=True, postgresql_where=sa.text("nrp IS NOT NULL"),
    )

    # ── tb_m_parts ─────────────────────────────────────────────────────────
    op.create_table(
        "tb_m_parts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("part_number", sa.String(50), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("producer", sa.String(10), nullable=True),
        sa.Column("commodity", sa.String(10), nullable=True),
        sa.Column("class", sa.String(1), nullable=False, server_default="V"),
        sa.Column("stockcode", sa.String(30), nullable=True),
        sa.Column("mnemonic", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tb_m_parts_part_number", "tb_m_parts", ["part_number"], unique=True)
    op.create_index("ix_tb_m_parts_stockcode", "tb_m_parts", ["stockcode"])

    # ── tb_t_stock_levels (REPLACE semantics — one row per part_number per site) ─
    op.create_table(
        "tb_t_stock_levels",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("part_number", sa.String(50), nullable=False),
        sa.Column("site", sa.String(10), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("commodity", sa.String(10), nullable=True),
        sa.Column("min_qty", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("max_qty", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("rtt_qty", sa.Integer, nullable=False, server_default="0"),
        sa.Column("tbd_qty", sa.Integer, nullable=False, server_default="0"),
        sa.Column("estimated_date", sa.Date, nullable=True),
        sa.Column("mnemonic", sa.String(50), nullable=True),
        sa.Column("status", sa.String(10), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("part_number", "site", name="uq_stock_pn_site"),
    )
    op.create_index("ix_tb_t_stock_levels_part_number", "tb_t_stock_levels", ["part_number"])
    op.create_index("ix_tb_t_stock_levels_site", "tb_t_stock_levels", ["site"])
    op.create_index("ix_tb_t_stock_levels_status", "tb_t_stock_levels", ["status"])

    # ── tb_r_stock_history ─────────────────────────────────────────────────
    op.create_table(
        "tb_r_stock_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("part_id", sa.String(36), sa.ForeignKey("tb_m_parts.id"), nullable=False),
        sa.Column("warehouse", sa.String(5), nullable=False),
        sa.Column("old_qty", sa.Integer, nullable=True),
        sa.Column("new_qty", sa.Integer, nullable=False),
        sa.Column("source_file", sa.String(255), nullable=True),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("tb_m_users.id"), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tb_r_stock_history_part_id", "tb_r_stock_history", ["part_id"])

    # ── tb_t_inquiries (v2.1 — item-level respond) ────────────────────────
    op.create_table(
        "tb_t_inquiries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("site", sa.String(10), nullable=False, server_default="AGMR"),
        sa.Column(
            "submitted_by_user_id", sa.String(36),
            sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tb_t_inquiries_site", "tb_t_inquiries", ["site"])
    op.create_index("ix_tb_t_inquiries_submitted_by_user_id", "tb_t_inquiries", ["submitted_by_user_id"])

    # ── tb_t_inquiry_items ─────────────────────────────────────────────────
    op.create_table(
        "tb_t_inquiry_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "inquiry_id", sa.String(36),
            sa.ForeignKey("tb_t_inquiries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("part_number", sa.String(50), nullable=False),
        sa.Column("part_name", sa.String(200), nullable=True),
        sa.Column("qty", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("replacement_pn", sa.String(25), nullable=True),
        sa.Column("ut_site_code", sa.String(25), nullable=True),
        sa.Column("ut_note", sa.Text, nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("responded_by", sa.String(100), nullable=True),
    )
    op.create_index("ix_tb_t_inquiry_items_inquiry_id", "tb_t_inquiry_items", ["inquiry_id"])
    op.create_index("ix_tb_t_inquiry_items_status", "tb_t_inquiry_items", ["status"])

    # ── tb_r_upload_logs ───────────────────────────────────────────────────
    op.create_table(
        "tb_r_upload_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("tb_m_users.id"), nullable=False),
        sa.Column("rows_total", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rows_processed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rows_skipped", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rows_error", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error_detail", sa.JSON, nullable=True),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tb_r_upload_logs_uploaded_by", "tb_r_upload_logs", ["uploaded_by"])

    # ── tb_m_master_uploads ────────────────────────────────────────────────
    op.create_table(
        "tb_m_master_uploads",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("tb_m_users.id"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("class_v_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("class_g_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("komatsu_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("scania_count", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_tb_m_master_uploads_uploaded_by", "tb_m_master_uploads", ["uploaded_by"])
    op.create_index("ix_tb_m_master_uploads_uploaded_at", "tb_m_master_uploads", ["uploaded_at"])

    # ── RBAC foundation — permissions / role_permissions / supplier_sites ──
    op.create_table(
        "tb_m_permissions",
        sa.Column("code", sa.String(60), primary_key=True),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("group_name", sa.String(60), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
    )
    op.create_index("ix_tb_m_permissions_group_name", "tb_m_permissions", ["group_name"])

    op.create_table(
        "tb_m_role_permissions",
        sa.Column("role", sa.String(40), nullable=False),
        sa.Column("permission", sa.String(60), nullable=False),
        sa.PrimaryKeyConstraint("role", "permission", name="pk_role_permissions"),
        sa.ForeignKeyConstraint(["permission"], ["tb_m_permissions.code"], ondelete="CASCADE"),
    )
    op.create_index("ix_tb_m_role_permissions_role", "tb_m_role_permissions", ["role"])

    op.create_table(
        "tb_t_supplier_sites",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("supplier_id", sa.String(36), sa.ForeignKey("tb_m_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("site_code", sa.String(10), sa.ForeignKey("tb_m_sites.code", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("assigned_by", sa.String(36), sa.ForeignKey("tb_m_users.id"), nullable=True),
        sa.UniqueConstraint("supplier_id", "site_code", name="uq_supplier_site"),
    )
    op.create_index("ix_tb_t_supplier_sites_supplier_id", "tb_t_supplier_sites", ["supplier_id"])

    # ── Seed RBAC catalog from app/core/rbac.py (single source of truth) ───
    # Imported lazily (inside upgrade) so lightweight alembic commands that scan
    # version files without running env.py — e.g. `heads`, `history` — don't need
    # the app package on sys.path.
    from app.core.rbac import PERMISSIONS, ROLE_PERMISSIONS

    permissions_tbl = table(
        "tb_m_permissions",
        column("code", String), column("label", String), column("group_name", String),
    )
    op.bulk_insert(
        permissions_tbl,
        [{"code": c, "label": lbl, "group_name": g} for c, lbl, g in PERMISSIONS],
    )
    role_perms_tbl = table(
        "tb_m_role_permissions",
        column("role", String), column("permission", String),
    )
    op.bulk_insert(
        role_perms_tbl,
        [{"role": r, "permission": p} for r, perms in ROLE_PERMISSIONS.items() for p in perms],
    )


def downgrade() -> None:
    op.drop_index("ix_tb_t_supplier_sites_supplier_id", "tb_t_supplier_sites")
    op.drop_table("tb_t_supplier_sites")
    op.drop_index("ix_tb_m_role_permissions_role", "tb_m_role_permissions")
    op.drop_table("tb_m_role_permissions")
    op.drop_index("ix_tb_m_permissions_group_name", "tb_m_permissions")
    op.drop_table("tb_m_permissions")
    op.drop_index("ix_tb_m_master_uploads_uploaded_at", "tb_m_master_uploads")
    op.drop_index("ix_tb_m_master_uploads_uploaded_by", "tb_m_master_uploads")
    op.drop_table("tb_m_master_uploads")
    op.drop_index("ix_tb_r_upload_logs_uploaded_by", "tb_r_upload_logs")
    op.drop_table("tb_r_upload_logs")
    op.drop_index("ix_tb_t_inquiry_items_status", "tb_t_inquiry_items")
    op.drop_index("ix_tb_t_inquiry_items_inquiry_id", "tb_t_inquiry_items")
    op.drop_table("tb_t_inquiry_items")
    op.drop_index("ix_tb_t_inquiries_submitted_by_user_id", "tb_t_inquiries")
    op.drop_index("ix_tb_t_inquiries_site", "tb_t_inquiries")
    op.drop_table("tb_t_inquiries")
    op.drop_index("ix_tb_r_stock_history_part_id", "tb_r_stock_history")
    op.drop_table("tb_r_stock_history")
    op.drop_index("ix_tb_t_stock_levels_status", "tb_t_stock_levels")
    op.drop_index("ix_tb_t_stock_levels_site", "tb_t_stock_levels")
    op.drop_index("ix_tb_t_stock_levels_part_number", "tb_t_stock_levels")
    op.drop_table("tb_t_stock_levels")
    op.drop_index("ix_tb_m_parts_stockcode", "tb_m_parts")
    op.drop_index("ix_tb_m_parts_part_number", "tb_m_parts")
    op.drop_table("tb_m_parts")
    op.drop_index("ux_tb_m_users_nrp_site", "tb_m_users")
    op.drop_index("ix_tb_m_users_nrp", "tb_m_users")
    op.drop_index("ix_tb_m_users_auth_method", "tb_m_users")
    op.drop_index("ix_tb_m_users_site", "tb_m_users")
    op.drop_index("ux_tb_m_users_email", "tb_m_users")
    op.drop_table("tb_m_users")
    op.drop_table("tb_m_sites")
