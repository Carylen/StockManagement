"""Initial schema v2.0 — all tables

Revision ID: 0001
Revises:
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

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

    # ── tb_m_users ─────────────────────────────────────────────────────────
    op.create_table(
        "tb_m_users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(150), nullable=False, unique=True),
        sa.Column("password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("site", sa.String(10), nullable=False, server_default="AGMR"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("tb_m_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tb_m_users_email", "tb_m_users", ["email"], unique=True)
    op.create_index("ix_tb_m_users_site", "tb_m_users", ["site"])

    # ── tb_m_employees ─────────────────────────────────────────────────────
    op.create_table(
        "tb_m_employees",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("nrp", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("site", sa.String(10), sa.ForeignKey("tb_m_sites.code"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="mechanic"),
        sa.Column("shift", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tb_m_employees_nrp_site", "tb_m_employees", ["nrp", "site"], unique=True)
    op.create_index("ix_tb_m_employees_site", "tb_m_employees", ["site"])

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

    # ── tb_r_stock_levels ──────────────────────────────────────────────────
    op.create_table(
        "tb_r_stock_levels",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("part_id", sa.String(36), sa.ForeignKey("tb_m_parts.id"), nullable=False),
        sa.Column("site", sa.String(10), nullable=False, server_default="AGMR"),
        sa.Column("min_qty", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("max_qty", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("rtt_qty", sa.Integer, nullable=False, server_default="0"),
        sa.Column("tbd_qty", sa.Integer, nullable=False, server_default="0"),
        sa.Column("estimated_qty", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(10), nullable=True),
        sa.Column("snapshot_date", sa.Date, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("part_id", "site", "snapshot_date", name="uq_stock_part_site_date"),
    )
    op.create_index("ix_tb_r_stock_levels_part_id", "tb_r_stock_levels", ["part_id"])
    op.create_index("ix_tb_r_stock_levels_snapshot_date", "tb_r_stock_levels", ["snapshot_date"])

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

    # ── tb_r_inquiries (v2.0 — no GL approval) ────────────────────────────
    op.create_table(
        "tb_r_inquiries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("submitted_by", sa.String(36), sa.ForeignKey("tb_m_users.id"), nullable=True),
        sa.Column("submitted_by_employee_id", sa.String(36), sa.ForeignKey("tb_m_employees.id"), nullable=True),
        sa.Column("site", sa.String(10), nullable=False, server_default="AGMR"),
        sa.Column("class", sa.String(1), nullable=False, server_default="G"),
        sa.Column("part_name", sa.String(200), nullable=False),
        sa.Column("part_number", sa.String(50), nullable=True),
        sa.Column("qty_needed", sa.Integer, nullable=False),
        sa.Column("unit_asset", sa.String(100), nullable=True),
        sa.Column("date_needed", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("ut_site_code", sa.String(10), nullable=True),
        sa.Column("replacement_pn", sa.String(50), nullable=True),
        sa.Column("respond_notes", sa.Text, nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tb_r_inquiries_submitted_by", "tb_r_inquiries", ["submitted_by"])
    op.create_index("ix_tb_r_inquiries_submitted_by_employee_id", "tb_r_inquiries", ["submitted_by_employee_id"])
    op.create_index("ix_tb_r_inquiries_status", "tb_r_inquiries", ["status"])
    op.create_index("ix_tb_r_inquiries_site", "tb_r_inquiries", ["site"])

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


def downgrade() -> None:
    op.drop_index("ix_tb_m_master_uploads_uploaded_at", "tb_m_master_uploads")
    op.drop_index("ix_tb_m_master_uploads_uploaded_by", "tb_m_master_uploads")
    op.drop_table("tb_m_master_uploads")
    op.drop_index("ix_tb_r_upload_logs_uploaded_by", "tb_r_upload_logs")
    op.drop_table("tb_r_upload_logs")
    op.drop_table("tb_r_inquiries")
    op.drop_table("tb_r_stock_history")
    op.drop_table("tb_r_stock_levels")
    op.drop_table("tb_m_parts")
    op.drop_table("tb_m_employees")
    op.drop_table("tb_m_users")
    op.drop_table("tb_m_sites")
