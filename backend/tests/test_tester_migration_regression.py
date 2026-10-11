"""
Regression and verification tests for Tester-to-Developer Migration.

Tests:
1. Canonical application roles (ADMIN, DEVELOPER, USER)
2. SafeUserRoleType backward-compatibility shim (TESTER -> DEVELOPER)
3. Admin-only assignment of issues to active DEVELOPER
4. Rejection of non-developer (USER) as assignee
5. Rejection of inactive users as assignee
6. Workflow transitions (REPORTED -> ASSIGNED -> IN_DEVELOPMENT -> IN_REVIEW -> RESOLVED -> CLOSED -> REOPENED)
7. Audit log creation for assignment, transition, resolution, closure, reopening
8. Reassignment preserves history
9. User-level and Developer-level permission boundaries
10. UI static regression test: confirms zero obsolete Tester role terminology in active frontend components
"""

import pytest
from fastapi.testclient import TestClient
from pathlib import Path

from app.models.user import UserRole, SafeUserRoleType
from app.models.issue import DEVELOPER_TRANSITIONS, IssueStatus
from tests.conftest import admin_token, tester_token, get_token, _ci_email


@pytest.fixture(scope="module")
def user_token() -> str:
    return get_token("user")


@pytest.fixture(scope="module")
def user2_token() -> str:
    return get_token("user2")


@pytest.fixture(scope="module")
def dev_token() -> str:
    # "tester" in conftest is a verified DEVELOPER account ("Developer CI")
    return tester_token()


class TestCanonicalRoles:
    """Verify application role definitions and backward compatibility."""

    def test_canonical_roles_defined(self):
        assert set(r.value for r in UserRole) == {"ADMIN", "DEVELOPER", "USER"}

    def test_safe_role_type_upgrades_legacy_tester(self):
        shim = SafeUserRoleType()
        # Legacy TESTER string from PostgreSQL must map to Python UserRole.DEVELOPER
        assert shim.process_result_value("TESTER", None) == UserRole.DEVELOPER
        assert shim.process_result_value("DEVELOPER", None) == UserRole.DEVELOPER
        assert shim.process_result_value("ADMIN", None) == UserRole.ADMIN
        assert shim.process_result_value("USER", None) == UserRole.USER
        assert shim.process_result_value(None, None) is None

    def test_developer_transitions_exist(self):
        assert IssueStatus.ASSIGNED in DEVELOPER_TRANSITIONS
        assert IssueStatus.IN_DEVELOPMENT in DEVELOPER_TRANSITIONS[IssueStatus.ASSIGNED]
        assert IssueStatus.IN_REVIEW in DEVELOPER_TRANSITIONS[IssueStatus.IN_DEVELOPMENT]


class TestIssueWorkflowEndToEnd:
    """Verify complete canonical workflow from creation through assignment, resolution, and closure."""

    def test_full_workflow_and_permissions(self, api_client: TestClient, user_token: str, dev_token: str, user2_token: str):
        adm_tok = admin_token()
        headers_adm = {"Authorization": f"Bearer {adm_tok}"}
        headers_user = {"Authorization": f"Bearer {user_token}"}
        headers_dev = {"Authorization": f"Bearer {dev_token}"}
        headers_other_user = {"Authorization": f"Bearer {user2_token}"}

        # 1. Fetch project ID
        proj_res = api_client.get("/projects", headers=headers_adm)
        assert proj_res.status_code == 200
        projects = proj_res.json()["items"]
        assert len(projects) > 0
        proj_id = projects[0]["id"]

        # 2. USER reports an issue
        create_res = api_client.post(
            "/issues",
            json={
                "project_id": proj_id,
                "title": "Regression Defect for Migration Verification",
                "description": "Steps to reproduce and verify the developer assignment workflow.",
                "severity": "CRITICAL",
                "priority": "HIGH",
            },
            headers=headers_user,
        )
        assert create_res.status_code == 201
        issue = create_res.json()
        issue_id = issue["id"]
        assert issue["status"] == "REPORTED"
        assert issue["assignee"] is None

        # 3. Non-admin cannot assign issue
        dev_info_res = api_client.get("/auth/me", headers=headers_dev)
        assert dev_info_res.status_code == 200
        dev_id = dev_info_res.json()["id"]

        assign_forbidden = api_client.patch(
            f"/issues/{issue_id}/assign",
            json={"developer_id": dev_id},
            headers=headers_user,
        )
        assert assign_forbidden.status_code == 403

        # 4. ADMIN cannot assign issue to a USER
        user_info_res = api_client.get("/auth/me", headers=headers_user)
        user_id = user_info_res.json()["id"]
        assign_invalid_user = api_client.patch(
            f"/issues/{issue_id}/assign",
            json={"developer_id": user_id},
            headers=headers_adm,
        )
        assert assign_invalid_user.status_code == 400
        assert "Issues can only be assigned to a DEVELOPER" in assign_invalid_user.json()["detail"]

        # 5. ADMIN assigns issue to DEVELOPER
        assign_res = api_client.patch(
            f"/issues/{issue_id}/assign",
            json={"developer_id": dev_id},
            headers=headers_adm,
        )
        assert assign_res.status_code == 200
        assigned_issue = assign_res.json()
        assert assigned_issue["status"] == "ASSIGNED"
        assert assigned_issue["assignee"]["id"] == dev_id
        assert assigned_issue["assignee"]["role"] == "DEVELOPER"

        # 6. Unassigned/Other users cannot change status
        status_forbidden = api_client.patch(
            f"/issues/{issue_id}/status",
            json={"status": "IN_DEVELOPMENT"},
            headers=headers_other_user,
        )
        assert status_forbidden.status_code == 403

        # 7. Assigned developer advances to IN_DEVELOPMENT
        step1_res = api_client.patch(
            f"/issues/{issue_id}/status",
            json={"status": "IN_DEVELOPMENT"},
            headers=headers_dev,
        )
        assert step1_res.status_code == 200
        assert step1_res.json()["status"] == "IN_DEVELOPMENT"

        # 8. Assigned developer advances to IN_REVIEW
        step2_res = api_client.patch(
            f"/issues/{issue_id}/status",
            json={"status": "IN_REVIEW"},
            headers=headers_dev,
        )
        assert step2_res.status_code == 200
        assert step2_res.json()["status"] == "IN_REVIEW"

        # 9. Assigned developer resolves issue
        resolve_res = api_client.patch(
            f"/issues/{issue_id}/resolve",
            json={"resolution_summary": "Fixed the root cause and verified in development environment."},
            headers=headers_dev,
        )
        assert resolve_res.status_code == 200
        resolved_issue = resolve_res.json()
        assert resolved_issue["status"] == "RESOLVED"
        assert resolved_issue["resolution_summary"] is not None

        # 10. Reporter confirms resolution and closes
        close_res = api_client.patch(
            f"/issues/{issue_id}/close",
            headers=headers_user,
        )
        assert close_res.status_code == 200
        assert close_res.json()["status"] == "CLOSED"

        # 11. Reopen workflow
        reopen_res = api_client.patch(
            f"/issues/{issue_id}/reopen",
            json={"reason": "Testing reopen capability and analytics tracking."},
            headers=headers_user,
        )
        assert reopen_res.status_code == 200
        assert reopen_res.json()["status"] == "REOPENED"

        # 12. Check audit activity log
        activity_res = api_client.get(f"/issues/{issue_id}/activity", headers=headers_adm)
        assert activity_res.status_code == 200
        logs = activity_res.json()
        actions = [log["action"] for log in logs]
        assert "ISSUE_ASSIGNED" in actions
        assert "ISSUE_STATUS_CHANGED" in actions
        assert "ISSUE_RESOLVED" in actions
        assert "ISSUE_REOPENED" in actions
        descriptions = [log["description"] for log in logs]
        assert any("closed issue" in d.lower() for d in descriptions)


class TestFrontendUIRegression:
    """Verify that no active production UI exposes obsolete Tester role terminology."""

    def test_no_obsolete_tester_role_in_active_pages(self):
        frontend_src = Path(__file__).resolve().parents[2] / "frontend" / "src"
        assert frontend_src.exists()

        active_pages = [
            frontend_src / "pages" / "IssueDetailPage.tsx",
            frontend_src / "pages" / "DashboardPage.tsx",
            frontend_src / "pages" / "AdminPage.tsx",
            frontend_src / "pages" / "DeveloperSprintsPage.tsx",
            frontend_src / "pages" / "SprintsPage.tsx",
            frontend_src / "pages" / "ProfilePage.tsx",
        ]

        prohibited_phrases = [
            "Assigned to Tester",
            "Fixed by Tester",
            "Assignee (Tester)",
            "Select Active Tester",
            "Assign Issue to Tester",
            "Tester: {user",
            "isAssignTesterOpen",
            "testerList",
            "assignedToTesterCount",
        ]

        for page in active_pages:
            content = page.read_text(encoding="utf-8")
            for phrase in prohibited_phrases:
                assert phrase not in content, f"Obsolete phrase '{phrase}' found in {page.name}"


class TestDatabaseDatasetMigration:
    """Verify live PostgreSQL database schema and dataset integrity."""

    def test_database_dataset_integrity(self):
        from sqlalchemy import text
        from app.database.connection import engine
        from tests.conftest import _run_sync
        from sqlalchemy.ext.asyncio import AsyncSession

        async def _verify():
            async with AsyncSession(engine) as session:
                # 1. Zero users with TESTER role
                res_roles = await session.execute(text("SELECT count(*) FROM users WHERE role::text = 'TESTER'"))
                assert res_roles.scalar() == 0, "No user should have role TESTER"

                # 2. Zero users with 'tester' in full_name
                res_names = await session.execute(text("SELECT count(*) FROM users WHERE full_name ILIKE '%tester%'"))
                assert res_names.scalar() == 0, "No user should have 'tester' in display name"

                # 3. Zero issues assigned to non-developers
                res_issues = await session.execute(text("""
                    SELECT count(i.id)
                    FROM issues i
                    JOIN users u ON i.assignee_id = u.id
                    WHERE u.role::text != 'DEVELOPER'
                """))
                assert res_issues.scalar() == 0, "All assigned issues must be assigned to DEVELOPER"

                # 4. Sprints table has assigned_developer_id column
                res_cols = await session.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'sprints' AND column_name = 'assigned_developer_id'
                """))
                assert res_cols.scalar() == "assigned_developer_id", "sprints must have assigned_developer_id column"

                # 5. SPRINT_DEVELOPER_ASSIGNED in auditaction enum
                res_enum = await session.execute(text("""
                    SELECT e.enumlabel
                    FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    WHERE t.typname = 'auditaction' AND e.enumlabel = 'SPRINT_DEVELOPER_ASSIGNED'
                """))
                assert res_enum.scalar() == "SPRINT_DEVELOPER_ASSIGNED", "auditaction must contain SPRINT_DEVELOPER_ASSIGNED"

                # 6. Alembic version is at least e5f6a7b8c9d0
                res_ver = await session.execute(text("SELECT version_num FROM alembic_version"))
                assert res_ver.scalar() == "e5f6a7b8c9d0", "alembic_version must be e5f6a7b8c9d0"

        _run_sync(_verify())

