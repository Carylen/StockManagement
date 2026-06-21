"""Initial schema — all tables, RBAC, new inquiry flow, readiness flow.

Revision ID: 0001
Revises:
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column, String, Boolean

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

    # ── tb_m_users ────────────────────────────────────────────────────────
    op.create_table(
        "tb_m_users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("site", sa.String(10), nullable=False, server_default="AGMR"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("auth_method", sa.String(10), nullable=False, server_default="password"),
        sa.Column("email", sa.String(150), nullable=True),
        sa.Column("password", sa.String(255), nullable=True),
        sa.Column("nrp", sa.String(20), nullable=True),
        sa.Column("position", sa.String(50), nullable=True),
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("tb_m_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ux_tb_m_users_email", "tb_m_users", ["email"], unique=True)
    op.create_index("ix_tb_m_users_site", "tb_m_users", ["site"])
    op.create_index("ix_tb_m_users_auth_method", "tb_m_users", ["auth_method"])
    op.create_index("ix_tb_m_users_nrp", "tb_m_users", ["nrp"])
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
        sa.Column("min_qty", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("max_qty", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column(
            "superseded_by",
            sa.String(50),
            sa.ForeignKey("tb_m_parts.part_number", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tb_m_parts_part_number", "tb_m_parts", ["part_number"], unique=True)
    op.create_index("ix_tb_m_parts_stockcode", "tb_m_parts", ["stockcode"])
    op.create_index(
        "ix_tb_m_parts_superseded_by",
        "tb_m_parts",
        ["superseded_by"],
        postgresql_where=sa.text("superseded_by IS NOT NULL"),
    )

    # ── tb_m_plant_site_mapping ───────────────────────────────────────────
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

    # ── tb_t_ut_stock ─────────────────────────────────────────────────────
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

    # ── tb_t_ut_upload_log ────────────────────────────────────────────────
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

    # ── tb_t_stock_levels ─────────────────────────────────────────────────
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
    op.create_index("ix_tb_t_stock_levels_site",        "tb_t_stock_levels", ["site"])
    op.create_index("ix_tb_t_stock_levels_status",      "tb_t_stock_levels", ["status"])

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

    # ── tb_t_inquiries (incl. approval columns) ────────────────────────────
    op.create_table(
        "tb_t_inquiries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("site", sa.String(10), nullable=False, server_default="AGMR"),
        sa.Column(
            "submitted_by_user_id", sa.String(36),
            sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("approval_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "approved_by_user_id", sa.String(36),
            sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reject_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tb_t_inquiries_site",                "tb_t_inquiries", ["site"])
    op.create_index("ix_tb_t_inquiries_submitted_by_user_id","tb_t_inquiries", ["submitted_by_user_id"])
    op.create_index("ix_tb_t_inquiries_approval_status",     "tb_t_inquiries", ["approval_status"])

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
    op.create_index("ix_tb_t_inquiry_items_status",     "tb_t_inquiry_items", ["status"])

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

    # ── tb_m_roles ────────────────────────────────────────────────────────────
    op.create_table(
        "tb_m_roles",
        sa.Column("code", sa.String(40), primary_key=True),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_system", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── RBAC foundation ────────────────────────────────────────────────────
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
        sa.ForeignKeyConstraint(["role"],       ["tb_m_roles.code"],       ondelete="CASCADE"),
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

    # ── tb_t_plan_periods (Scheduled Plan — admin-created event) ──────────
    # Multi-activity container: `activity` lives on each line, not here.
    # Admin sets start_date/due_date explicitly; no day-5 auto-derivation.
    op.create_table(
        "tb_t_plan_periods",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("site", sa.String(10), sa.ForeignKey("tb_m_sites.code", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("source_filename", sa.String(255), nullable=True),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("revised_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("site", "name", name="uq_plan_period_window"),
    )
    op.create_index("ix_tb_t_plan_periods_site", "tb_t_plan_periods", ["site"])

    # ── tb_t_plan_lines (Scheduled Plan) ──────────────────────────────────
    # `origin` BASELINE = admin-agreed scope; EXTRA = added by a planner
    # outside that agreement (visible only to admin + that planner).
    op.create_table(
        "tb_t_plan_lines",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("period_id", sa.String(36), sa.ForeignKey("tb_t_plan_periods.id", ondelete="CASCADE"), nullable=False),
        sa.Column("activity", sa.String(20), nullable=False),
        sa.Column("egi", sa.String(50), nullable=False),
        sa.Column("cn", sa.String(50), nullable=False),
        sa.Column("apl_activity", sa.String(120), nullable=False),
        # NPN is intentionally NOT a FK to tb_m_parts — scheduled-plan uploads may
        # reference parts that are not (yet) in the master.
        sa.Column("npn", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("req_qty", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("req_date", sa.Date, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="NOT_READY"),
        sa.Column("ut_location", sa.String(100), nullable=True),
        sa.Column("est_date", sa.Date, nullable=True),
        sa.Column("origin", sa.String(10), nullable=False, server_default="BASELINE"),
        sa.Column("is_ready", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("removed_in_revision", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.String(36), sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("period_id", "egi", "cn", "npn", "apl_activity", name="uq_plan_line_natural_key"),
    )
    op.create_index("ix_tb_t_plan_lines_period_id", "tb_t_plan_lines", ["period_id"])
    op.create_index("ix_plan_lines_period_apl_status", "tb_t_plan_lines", ["period_id", "apl_activity", "status"])
    op.create_index("ix_plan_lines_period_npn", "tb_t_plan_lines", ["period_id", "npn"])
    op.create_index("ix_plan_lines_period_origin", "tb_t_plan_lines", ["period_id", "origin"])

    # ── tb_r_plan_line_history (Scheduled Plan audit) ─────────────────────
    op.create_table(
        "tb_r_plan_line_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("line_id", sa.String(36), sa.ForeignKey("tb_t_plan_lines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field", sa.String(30), nullable=False),
        sa.Column("old_value", sa.Text, nullable=True),
        sa.Column("new_value", sa.Text, nullable=True),
        sa.Column("changed_by", sa.String(36), sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_tb_r_plan_line_history_line_id", "tb_r_plan_line_history", ["line_id"])

    # ── tb_m_user_permission_overrides (RBAC per-user exceptions) ──────────
    op.create_table(
        "tb_m_user_permission_overrides",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("tb_m_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permission_code", sa.String(60), sa.ForeignKey("tb_m_permissions.code", ondelete="CASCADE"), nullable=False),
        sa.Column("effect", sa.String(10), nullable=False),  # ALLOW | DENY
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("granted_by", sa.String(36), sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "permission_code", name="uq_user_permission_override"),
    )
    op.create_index("ix_user_perm_override_user", "tb_m_user_permission_overrides", ["user_id"])

    # ── tb_t_plan_revisions (planner revision round per apl_activity) ──────
    op.create_table(
        "tb_t_plan_revisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("period_id", sa.String(36), sa.ForeignKey("tb_t_plan_periods.id", ondelete="CASCADE"), nullable=False),
        sa.Column("apl_activity", sa.String(120), nullable=False),
        sa.Column("revision_no", sa.Integer, nullable=False),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("revised_by", sa.String(36), sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("revised_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_plan_revisions_period_apl", "tb_t_plan_revisions", ["period_id", "apl_activity"])

    # ── tb_r_plan_scope_seen (per-user 'last seen' watermark) ─────────────
    op.create_table(
        "tb_r_plan_scope_seen",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("tb_m_users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("period_id", sa.String(36), sa.ForeignKey("tb_t_plan_periods.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("apl_activity", sa.String(120), primary_key=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── tb_t_plan_upload_sessions (lazy-expire upload preview, no cron) ────
    op.create_table(
        "tb_t_plan_upload_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("period_id", sa.String(36), sa.ForeignKey("tb_t_plan_periods.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("tb_m_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_filename", sa.String(255), nullable=True),
        sa.Column("diff_payload", sa.JSON, nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_plan_upload_sessions_period_user_status",
        "tb_t_plan_upload_sessions", ["period_id", "uploaded_by", "status"],
    )

    # Seed RBAC catalog from app/core/rbac.py (single source of truth).
    # Imported inside upgrade() so lightweight alembic commands (heads, history)
    # that scan version files without running env.py don't need the app package.
    from app.core.rbac import PERMISSIONS, ROLE_PERMISSIONS, ROLES

    roles_tbl = table(
        "tb_m_roles",
        column("code", String), column("label", String), column("is_system", Boolean),
    )
    op.bulk_insert(
        roles_tbl,
        [{"code": c, "label": lbl, "is_system": sys} for c, lbl, sys in ROLES],
    )

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
    op.drop_index("ix_plan_upload_sessions_period_user_status", "tb_t_plan_upload_sessions")
    op.drop_table("tb_t_plan_upload_sessions")
    op.drop_table("tb_r_plan_scope_seen")
    op.drop_index("ix_plan_revisions_period_apl", "tb_t_plan_revisions")
    op.drop_table("tb_t_plan_revisions")
    op.drop_index("ix_user_perm_override_user", "tb_m_user_permission_overrides")
    op.drop_table("tb_m_user_permission_overrides")
    op.drop_index("ix_tb_r_plan_line_history_line_id", "tb_r_plan_line_history")
    op.drop_table("tb_r_plan_line_history")
    op.drop_index("ix_plan_lines_period_origin", "tb_t_plan_lines")
    op.drop_index("ix_plan_lines_period_npn", "tb_t_plan_lines")
    op.drop_index("ix_plan_lines_period_apl_status", "tb_t_plan_lines")
    op.drop_index("ix_tb_t_plan_lines_period_id", "tb_t_plan_lines")
    op.drop_table("tb_t_plan_lines")
    op.drop_index("ix_tb_t_plan_periods_site", "tb_t_plan_periods")
    op.drop_table("tb_t_plan_periods")
    op.drop_index("ix_tb_t_supplier_sites_supplier_id", "tb_t_supplier_sites")
    op.drop_table("tb_t_supplier_sites")
    op.drop_index("ix_tb_m_role_permissions_role", "tb_m_role_permissions")
    op.drop_table("tb_m_role_permissions")
    op.drop_index("ix_tb_m_permissions_group_name", "tb_m_permissions")
    op.drop_table("tb_m_permissions")
    op.drop_table("tb_m_roles")
    op.drop_index("ix_tb_m_master_uploads_uploaded_at", "tb_m_master_uploads")
    op.drop_index("ix_tb_m_master_uploads_uploaded_by", "tb_m_master_uploads")
    op.drop_table("tb_m_master_uploads")
    op.drop_index("ix_tb_r_upload_logs_uploaded_by", "tb_r_upload_logs")
    op.drop_table("tb_r_upload_logs")
    op.drop_index("ix_tb_t_inquiry_items_status",     "tb_t_inquiry_items")
    op.drop_index("ix_tb_t_inquiry_items_inquiry_id", "tb_t_inquiry_items")
    op.drop_table("tb_t_inquiry_items")
    op.drop_index("ix_tb_t_inquiries_approval_status",      "tb_t_inquiries")
    op.drop_index("ix_tb_t_inquiries_submitted_by_user_id", "tb_t_inquiries")
    op.drop_index("ix_tb_t_inquiries_site",                 "tb_t_inquiries")
    op.drop_table("tb_t_inquiries")
    op.drop_index("ix_tb_r_stock_history_part_id", "tb_r_stock_history")
    op.drop_table("tb_r_stock_history")
    op.drop_index("ix_tb_t_stock_levels_status",      "tb_t_stock_levels")
    op.drop_index("ix_tb_t_stock_levels_site",        "tb_t_stock_levels")
    op.drop_index("ix_tb_t_stock_levels_part_number", "tb_t_stock_levels")
    op.drop_table("tb_t_stock_levels")
    op.drop_index("ix_tb_t_ut_upload_log_uploaded_at", "tb_t_ut_upload_log")
    op.drop_index("ix_tb_t_ut_upload_log_uploaded_by", "tb_t_ut_upload_log")
    op.drop_index("ix_tb_t_ut_upload_log_batch_id",    "tb_t_ut_upload_log")
    op.drop_table("tb_t_ut_upload_log")
    op.drop_index("ix_tb_t_ut_stock_batch",          "tb_t_ut_stock")
    op.drop_index("ix_tb_t_ut_stock_pn_site_latest", "tb_t_ut_stock")
    op.drop_index("ix_tb_t_ut_stock_site_latest",    "tb_t_ut_stock")
    op.drop_table("tb_t_ut_stock")
    op.drop_index("ix_tb_m_plant_site_mapping_site_code", "tb_m_plant_site_mapping")
    op.drop_table("tb_m_plant_site_mapping")
    op.drop_index("ix_tb_m_parts_superseded_by", "tb_m_parts")
    op.drop_index("ix_tb_m_parts_stockcode",     "tb_m_parts")
    op.drop_index("ix_tb_m_parts_part_number",   "tb_m_parts")
    op.drop_table("tb_m_parts")
    op.drop_index("ux_tb_m_users_nrp_site",     "tb_m_users")
    op.drop_index("ix_tb_m_users_nrp",          "tb_m_users")
    op.drop_index("ix_tb_m_users_auth_method",  "tb_m_users")
    op.drop_index("ix_tb_m_users_site",         "tb_m_users")
    op.drop_index("ux_tb_m_users_email",        "tb_m_users")
    op.drop_table("tb_m_users")
    op.drop_table("tb_m_sites")
