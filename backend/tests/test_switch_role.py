"""
Tests for POST /auth/switch-role (Admin Role Switching / Session Impersonation).

Verifies:
  1. Only ADMIN users may invoke the switch-role endpoint (403 for non-admins).
  2. Unauthenticated calls return 401.
  3. Switching returns a valid JWT scoped strictly to the target user and role.
  4. Preserves RBAC: newly issued token cannot access admin-only endpoints.
  5. Target not found returns 404.
  6. An immutable AuditLog entry is recorded with action=ADMIN_SWITCH_ROLE,
     original admin ID, target user ID, target role, and timestamp.
"""

import pytest
from fastapi.testclient import TestClient
import jwt
from sqlalchemy import desc, select

from app.core.config import settings
from app.database.connection import engine
from app.models.audit_log import AuditAction, AuditLog
from app.models.user import User, UserRole
from tests.conftest import (
    admin_token,
    tester_token,
    user_token,
    _run_sync,
)


def _get_user_by_email(email: str) -> User:
    async def _query():
        from sqlalchemy.ext.asyncio import AsyncSession
        async with AsyncSession(engine) as session:
            result = await session.execute(select(User).where(User.email == email))
            return result.scalar_one()
    return _run_sync(_query())


class TestSwitchRoleSecurity:
    """Security tests for POST /auth/switch-role."""

    def test_unauthenticated_request_rejected(self, api_client: TestClient) -> None:
        """Unauthenticated caller receives 401."""
        res = api_client.post("/auth/switch-role", json={"target_user_id": 1})
        assert res.status_code == 401

    def test_non_admin_caller_rejected_with_403(self, api_client: TestClient) -> None:
        """TESTER and USER callers receive 403 Forbidden."""
        # Target an existing user
        tester = _get_user_by_email("tester.p4ci@example.com")
        admin = _get_user_by_email("admin.p4ci@example.com")

        # Caller: TESTER
        res = api_client.post(
            "/auth/switch-role",
            json={"target_user_id": admin.id},
            headers={"Authorization": f"Bearer {tester_token()}"},
        )
        assert res.status_code == 403
        assert "Only administrators" in res.json()["detail"]

        # Caller: USER
        res_user = api_client.post(
            "/auth/switch-role",
            json={"target_user_id": tester.id},
            headers={"Authorization": f"Bearer {user_token()}"},
        )
        assert res_user.status_code == 403
        assert "Only administrators" in res_user.json()["detail"]

    def test_target_user_not_found_returns_404(self, api_client: TestClient) -> None:
        """Admin switching to non-existent user ID returns 404."""
        res = api_client.post(
            "/auth/switch-role",
            json={"target_user_id": 99999999},
            headers={"Authorization": f"Bearer {admin_token()}"},
        )
        assert res.status_code == 404
        assert "Target user not found" in res.json()["detail"]

    def test_admin_can_switch_to_tester(self, api_client: TestClient) -> None:
        """Admin successfully switches to a DEVELOPER (formerly TESTER) user.

        Verifies:
          - 200 OK
          - Target user info in response
          - JWT claims: sub=target_id, role=DEVELOPER
          - GET /auth/me returns DEVELOPER profile
          - Preserves RBAC: new token cannot call GET /users (403 Forbidden)
        """
        tester = _get_user_by_email("tester.p4ci@example.com")

        res = api_client.post(
            "/auth/switch-role",
            json={"target_user_id": tester.id},
            headers={"Authorization": f"Bearer {admin_token()}"},
        )
        assert res.status_code == 200
        data = res.json()

        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["id"] == tester.id
        assert data["user"]["role"] == "DEVELOPER"
        assert data["user"]["email"] == tester.email

        # Decode JWT and inspect claims
        new_token = data["access_token"]
        payload = jwt.decode(
            new_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        assert payload["sub"] == str(tester.id)
        assert payload["role"] == "DEVELOPER"

        # Using new token for GET /auth/me
        me_res = api_client.get("/auth/me", headers={"Authorization": f"Bearer {new_token}"})
        assert me_res.status_code == 200
        assert me_res.json()["role"] == "DEVELOPER"
        assert me_res.json()["id"] == tester.id

        # RBAC Check: New token cannot call admin-only GET /users
        users_res = api_client.get("/users", headers={"Authorization": f"Bearer {new_token}"})
        assert users_res.status_code == 403

    def test_admin_can_switch_to_user(self, api_client: TestClient) -> None:
        """Admin can switch to a USER account."""
        user_obj = _get_user_by_email("user.p4ci@example.com")
        res_user = api_client.post(
            "/auth/switch-role",
            json={"target_user_id": user_obj.id},
            headers={"Authorization": f"Bearer {admin_token()}"},
        )
        assert res_user.status_code == 200
        assert res_user.json()["user"]["role"] == "USER"
        assert res_user.json()["user"]["id"] == user_obj.id

    def test_switch_role_creates_audit_log(self, api_client: TestClient) -> None:
        """Switching roles creates an ADMIN_SWITCH_ROLE audit entry.

        Verifies:
          - AuditAction.ADMIN_SWITCH_ROLE
          - Actor is original admin
          - Target is target user
          - Target role in new_values
          - Timestamp is recorded
        """
        admin = _get_user_by_email("admin.p4ci@example.com")
        tester = _get_user_by_email("tester2.p4ci@example.com")

        res = api_client.post(
            "/auth/switch-role",
            json={"target_user_id": tester.id},
            headers={"Authorization": f"Bearer {admin_token()}"},
        )
        assert res.status_code == 200

        # Query database directly for the audit entry
        async def _check_audit():
            from sqlalchemy.ext.asyncio import AsyncSession
            async with AsyncSession(engine) as session:
                query = (
                    select(AuditLog)
                    .where(AuditLog.action == AuditAction.ADMIN_SWITCH_ROLE)
                    .order_by(desc(AuditLog.created_at))
                    .limit(1)
                )
                result = await session.execute(query)
                return result.scalar_one_or_none()

        audit = _run_sync(_check_audit())
        assert audit is not None, "Expected ADMIN_SWITCH_ROLE audit log entry"
        assert audit.user_id == admin.id
        assert audit.entity_id == tester.id
        assert audit.entity_key == tester.email
        assert audit.new_values.get("target_user_id") == tester.id
        assert audit.new_values.get("target_role") == "DEVELOPER"
        assert audit.new_values.get("action") == "ADMIN_SWITCH_ROLE"
        assert audit.old_values.get("admin_user_id") == admin.id
        assert audit.created_at is not None
