"""migrate tester role to developer

Revision ID: g9h8i7j6k5l4
Revises: 94e13357b828
Create Date: 2026-09-28 18:44:00.000000

Migration strategy:
  - The PostgreSQL userrole enum already contains DEVELOPER.
  - Converts all existing TESTER rows to DEVELOPER.
  - No enum changes needed. No data deleted.
"""
from typing import Sequence, Union
from alembic import op

revision = 'g9h8i7j6k5l4'
down_revision = '94e13357b828'
branch_labels = None
depends_on = None


def upgrade():
    """Migrate existing TESTER users to DEVELOPER role (data migration only)."""
    op.execute("UPDATE users SET role = 'DEVELOPER' WHERE role = 'TESTER'")


def downgrade():
    """Roll back: convert DEVELOPER users back to TESTER."""
    op.execute("UPDATE users SET role = 'TESTER' WHERE role = 'DEVELOPER'")
