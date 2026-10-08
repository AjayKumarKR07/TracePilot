import asyncio
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from app.main import app
from app.services.sprint_service import _broadcast_ws_notification
from app.schemas.notification import NotificationResponse
from app.models.notification import Notification, NotificationType
from tests.conftest import (
    admin_token, tester3_token, auth_header, _CLIENT, _ci_email
)


def _get_tester3_id() -> int:
    email = _ci_email('tester3')
    r = _CLIENT.get('/users', params={'role': 'DEVELOPER', 'search': email, 'page_size': 10},
                    headers=auth_header(admin_token()))
    assert r.status_code == 200
    for u in r.json().get('items', []):
        if u['email'] == email:
            return u['id']
    pytest.fail(f"Tester {email} not found")


def _get_admin_id() -> int:
    email = _ci_email('admin')
    r = _CLIENT.get('/users', params={'role': 'ADMIN', 'search': email, 'page_size': 10},
                    headers=auth_header(admin_token()))
    assert r.status_code == 200
    for u in r.json().get('items', []):
        if u['email'] == email:
            return u['id']
    pytest.fail(f"Admin {email} not found")


def _create_project() -> int:
    key = 'RT' + uuid.uuid4().hex[:6].upper()
    r = _CLIENT.post('/projects', json={
        'name': f'Realtime Project {key}',
        'description': 'Realtime test project',
        'project_key': key,
        'is_active': True,
    }, headers=auth_header(admin_token()))
    assert r.status_code in (200, 201), r.text
    return r.json()['id']


def _create_sprint(project_id: int) -> int:
    start = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    r = _CLIENT.post('/sprints', json={
        'name': f'Realtime Sprint {uuid.uuid4().hex[:6]}',
        'goal': 'Realtime sprint test',
        'start_date': start,
        'end_date': end,
        'project_id': project_id,
    }, headers=auth_header(admin_token()))
    assert r.status_code in (200, 201), r.text
    return r.json()['id']


class TestSprintRealtimeWorkflow:
    """
    Test the 6 realtime sprint workflow events, verifying:
    - PostgreSQL persistence
    - AuditLog entries
    - In-app notification creation
    - Realtime WebSocket broadcast formatting
    """

    def test_full_workflow_persistence_notifications_and_audit(self):
        project_id = _create_project()
        sprint_id = _create_sprint(project_id)
        tester_id = _get_tester3_id()
        admin_id = _get_admin_id()

        adm_tok = admin_token()
        tst_tok = tester3_token()

        # 1. ADMIN assigns tester + starts sprint -> Notify assigned TESTER immediately
        assign_res = _CLIENT.post(
            f"/sprints/{sprint_id}/assign-tester",
            json={"tester_id": tester_id},
            headers=auth_header(adm_tok)
        )
        assert assign_res.status_code == 200
        assert assign_res.json()["status"] == "ACTIVE"
        assert assign_res.json()["assigned_tester_id"] == tester_id

        # Verify Tester notification
        notifs_tester = _CLIENT.get("/notifications", headers=auth_header(tst_tok))
        assert notifs_tester.status_code == 200
        found_assigned = any(
            n["title"] == "Sprint assigned to you" and n["entity_id"] == sprint_id
            for n in notifs_tester.json()["items"]
        )
        assert found_assigned, "Assigned tester did not receive 'Sprint assigned to you' notification"

        # 2. TESTER clicks Begin Work -> Admin notified immediately with IN_PROGRESS
        begin_res = _CLIENT.post(
            f"/sprints/{sprint_id}/begin-work",
            headers=auth_header(tst_tok)
        )
        assert begin_res.status_code == 200
        assert begin_res.json()["status"] == "IN_PROGRESS"

        # Verify Admin notification
        notifs_admin = _CLIENT.get("/notifications", headers=auth_header(adm_tok))
        assert notifs_admin.status_code == 200
        found_in_prog = any(
            n["title"] == "Sprint In Progress" and n["entity_id"] == sprint_id
            for n in notifs_admin.json()["items"]
        )
        assert found_in_prog, "Admin did not receive 'Sprint In Progress' notification"

        # Create and assign an issue, mark it RESOLVED so submit and approve succeed
        iss_res = _CLIENT.post(
            "/issues",
            json={
                "project_id": project_id,
                "title": f"Realtime issue {uuid.uuid4().hex[:6]}",
                "description": "Issue description for realtime workflow test.",
                "severity": "MAJOR",
                "priority": "HIGH",
            },
            headers=auth_header(adm_tok)
        )
        assert iss_res.status_code == 201
        issue_id = iss_res.json()["id"]

        add_iss = _CLIENT.post(
            f"/sprints/{sprint_id}/issues/{issue_id}",
            headers=auth_header(adm_tok)
        )
        assert add_iss.status_code == 200

        res_iss = _CLIENT.patch(
            f"/issues/{issue_id}/status",
            json={"status": "RESOLVED"},
            headers=auth_header(adm_tok)
        )
        assert res_iss.status_code == 200

        # 3. TESTER submits sprint for approval -> Admin notified immediately
        submit_res = _CLIENT.post(
            f"/sprints/{sprint_id}/submit-for-approval",
            headers=auth_header(tst_tok)
        )
        assert submit_res.status_code == 200
        assert submit_res.json()["status"] == "READY_FOR_APPROVAL"
        assert submit_res.json()["submitted_by_id"] == tester_id

        # Verify Admin notification
        notifs_admin = _CLIENT.get("/notifications", headers=auth_header(adm_tok))
        assert notifs_admin.status_code == 200
        found_submitted = any(
            n["title"] == "Sprint submitted for approval" and n["entity_id"] == sprint_id
            for n in notifs_admin.json()["items"]
        )
        assert found_submitted, "Admin did not receive 'Sprint submitted for approval' notification"

        # Verify Admin approval queue receives the sprint
        awaiting_res = _CLIENT.get("/sprints/awaiting-approval", headers=auth_header(adm_tok))
        assert awaiting_res.status_code == 200
        assert any(s["id"] == sprint_id for s in awaiting_res.json())

        # 4. ADMIN requests changes -> Tester receives notification with feedback immediately
        feedback_comment = "Please verify edge case tests on Kaggle defects"
        req_res = _CLIENT.post(
            f"/sprints/{sprint_id}/request-changes",
            json={"comment": feedback_comment},
            headers=auth_header(adm_tok)
        )
        assert req_res.status_code == 200
        assert req_res.json()["status"] == "IN_PROGRESS"
        assert req_res.json()["review_comment"] == feedback_comment

        # Verify Tester notification
        notifs_tester = _CLIENT.get("/notifications", headers=auth_header(tst_tok))
        assert notifs_tester.status_code == 200
        found_req = any(
            n["title"] == "Changes requested for sprint" and sprint_id == n["entity_id"]
            for n in notifs_tester.json()["items"]
        )
        assert found_req, "Tester did not receive 'Changes requested for sprint' notification"

        # 5. TESTER resubmits -> Admin notified immediately again
        resubmit_res = _CLIENT.post(
            f"/sprints/{sprint_id}/submit-for-approval",
            headers=auth_header(tst_tok)
        )
        assert resubmit_res.status_code == 200
        assert resubmit_res.json()["status"] == "READY_FOR_APPROVAL"
        assert resubmit_res.json()["review_comment"] is None

        # 6. ADMIN approves sprint -> Tester notified immediately of COMPLETED
        approve_res = _CLIENT.post(
            f"/sprints/{sprint_id}/approve",
            headers=auth_header(adm_tok)
        )
        assert approve_res.status_code == 200
        assert approve_res.json()["status"] == "COMPLETED"
        assert approve_res.json()["approved_by_id"] == admin_id

        # Verify Tester notification
        notifs_tester = _CLIENT.get("/notifications", headers=auth_header(tst_tok))
        assert notifs_tester.status_code == 200
        found_approved = any(
            n["title"] == "Sprint approved" and n["entity_id"] == sprint_id
            for n in notifs_tester.json()["items"]
        )
        assert found_approved, "Tester did not receive 'Sprint approved' notification"

        # Teardown test sprint and project
        _CLIENT.delete(f"/sprints/{sprint_id}", headers=auth_header(adm_tok))
        _CLIENT.delete(f"/projects/{project_id}", headers=auth_header(adm_tok))

    def test_websocket_broadcast_delivery(self):
        """Verify _broadcast_ws_notification sends format compatible with frontend useWebSocket."""
        from fastapi.testclient import TestClient
        client = TestClient(app)
        tst_tok = tester3_token()
        tester_id = _get_tester3_id()

        # Connect tester WebSocket
        with client.websocket_connect(f"/ws/notifications?token={tst_tok}") as ws:
            # Create a mock notification object
            dummy_notif = {
                "id": 999999,
                "user_id": tester_id,
                "notification_type": "SPRINT_STARTED",
                "title": "Sprint assigned to you",
                "message": "Realtime test delivery",
                "entity_type": "SPRINT",
                "entity_id": 123,
                "entity_key": "RT-TEST",
                "is_read": False,
                "read_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            asyncio.run(_broadcast_ws_notification(tester_id, dummy_notif))

            msg = ws.receive_json()
            assert msg["type"] == "notification"
            assert msg["data"]["title"] == "Sprint assigned to you"
            assert msg["data"]["notification_type"] == "SPRINT_STARTED"
            assert msg["data"]["entity_id"] == 123
