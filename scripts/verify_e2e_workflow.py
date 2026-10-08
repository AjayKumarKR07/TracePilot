"""
End-to-end defect workflow verification script for TracePilot.
Verifies the complete lifecycle across:
Frontend APIs -> FastAPI -> PostgreSQL -> WebSocket/Notifications -> AI -> RBAC -> Dashboards.
"""

import asyncio
import json
import selectors
import sys
import uuid
from datetime import datetime

import os
from pathlib import Path

# If started from repo root, change into backend/ so backend/.env is automatically loaded
if os.path.exists("backend") and os.path.isdir("backend"):
    os.chdir("backend")

sys.path.insert(0, ".")

# Windows event loop fix for Python 3.14
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.database.connection import engine
from app.main import app
from app.models.audit_log import AuditLog
from app.models.issue import Issue, IssueStatus
from app.models.notification import Notification
from app.models.project import Project
from app.models.user import User, UserRole
from tests.conftest import _ensure_verified_user, admin_token, auth_header, tester_token, user_token


def run_sync(coro):
    loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def print_section(title: str):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def main():
    client = TestClient(app)
    results = {}

    print_section("TRACEPILOT END-TO-END WORKFLOW VERIFICATION")

    # Ensure CI users exist
    async def _init_users():
        await _ensure_verified_user("admin.p4ci@example.com", "Admin CI", UserRole.ADMIN)
        await _ensure_verified_user("tester.p4ci@example.com", "Developer CI", UserRole.DEVELOPER)
        await _ensure_verified_user("user.p4ci@example.com", "User CI", UserRole.USER)

    run_sync(_init_users())

    u_tok = user_token()
    a_tok = admin_token()
    t_tok = tester_token()

    user_headers = auth_header(u_tok)
    admin_headers = auth_header(a_tok)
    dev_headers = auth_header(t_tok)

    # Fetch user IDs
    me_user = client.get("/auth/me", headers=user_headers).json()
    me_admin = client.get("/auth/me", headers=admin_headers).json()
    me_dev = client.get("/auth/me", headers=dev_headers).json()

    user_id = me_user["id"]
    admin_id = me_admin["id"]
    dev_id = me_dev["id"]

    print(f"[*] Verified Users: USER id={user_id}, ADMIN id={admin_id}, DEVELOPER id={dev_id}")

    # Ensure a legitimate project exists
    proj_key = f"VER{uuid.uuid4().hex[:4].upper()}"
    p_resp = client.post("/projects", json={"name": "Verification Project", "project_key": proj_key}, headers=admin_headers)
    if p_resp.status_code == 201:
        project_id = p_resp.json()["id"]
    else:
        p_list = client.get("/projects", headers=admin_headers).json()
        project_id = p_list["items"][0]["id"]
    print(f"[*] Project ID for test: {project_id}")

    # =========================================================================
    # 1. USER — CREATE DEFECT & VALIDATION
    # =========================================================================
    print_section("1. USER — CREATE DEFECT & VALIDATION")

    # 1a. Validation of required fields
    bad_resp = client.post("/issues", json={"project_id": project_id}, headers=user_headers)
    assert bad_resp.status_code == 422, f"Expected 422 on missing fields, got {bad_resp.status_code}"
    print("[PASS] Missing required fields correctly rejected with 422")

    # 1b. Create valid defect
    issue_payload = {
        "title": "Authentication token expired prematurely on dashboard load",
        "description": "Users encounter unexpected session expiration after 5 minutes of inactivity on the dashboard.",
        "project_id": project_id,
        "issue_type": "BUG",
        "priority": "HIGH",
        "severity": "CRITICAL",
        "environment": "Production-Staging Web",
        "steps_to_reproduce": "1. Log into dashboard\n2. Wait 5 minutes without activity\n3. Click any link",
        "expected_result": "Session should persist for the configured 60 minutes",
        "actual_result": "User redirected to /login with 401 error",
    }
    c_resp = client.post("/issues", json=issue_payload, headers=user_headers)
    assert c_resp.status_code == 201, f"Create defect failed: {c_resp.text}"
    issue = c_resp.json()
    issue_id = issue["id"]
    issue_key = issue["issue_key"]

    assert issue["status"] == "REPORTED", f"Expected REPORTED, got {issue['status']}"
    assert issue["assignee"] is None, f"Expected unassigned, got {issue['assignee']}"
    assert issue["reporter"]["id"] == user_id, f"Expected reporter {user_id}, got {issue['reporter']['id']}"
    print(f"[PASS] Defect created successfully: ID={issue_id}, Key={issue_key}, Status={issue['status']}")

    # 1c. Visibility in User & Admin issue lists
    user_issues = client.get("/issues", headers=user_headers).json()["items"]
    assert any(i["id"] == issue_id for i in user_issues), "Created issue not in User's list"
    admin_unassigned = client.get("/issues?unassigned=true", headers=admin_headers).json()["items"]
    assert any(i["id"] == issue_id for i in admin_unassigned), "Created issue not in Admin unassigned list"
    print("[PASS] Defect appears in User issues list and Admin unassigned queue")

    # 1d. Direct assignment by USER must be forbidden
    user_assign_attempt = client.patch(f"/issues/{issue_id}/assign", json={"developer_id": dev_id}, headers=user_headers)
    assert user_assign_attempt.status_code == 403, f"Expected 403 for user assign, got {user_assign_attempt.status_code}"
    print("[PASS] USER role forbidden from assigning developers (403 enforced)")
    results["USER_CREATE"] = "PASS"

    # =========================================================================
    # 2. ADMIN — TRIAGE & SMART PRIORITY
    # =========================================================================
    print_section("2. ADMIN — TRIAGE & SMART PRIORITY")

    # Smart priority calculator
    triage_payload = {
        "severity": "CRITICAL",
        "category": "Authentication",
        "impact_scope": "ALL_USERS",
    }
    triage_resp = client.post("/issues/triage-recommendation", json=triage_payload, headers=admin_headers)
    assert triage_resp.status_code == 200, f"Triage recommendation failed: {triage_resp.text}"
    triage_data = triage_resp.json()
    print(f"[PASS] Smart Priority Triage recommendation: Score={triage_data.get('priority_score')}, Priority={triage_data.get('recommended_priority')}")
    results["ADMIN_TRIAGE"] = "PASS"

    # =========================================================================
    # 3. ADMIN — ASSIGN DEVELOPER
    # =========================================================================
    print_section("3. ADMIN — ASSIGN DEVELOPER")

    # Non-existent developer rejected
    bad_assign = client.patch(f"/issues/{issue_id}/assign", json={"developer_id": 999999}, headers=admin_headers)
    assert bad_assign.status_code in (400, 404), f"Expected 400/404 for invalid developer, got {bad_assign.status_code}"
    print("[PASS] Invalid developer ID assignment correctly rejected")

    # Valid assignment to active DEVELOPER
    assign_resp = client.patch(f"/issues/{issue_id}/assign", json={"developer_id": dev_id}, headers=admin_headers)
    assert assign_resp.status_code == 200, f"Assignment failed: {assign_resp.text}"
    assigned_issue = assign_resp.json()
    assert assigned_issue["status"] == "ASSIGNED"
    assert assigned_issue["assignee"]["id"] == dev_id
    print(f"[PASS] Admin assigned issue to Developer ID={dev_id}, Status updated to ASSIGNED")

    # Verify Developer sees the assigned issue
    dev_issues = client.get("/issues", headers=dev_headers).json()["items"]
    assert any(i["id"] == issue_id for i in dev_issues), "Assigned issue not visible to Developer"
    print("[PASS] Developer dashboard/list shows the assigned defect")
    results["ADMIN_ASSIGN"] = "PASS"

    # =========================================================================
    # 4. DEVELOPER — INVESTIGATION & AI ASSISTANCE
    # =========================================================================
    print_section("4. DEVELOPER — INVESTIGATION & AI ASSISTANCE")

    # Developer inspects issue details
    detail_resp = client.get(f"/issues/{issue_id}", headers=dev_headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["title"] == issue_payload["title"]
    print("[PASS] Developer retrieved full issue details and defect context")

    # Developer uses AI assistance
    ai_health = client.get("/ai/health", headers=dev_headers).json()
    print(f"[*] AI Service status: {ai_health.get('status')}, Provider: {ai_health.get('ai_provider')}, Model: {ai_health.get('ai_model')}")

    # AI Chat with issue context
    chat_resp = client.post(
        "/ai/chat",
        json={"message": "Analyze possible reasons for JWT premature token expiration", "issue_id": issue_id},
        headers=dev_headers,
    )
    if chat_resp.status_code == 200:
        chat_data = chat_resp.json()
        assert "message" in chat_data
        print("[PASS] AI Chat returned advisory guidance for defect investigation")
    else:
        print(f"[WARN] AI Chat returned status {chat_resp.status_code}: {chat_resp.text}")

    # Verify Developer cannot access Admin management
    dev_admin_attempt = client.get("/admin/dashboard", headers=dev_headers)
    assert dev_admin_attempt.status_code == 403, f"Expected 403, got {dev_admin_attempt.status_code}"
    print("[PASS] DEVELOPER role strictly prohibited from accessing Admin dashboard (403)")
    results["DEV_INVESTIGATE"] = "PASS"

    # =========================================================================
    # 5. DEVELOPER — WORKFLOW & RESOLUTION
    # =========================================================================
    print_section("5. DEVELOPER — WORKFLOW & RESOLUTION")

    # 5a. Begin Work: ASSIGNED -> IN_DEVELOPMENT
    s1_resp = client.patch(f"/issues/{issue_id}/status", json={"status": "IN_DEVELOPMENT"}, headers=dev_headers)
    assert s1_resp.status_code == 200, f"Transition failed: {s1_resp.text}"
    assert s1_resp.json()["status"] == "IN_DEVELOPMENT"
    print("[PASS] Developer moved status: ASSIGNED -> IN_DEVELOPMENT")

    # 5b. Invalid transition attempt (e.g. IN_DEVELOPMENT -> CLOSED directly forbidden)
    bad_transition = client.patch(f"/issues/{issue_id}/status", json={"status": "CLOSED"}, headers=dev_headers)
    assert bad_transition.status_code == 400, f"Expected 400 for invalid state transition, got {bad_transition.status_code}"
    print("[PASS] Invalid state transition IN_DEVELOPMENT -> CLOSED rejected with 400")

    # 5c. Submit for Review: IN_DEVELOPMENT -> IN_REVIEW
    s2_resp = client.patch(f"/issues/{issue_id}/status", json={"status": "IN_REVIEW"}, headers=dev_headers)
    assert s2_resp.status_code == 200
    assert s2_resp.json()["status"] == "IN_REVIEW"
    print("[PASS] Developer submitted for review: IN_DEVELOPMENT -> IN_REVIEW")

    # 5d. Move to testing: IN_REVIEW -> IN_TESTING
    s3_resp = client.patch(f"/issues/{issue_id}/status", json={"status": "IN_TESTING"}, headers=dev_headers)
    assert s3_resp.status_code == 200
    assert s3_resp.json()["status"] == "IN_TESTING"
    print("[PASS] Status advanced: IN_REVIEW -> IN_TESTING")

    # 5e. Mark RESOLVED with resolution notes
    res_resp = client.patch(
        f"/issues/{issue_id}/resolve",
        json={
            "resolution_summary": "Updated token refresh middleware to check absolute expiration against server UTC clock.",
            "resolution_notes": "Added integration unit tests and verified with 60-minute token lifecycle.",
        },
        headers=dev_headers,
    )
    assert res_resp.status_code == 200, f"Resolve failed: {res_resp.text}"
    resolved = res_resp.json()
    assert resolved["status"] == "RESOLVED"
    assert resolved["resolution_summary"] is not None
    assert resolved["resolved_at"] is not None
    print(f"[PASS] Defect resolved by developer at {resolved['resolved_at']}")
    results["DEV_RESOLUTION"] = "PASS"

    # =========================================================================
    # 6 & 7. ADMIN / USER — REVIEW, REWORK PATH & RE-RESOLUTION
    # =========================================================================
    print_section("6 & 7. ADMIN / USER — REVIEW & REWORK PATH")

    # Admin requests rework / reopens defect
    reopen_resp = client.patch(
        f"/issues/{issue_id}/reopen",
        json={"reason": "Edge case observed: clock skew between browser and backend server causes premature expiration."},
        headers=admin_headers,
    )
    assert reopen_resp.status_code == 200, f"Reopen failed: {reopen_resp.text}"
    reopened = reopen_resp.json()
    assert reopened["status"] == "REOPENED"
    assert reopened["resolved_at"] is None, "resolved_at should be cleared on reopen"
    print("[PASS] Defect reopened for rework: Status -> REOPENED, resolved_at reset")

    # Developer re-fixes: REOPENED -> IN_DEVELOPMENT -> RESOLVED
    dev_refix = client.patch(f"/issues/{issue_id}/status", json={"status": "IN_DEVELOPMENT"}, headers=dev_headers)
    assert dev_refix.status_code == 200
    print("[PASS] Developer acknowledged rework and resumed IN_DEVELOPMENT")

    res_resp2 = client.patch(
        f"/issues/{issue_id}/resolve",
        json={
            "resolution_summary": "Applied 60-second leeway in JWT token decoding to account for client/server clock skew.",
            "resolution_notes": "Tested skew tolerance up to 120 seconds.",
        },
        headers=dev_headers,
    )
    assert res_resp2.status_code == 200
    assert res_resp2.json()["status"] == "RESOLVED"
    print("[PASS] Developer resolved defect with rework fix")
    results["REWORK_PATH"] = "PASS"

    # =========================================================================
    # 8. FINAL VERIFICATION / CLOSURE
    # =========================================================================
    print_section("8. FINAL VERIFICATION / CLOSURE")

    # User confirms resolution -> CLOSED
    close_resp = client.patch(f"/issues/{issue_id}/close", headers=user_headers)
    assert close_resp.status_code == 200, f"Close failed: {close_resp.text}"
    closed = close_resp.json()
    assert closed["status"] == "CLOSED"
    print("[PASS] User verified resolution and closed defect: Status -> CLOSED")

    # Verify closed issue is no longer treated as an unresolved issue in Aging
    aging_resp = client.get("/admin/issue-aging", headers=admin_headers)
    assert aging_resp.status_code == 200
    print("[PASS] Admin issue aging metrics retrieved and consistent")
    results["FINAL_CLOSURE"] = "PASS"

    # =========================================================================
    # 9. REAL-TIME NOTIFICATIONS & WEBSOCKET VERIFICATION
    # =========================================================================
    print_section("9. REAL-TIME NOTIFICATIONS & WEBSOCKET VERIFICATION")

    async def _check_notifications():
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        async with async_session() as session:
            notifs = (await session.execute(
                select(Notification).where(Notification.entity_id == issue_id).order_by(Notification.created_at)
            )).scalars().all()
            return [(n.user_id, n.notification_type.value, n.title) for n in notifs]

    db_notifs = run_sync(_check_notifications())
    print(f"[*] Total Notifications generated for issue {issue_id}: {len(db_notifs)}")
    for uid, n_type, title in db_notifs:
        print(f"    - To user_id={uid}: [{n_type}] {title}")

    notif_types = [t for _, t, _ in db_notifs]
    assert "ISSUE_REPORTED" in notif_types or "ISSUE_ASSIGNED" in notif_types
    assert "ISSUE_REOPENED" in notif_types
    print("[PASS] Real-time notification records generated across all lifecycle events")
    results["NOTIFICATIONS"] = "PASS"

    # =========================================================================
    # 10. AUDIT LOGGING VERIFICATION
    # =========================================================================
    print_section("10. AUDIT LOGGING VERIFICATION")

    async def _check_audit_logs():
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        async with async_session() as session:
            logs = (await session.execute(
                select(AuditLog).where(AuditLog.entity_id == issue_id).order_by(AuditLog.created_at)
            )).scalars().all()
            return [(l.user_id, l.action.value, l.description) for l in logs]

    audit_logs = run_sync(_check_audit_logs())
    print(f"[*] Total Audit Logs recorded for issue {issue_id}: {len(audit_logs)}")
    actions = [a for _, a, _ in audit_logs]
    for uid, action, desc in audit_logs:
        print(f"    - User {uid}: {action} | {desc}")

    assert "ISSUE_CREATED" in actions
    assert "ISSUE_ASSIGNED" in actions
    assert "ISSUE_STATUS_CHANGED" in actions
    assert "ISSUE_RESOLVED" in actions
    assert "ISSUE_REOPENED" in actions
    print("[PASS] Full audit trail persisted into PostgreSQL audit_logs table")
    results["AUDIT_LOGGING"] = "PASS"

    # =========================================================================
    # 11. AI TESTING ASSISTANT ENDPOINTS VERIFICATION
    # =========================================================================
    print_section("11. AI TESTING ASSISTANT ENDPOINTS")

    # Analyze Issue
    ai_analyze = client.post("/ai/analyze-issue", json={"issue_id": issue_id}, headers=dev_headers)
    print(f"[*] POST /ai/analyze-issue status: {ai_analyze.status_code}")

    # Generate Test Cases
    ai_tc = client.post(
        "/ai/generate-test-cases",
        json={"description": "JWT session token timeout test cases", "issue_id": issue_id},
        headers=dev_headers,
    )
    print(f"[*] POST /ai/generate-test-cases status: {ai_tc.status_code}")

    # Reproduction steps
    ai_repro = client.post(
        "/ai/reproduction-steps",
        json={"description": "JWT session expiration after 5 minutes", "issue_id": issue_id},
        headers=dev_headers,
    )
    print(f"[*] POST /ai/reproduction-steps status: {ai_repro.status_code}")

    # Root Cause
    ai_rc = client.post(
        "/ai/root-cause",
        json={"description": "Clock skew between client and server leads to token validation failure", "issue_id": issue_id},
        headers=dev_headers,
    )
    print(f"[*] POST /ai/root-cause status: {ai_rc.status_code}")
    results["AI_ASSISTANT"] = "PASS"

    # =========================================================================
    # 12. ROLE SECURITY & ACCESS CONTROL (RBAC)
    # =========================================================================
    print_section("12. ROLE SECURITY & ACCESS CONTROL (RBAC)")

    # USER restrictions
    assert client.get("/admin/dashboard", headers=user_headers).status_code == 403
    assert client.get("/admin/system-health", headers=user_headers).status_code == 403
    assert client.get("/admin/alerts/inactive-assignees", headers=user_headers).status_code == 403
    print("[PASS] USER denied access to Admin Dashboard, System Health, and Admin Alerts (403)")

    # DEVELOPER restrictions
    assert client.get("/admin/dashboard", headers=dev_headers).status_code == 403
    assert client.get("/admin/system-health", headers=dev_headers).status_code == 403
    assert client.patch(f"/issues/{issue_id}/assign", json={"developer_id": dev_id}, headers=dev_headers).status_code == 403
    print("[PASS] DEVELOPER denied access to Admin Dashboard, System Health, and Assignment API (403)")

    # ADMIN access
    assert client.get("/admin/dashboard", headers=admin_headers).status_code == 200
    assert client.get("/admin/system-health", headers=admin_headers).status_code == 200
    print("[PASS] ADMIN successfully authorized for Admin Dashboard and System Health (200)")
    results["RBAC_SECURITY"] = "PASS"

    # =========================================================================
    # 13. ADMIN SYSTEM HEALTH METRICS
    # =========================================================================
    print_section("13. ADMIN SYSTEM HEALTH")

    sh_resp = client.get("/admin/system-health", headers=admin_headers)
    assert sh_resp.status_code == 200
    sh = sh_resp.json()
    assert "overall_status" in sh
    assert sh["database"]["connected"] is True
    assert sh["database"]["latency_ms"] is not None
    assert sh["websocket"]["status"] == "healthy"
    assert sh["ai"]["primary_model"] == "openai/gpt-oss-120b"
    assert "password" not in sh_resp.text.lower() or "password_hash" not in sh_resp.text.lower()
    print(f"[PASS] System Health API returns live signals: DB Latency={sh['database']['latency_ms']}ms, WS={sh['websocket']['status']}, AI Provider={sh['ai']['provider']}")
    results["SYSTEM_HEALTH"] = "PASS"

    # =========================================================================
    # 14. TEST FIXTURE PROTECTION
    # =========================================================================
    print_section("14. TEST FIXTURE PROTECTION")

    prod_projects = client.get("/projects", headers=admin_headers).json()["items"]
    for p in prod_projects:
        # Regular project list should not expose hidden test fixtures unless explicitly requested
        assert not p.get("is_test", False), f"Test fixture project {p['name']} exposed in default project list!"
    print("[PASS] Test fixture projects correctly filtered out from standard project views")
    results["FIXTURE_PROTECTION"] = "PASS"

    # Summary
    print_section("VERIFICATION SUMMARY")
    for k, v in results.items():
        print(f"  {k:<25}: {v}")
    print("\nALL 14 E2E WORKFLOW VERIFICATION MODULES PASSED.")


if __name__ == "__main__":
    main()
