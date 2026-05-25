"""Add ut_site_code and replacement_pn to inquiries (v2.0 respond flow)

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inquiries", sa.Column("ut_site_code",   sa.String(10), nullable=True))
    op.add_column("inquiries", sa.Column("replacement_pn", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("inquiries", "replacement_pn")
    op.drop_column("inquiries", "ut_site_code")
