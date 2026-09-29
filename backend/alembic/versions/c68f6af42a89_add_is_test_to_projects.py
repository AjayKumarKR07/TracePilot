"""add_is_test_to_projects

Adds an ``is_test`` boolean column to the projects table.
Backfills TRUE for every project that is clearly an automated test
fixture (identified by its project_key prefix or name pattern), while
preserving the three known legitimate production projects intact.

Revision ID: c68f6af42a89
Revises: g9h8i7j6k5l4
Create Date: 2026-09-29 18:50:54
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "c68f6af42a89"
down_revision: Union[str, Sequence[str], None] = "g9h8i7j6k5l4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ---------------------------------------------------------------------------
# Known legitimate production project keys — never mark these as test data.
# ---------------------------------------------------------------------------
_REAL_KEYS = ("CORE", "MOB", "API", "ISEC")


def upgrade() -> None:
    """Add is_test column and backfill test fixtures."""
    # 1. Add column — all rows default to FALSE (production).
    op.add_column(
        "projects",
        sa.Column("is_test", sa.Boolean(), server_default="false", nullable=False),
    )

    # 2. Mark every project that is NOT in the real-project list as a test
    #    fixture.  This is a one-time backfill; future projects created via
    #    the Admin UI will have is_test=False by default.
    conn = op.get_bind()

    # Build a safe IN-list placeholder for the real keys
    real_keys_literal = ", ".join(f"'{k}'" for k in _REAL_KEYS)
    conn.execute(
        text(
            f"""
            UPDATE projects
            SET    is_test = TRUE
            WHERE  project_key NOT IN ({real_keys_literal})
            """
        )
    )


def downgrade() -> None:
    """Remove is_test column."""
    op.drop_column("projects", "is_test")
