import asyncio
import io
import selectors
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.main import app
from app.database.connection import engine
from app.models.sprint import Sprint, SprintStatus
from app.models.issue import Issue, IssueStatus, Priority, Severity
from app.models.issue_comment import IssueComment
from app.models.issue_attachment import IssueAttachment
from app.models.notification import Notification, NotificationType
from tests.conftest import (
    admin_token, tester3_token, auth_header, _CLIENT, _ci_email
)

_AsyncSession = async_sessionmaker(engine, expire_on_commit=False)

def _run_sync(coro):
    loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _verify_deleted(s_id):
    async with _AsyncSession() as session:
        res = await session.execute(select(Sprint).where(Sprint.id == s_id))
        return res.scalar_one_or_none()

def _setup_project_and_tester():
    admin_headers = auth_header(admin_token())
    tester_headers = auth_header(tester3_token())

    proj_key = "DEL" + uuid.uuid4().hex[:6].upper()
    r_proj = _CLIENT.post(
        "/projects",
        json={"name": f"Sprint Deletion Project {proj_key}", "project_key": proj_key, "is_active": True},
        headers=admin_headers,
    )
    assert r_proj.status_code in (200, 201), r_proj.text
    project_id = r_proj.json()["id"]

    target_email = _ci_email("tester3")
    r_users = _CLIENT.get(
        "/users", params={"role": "DEVELOPER", "search": target_email, "page_size": 10}, headers=admin_headers
    )
    assert r_users.status_code == 200
    tester_id = None
    for u in r_users.json().get("items", []):
        if u["email"] == target_email:
            tester_id = u["id"]
            break
    assert tester_id is not None, "tester3 user not found"

    return admin_headers, tester_headers, project_id, tester_id


# -----------------------------------------------------------------------------
# A. Delete PLANNED sprint
# -----------------------------------------------------------------------------
def test_delete_planned_sprint():
    admin_headers, _, project_id, _ = _setup_project_and_tester()
    now = datetime.now(timezone.utc)
    r_planned = _CLIENT.post(
        "/sprints",
        json={
            "project_id": project_id,
            "name": f"Planned Sprint {uuid.uuid4().hex[:4]}",
            "goal": "Test planned deletion",
            "start_date": (now + timedelta(days=1)).isoformat(),
            "end_date": (now + timedelta(days=14)).isoformat(),
        },
        headers=admin_headers,
    )
    assert r_planned.status_code == 201
    planned_id = r_planned.json()["id"]

    r_del = _CLIENT.delete(f"/sprints/{planned_id}", headers=admin_headers)
    assert r_del.status_code == 204, r_del.text
    assert _run_sync(_verify_deleted(planned_id)) is None


# -----------------------------------------------------------------------------
# B. Delete COMPLETED sprint with zero issues
# -----------------------------------------------------------------------------
def test_delete_completed_sprint_zero_issues():
    admin_headers, _, project_id, _ = _setup_project_and_tester()
    now = datetime.now(timezone.utc)

    async def _create_completed_empty():
        async with _AsyncSession() as session:
            s = Sprint(
                project_id=project_id,
                name=f"Completed Empty Sprint {uuid.uuid4().hex[:4]}",
                goal="Empty completed deletion test",
                start_date=now,
                end_date=now + timedelta(days=7),
                status=SprintStatus.COMPLETED,
            )
            session.add(s)
            await session.commit()
            await session.refresh(s)
            return s.id

    empty_id = _run_sync(_create_completed_empty())
    r_del = _CLIENT.delete(f"/sprints/{empty_id}", headers=admin_headers)
    assert r_del.status_code == 204, r_del.text
    assert _run_sync(_verify_deleted(empty_id)) is None


# -----------------------------------------------------------------------------
# J, K, L. Verify protected states (ACTIVE, IN_PROGRESS, READY_FOR_APPROVAL)
# -----------------------------------------------------------------------------
def test_protected_workflow_states_deletion_rejected():
    admin_headers, tester_headers, project_id, tester_id = _setup_project_and_tester()
    now = datetime.now(timezone.utc)

    # 1. Create sprint and attach issue
    r_sprint = _CLIENT.post(
        "/sprints",
        json={
            "project_id": project_id,
            "name": f"Workflow Sprint {uuid.uuid4().hex[:4]}",
            "goal": "Protected states test",
            "start_date": now.isoformat(),
            "end_date": (now + timedelta(days=14)).isoformat(),
        },
        headers=admin_headers,
    )
    assert r_sprint.status_code == 201
    sprint_id = r_sprint.json()["id"]

    r_issue = _CLIENT.post(
        "/issues",
        json={
            "project_id": project_id,
            "title": "Defect for Protected State Test",
            "description": "Critical defect",
            "priority": Priority.HIGH.value,
            "severity": Severity.CRITICAL.value,
        },
        headers=admin_headers,
    )
    assert r_issue.status_code == 201
    issue_id = r_issue.json()["id"]

    _CLIENT.post(f"/sprints/{sprint_id}/issues/{issue_id}", headers=admin_headers)

    # Assign tester -> transitions PLANNED -> ACTIVE
    _CLIENT.post(f"/sprints/{sprint_id}/assign-tester", json={"tester_id": tester_id}, headers=admin_headers)

    # J. ACTIVE sprint deletion is rejected
    r_del_active = _CLIENT.delete(f"/sprints/{sprint_id}", headers=admin_headers)
    assert r_del_active.status_code == 400
    assert "Cannot delete a sprint in 'ACTIVE' status" in r_del_active.json()["detail"]

    # Tester begins work -> transitions ACTIVE -> IN_PROGRESS
    r_begin = _CLIENT.post(f"/sprints/{sprint_id}/begin-work", headers=tester_headers)
    assert r_begin.status_code == 200

    # K. IN_PROGRESS sprint deletion is rejected
    r_del_inprog = _CLIENT.delete(f"/sprints/{sprint_id}", headers=admin_headers)
    assert r_del_inprog.status_code == 400
    assert "Cannot delete a sprint in 'IN_PROGRESS' status" in r_del_inprog.json()["detail"]

    # Resolve issue so sprint can be submitted
    _CLIENT.patch(f"/issues/{issue_id}/assign", json={"tester_id": tester_id}, headers=admin_headers)
    r_resolve = _CLIENT.patch(
        f"/issues/{issue_id}/resolve",
        json={"resolution_summary": "Issue resolved for approval."},
        headers=tester_headers,
    )
    assert r_resolve.status_code == 200

    # Submit for approval -> transitions IN_PROGRESS -> READY_FOR_APPROVAL
    r_sub = _CLIENT.post(f"/sprints/{sprint_id}/submit-for-approval", headers=tester_headers)
    assert r_sub.status_code == 200

    # L. READY_FOR_APPROVAL sprint deletion is rejected
    r_del_approval = _CLIENT.delete(f"/sprints/{sprint_id}", headers=admin_headers)
    assert r_del_approval.status_code == 400
    assert "Cannot delete a sprint in 'READY_FOR_APPROVAL' status" in r_del_approval.json()["detail"]


# -----------------------------------------------------------------------------
# C - I, M - O. Delete COMPLETED sprint with issues:
# - C. Delete COMPLETED sprint containing issues
# - D. All linked issues survive
# - E. sprint_id becomes NULL
# - F. Issue status remains unchanged
# - G. Resolution remains unchanged
# - H. Comments remain
# - I. Attachments remain
# - M. Assigned tester receives SPRINT_ENDED notification
# - N. WebSocket broadcast triggered
# - O. Unrelated issues survive untouched
# -----------------------------------------------------------------------------
def test_delete_completed_sprint_preserves_data_and_notifies():
    admin_headers, tester_headers, project_id, tester_id = _setup_project_and_tester()
    now = datetime.now(timezone.utc)

    # Create sprint
    r_sprint = _CLIENT.post(
        "/sprints",
        json={
            "project_id": project_id,
            "name": f"Completed Preservation Sprint {uuid.uuid4().hex[:4]}",
            "goal": "Data preservation test",
            "start_date": now.isoformat(),
            "end_date": (now + timedelta(days=14)).isoformat(),
        },
        headers=admin_headers,
    )
    assert r_sprint.status_code == 201
    sprint_id = r_sprint.json()["id"]

    # Create linked issue
    r_issue = _CLIENT.post(
        "/issues",
        json={
            "project_id": project_id,
            "title": "Preserved Defect",
            "description": "Defect whose fields must survive sprint deletion",
            "priority": Priority.HIGH.value,
            "severity": Severity.CRITICAL.value,
        },
        headers=admin_headers,
    )
    assert r_issue.status_code == 201
    issue_id = r_issue.json()["id"]

    # Create unrelated issue
    r_unrelated = _CLIENT.post(
        "/issues",
        json={
            "project_id": project_id,
            "title": "Unrelated Standalone Defect",
            "description": "Must not be affected",
            "priority": Priority.LOW.value,
            "severity": Severity.MINOR.value,
        },
        headers=admin_headers,
    )
    assert r_unrelated.status_code == 201
    unrelated_id = r_unrelated.json()["id"]

    # Add comment to linked issue
    r_cmt = _CLIENT.post(
        f"/issues/{issue_id}/comments",
        json={"body": "Crucial reproduction steps and developer analysis."},
        headers=admin_headers,
    )
    assert r_cmt.status_code == 201

    # Add attachment to linked issue with valid PNG magic bytes
    file_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    r_att = _CLIENT.post(
        f"/issues/{issue_id}/attachments",
        files={"file": ("screenshot.png", file_bytes, "image/png")},
        headers=admin_headers,
    )
    assert r_att.status_code == 201

    # Attach issue to sprint
    _CLIENT.post(f"/sprints/{sprint_id}/issues/{issue_id}", headers=admin_headers)

    # Assign tester -> transitions to ACTIVE
    _CLIENT.post(f"/sprints/{sprint_id}/assign-tester", json={"tester_id": tester_id}, headers=admin_headers)

    # Begin work -> transitions to IN_PROGRESS
    _CLIENT.post(f"/sprints/{sprint_id}/begin-work", headers=tester_headers)

    # Assign issue to tester and resolve it
    _CLIENT.patch(f"/issues/{issue_id}/assign", json={"tester_id": tester_id}, headers=admin_headers)
    r_resolve = _CLIENT.patch(
        f"/issues/{issue_id}/resolve",
        json={"resolution_summary": "Bug thoroughly investigated and resolved."},
        headers=tester_headers,
    )
    assert r_resolve.status_code == 200

    # Submit for approval -> transitions to READY_FOR_APPROVAL
    _CLIENT.post(f"/sprints/{sprint_id}/submit-for-approval", headers=tester_headers)

    # Approve sprint -> transitions to COMPLETED
    r_app = _CLIENT.post(f"/sprints/{sprint_id}/approve", headers=admin_headers)
    assert r_app.status_code == 200
    assert r_app.json()["status"] == "COMPLETED"

    # C. Delete COMPLETED sprint with issues & N. WebSocket broadcast triggered
    with patch("app.services.sprint_service._broadcast_ws_notification", new_callable=AsyncMock) as mock_ws:
        r_del = _CLIENT.delete(f"/sprints/{sprint_id}", headers=admin_headers)
        assert r_del.status_code == 204, r_del.text

        # N. Verify WebSocket notification broadcast is triggered for assigned tester
        mock_ws.assert_awaited()
        called_args = mock_ws.call_args[0]
        assert called_args[0] == tester_id
        assert called_args[1].notification_type == NotificationType.SPRINT_ENDED

    # Verify sprint itself is deleted
    assert _run_sync(_verify_deleted(sprint_id)) is None

    # Fetch entities from DB to verify preservation
    async def _fetch_entities():
        async with _AsyncSession() as session:
            res_issue = await session.execute(select(Issue).where(Issue.id == issue_id))
            iss = res_issue.scalar_one_or_none()

            res_unrel = await session.execute(select(Issue).where(Issue.id == unrelated_id))
            unrel = res_unrel.scalar_one_or_none()

            res_cmts = await session.execute(select(IssueComment).where(IssueComment.issue_id == issue_id))
            cmts = res_cmts.scalars().all()

            res_atts = await session.execute(select(IssueAttachment).where(IssueAttachment.issue_id == issue_id))
            atts = res_atts.scalars().all()

            res_notifs = await session.execute(
                select(Notification).where(
                    Notification.user_id == tester_id,
                    Notification.notification_type == NotificationType.SPRINT_ENDED,
                    Notification.entity_id == sprint_id,
                )
            )
            notifs = res_notifs.scalars().all()

            return iss, unrel, cmts, atts, notifs

    db_issue, db_unrelated, db_comments, db_attachments, db_notifications = _run_sync(_fetch_entities())

    # D. Verify all linked issues survive
    assert db_issue is not None, "Linked issue was deleted!"

    # E. Verify sprint_id becomes NULL for those issues
    assert db_issue.sprint_id is None, f"Expected sprint_id=None, got {db_issue.sprint_id}"

    # F. Verify issue status remains unchanged
    assert db_issue.status == IssueStatus.RESOLVED

    # G. Verify resolution remains unchanged
    assert db_issue.resolution_summary == "Bug thoroughly investigated and resolved."

    # H. Verify comments remain
    assert len(db_comments) >= 1
    assert "Crucial reproduction steps and developer analysis." in [c.body for c in db_comments]

    # I. Verify attachments remain
    assert len(db_attachments) >= 1
    assert "screenshot.png" in [a.original_filename for a in db_attachments]

    # M. Verify assigned tester receives SPRINT_ENDED notification
    deleted_notifs = [n for n in db_notifications if "Sprint Deleted" in n.title]
    assert len(deleted_notifs) >= 1, f"Expected 'Sprint Deleted' notification, got {[n.title for n in db_notifications]}"
    notif = deleted_notifs[0]
    assert "All defect records, comments, attachments, and resolutions have been preserved" in notif.message

    # O. Verify deleting a completed sprint does not delete unrelated issues
    assert db_unrelated is not None, "Unrelated issue was deleted!"
    assert db_unrelated.id == unrelated_id
    assert db_unrelated.title == "Unrelated Standalone Defect"
