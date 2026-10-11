"""canonical developer dataset migration

Revision ID: e5f6a7b8c9d0
Revises: c68f6af42a89
Create Date: 2026-10-11 19:10:00.000000

Migration strategy:
  1. Add SPRINT_DEVELOPER_ASSIGNED to PostgreSQL auditaction enum.
  2. Add canonical assigned_developer_id column to sprints table with foreign key to users.id.
  3. Mirror assigned_tester_id to assigned_developer_id for existing sprints.
  4. Create bi-directional synchronization trigger between assigned_developer_id and assigned_tester_id.
  5. Migrate any remaining users with role = 'TESTER' to 'DEVELOPER'.
  6. Ensure worker test developer (tester4.p4ci@example.com) has role = 'DEVELOPER'.
  7. Update all obsolete tester-labelled display names in users.full_name to Developer names.
  8. Preserve all user IDs, passwords, audit history, and relationships.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'c68f6af42a89'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Add SPRINT_DEVELOPER_ASSIGNED to auditaction enum ───────────────────
    op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'SPRINT_DEVELOPER_ASSIGNED'")

    # ── 2. Add canonical assigned_developer_id column to sprints ───────────────
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sprints' AND column_name = 'assigned_developer_id'
            ) THEN
                ALTER TABLE sprints ADD COLUMN assigned_developer_id INTEGER;
            END IF;
        END $$;
    """)

    # Foreign key for assigned_developer_id
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_sprints_assigned_developer_id_users'
            ) THEN
                ALTER TABLE sprints 
                ADD CONSTRAINT fk_sprints_assigned_developer_id_users 
                FOREIGN KEY (assigned_developer_id) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    # Index for assigned_developer_id
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_sprints_assigned_developer_id 
        ON sprints (assigned_developer_id);
    """)

    # ── 3. Backfill assigned_developer_id from assigned_tester_id ──────────────
    op.execute("""
        UPDATE sprints 
        SET assigned_developer_id = assigned_tester_id 
        WHERE assigned_developer_id IS NULL AND assigned_tester_id IS NOT NULL;
    """)

    # ── 4. Create trigger to keep assigned_developer_id and assigned_tester_id in sync
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_sync_sprint_developer_assignee()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.assigned_developer_id IS NOT NULL AND NEW.assigned_tester_id IS NULL THEN
                NEW.assigned_tester_id := NEW.assigned_developer_id;
            ELSIF NEW.assigned_tester_id IS NOT NULL AND NEW.assigned_developer_id IS NULL THEN
                NEW.assigned_developer_id := NEW.assigned_tester_id;
            ELSIF TG_OP = 'UPDATE' THEN
                IF NEW.assigned_developer_id IS DISTINCT FROM OLD.assigned_developer_id THEN
                    NEW.assigned_tester_id := NEW.assigned_developer_id;
                ELSIF NEW.assigned_tester_id IS DISTINCT FROM OLD.assigned_tester_id THEN
                    NEW.assigned_developer_id := NEW.assigned_tester_id;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS trg_sync_sprint_developer_assignee ON sprints;
        CREATE TRIGGER trg_sync_sprint_developer_assignee
        BEFORE INSERT OR UPDATE ON sprints
        FOR EACH ROW
        EXECUTE FUNCTION fn_sync_sprint_developer_assignee();
    """)

    # ── 5. Ensure all former TESTER accounts have canonical role DEVELOPER ─────
    op.execute("UPDATE users SET role = 'DEVELOPER' WHERE role::text = 'TESTER'")
    op.execute("UPDATE users SET role = 'DEVELOPER' WHERE email = 'tester4.p4ci@example.com'")

    # ── 6. Migrate obsolete tester-labelled display names in users ─────────────
    op.execute("UPDATE users SET full_name = 'Alex Developer' WHERE email = 'tester@bugtracker.com'")
    op.execute("UPDATE users SET full_name = 'Developer CI' WHERE email = 'tester.p4ci@example.com'")
    op.execute("UPDATE users SET full_name = 'Developer2 CI' WHERE email = 'tester2.p4ci@example.com'")
    op.execute("UPDATE users SET full_name = 'Developer3 CI' WHERE email = 'tester3.p4ci@example.com'")
    op.execute("UPDATE users SET full_name = 'Developer4 CI' WHERE email = 'tester4.p4ci@example.com'")
    op.execute("UPDATE users SET full_name = 'Developer P5CI' WHERE email = 'tester.p5ci@example.com'")
    op.execute("UPDATE users SET full_name = 'E2E Developer' WHERE email = 'e2e_tester@bugtracker.com'")
    op.execute("""
        UPDATE users 
        SET full_name = regexp_replace(full_name, '(?i)\\ytester\\y', 'Developer', 'g') 
        WHERE full_name ILIKE '%tester%';
    """)


def downgrade() -> None:
    """Downgrade schema safely."""
    op.execute("DROP TRIGGER IF EXISTS trg_sync_sprint_developer_assignee ON sprints;")
    op.execute("DROP FUNCTION IF EXISTS fn_sync_sprint_developer_assignee();")
    op.execute("""
        ALTER TABLE sprints 
        DROP CONSTRAINT IF EXISTS fk_sprints_assigned_developer_id_users;
    """)
    op.execute("DROP INDEX IF EXISTS ix_sprints_assigned_developer_id;")
    op.execute("ALTER TABLE sprints DROP COLUMN IF EXISTS assigned_developer_id;")
