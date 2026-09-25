"""
Tests for the AI Testing Assistant API endpoints.

These tests:
- Mock the external AI provider (google-generativeai) — no real API key needed
- Test authentication and RBAC
- Test all specialized endpoints
- Test error conditions
- Test request validation
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import (
    admin_token,
    auth_header,
    tester_token,
    user_token,
)

# ─────────────────────────────────────────────────────────────────────────────
# Shared client
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

AI_MOCK_RESPONSE = "This is a mocked AI response for testing."


def _mock_ai_enabled(monkeypatch):
    """Patch settings so AI looks enabled/configured."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "mock-key-for-testing")
    monkeypatch.setattr(settings, "AI_MODEL", "gemini-2.5-flash")


def _mock_gemini_call(monkeypatch):
    """Patch the internal _call_gemini so no real API call is made."""
    monkeypatch.setattr(
        "app.services.ai_service._call_gemini",
        lambda *args, **kwargs: AI_MOCK_RESPONSE,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 1. Health endpoint
# ─────────────────────────────────────────────────────────────────────────────

class TestAIHealth:
    def test_health_requires_auth(self, client: TestClient):
        r = client.get("/ai/health")
        assert r.status_code == 401

    def test_health_authenticated(self, client: TestClient):
        r = client.get("/ai/health", headers=auth_header(tester_token()))
        assert r.status_code == 200
        data = r.json()
        assert "ai_enabled" in data
        assert "ai_provider" in data
        assert "ai_model" in data
        assert "api_key_configured" in data
        assert "status" in data

    def test_health_user_role_allowed(self, client: TestClient):
        """Any authenticated user can check health."""
        r = client.get("/ai/health", headers=auth_header(user_token()))
        assert r.status_code == 200

    def test_health_admin_allowed(self, client: TestClient):
        r = client.get("/ai/health", headers=auth_header(admin_token()))
        assert r.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# 2. Chat endpoint — authentication
# ─────────────────────────────────────────────────────────────────────────────

class TestAIChatAuth:
    def test_chat_unauthenticated(self, client: TestClient):
        r = client.post("/ai/chat", json={"message": "Hello"})
        assert r.status_code == 401

    def test_chat_user_role_forbidden(self, client: TestClient):
        """USER role should be denied access to the AI chat."""
        r = client.post(
            "/ai/chat",
            json={"message": "Hello"},
            headers=auth_header(user_token()),
        )
        assert r.status_code == 403

    def test_chat_tester_allowed(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/chat",
            json={"message": "What is a regression test?"},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["message"] == AI_MOCK_RESPONSE
        assert "conversation_id" in data
        assert "metadata" in data

    def test_chat_admin_allowed(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/chat",
            json={"message": "What is a regression test?"},
            headers=auth_header(admin_token()),
        )
        assert r.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# 3. Chat endpoint — validation
# ─────────────────────────────────────────────────────────────────────────────

class TestAIChatValidation:
    def test_empty_message_rejected(self, client: TestClient):
        r = client.post(
            "/ai/chat",
            json={"message": ""},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 422

    def test_missing_message_rejected(self, client: TestClient):
        r = client.post(
            "/ai/chat",
            json={},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 422

    def test_message_too_long(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        long_message = "x" * 4001
        r = client.post(
            "/ai/chat",
            json={"message": long_message},
            headers=auth_header(tester_token()),
        )
        # Pydantic validation rejects it at 422, or service returns success=False
        assert r.status_code in (422, 200)
        if r.status_code == 200:
            assert r.json()["success"] is False

    def test_response_structure(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/chat",
            json={"message": "Help me write test cases."},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        assert "success" in data
        assert "message" in data
        assert "conversation_id" in data
        assert "metadata" in data
        assert "model" in data["metadata"]
        assert "issue_context_used" in data["metadata"]
        assert "sprint_context_used" in data["metadata"]

    def test_conversation_history_sent(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/chat",
            json={
                "message": "Follow-up question",
                "conversation": [
                    {"role": "user", "content": "What is a smoke test?"},
                    {"role": "assistant", "content": "A smoke test is..."},
                ],
            },
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        assert r.json()["success"] is True


# ─────────────────────────────────────────────────────────────────────────────
# 4. Chat when AI is disabled
# ─────────────────────────────────────────────────────────────────────────────

class TestAIDisabled:
    def test_chat_disabled_returns_graceful_error(self, client: TestClient, monkeypatch):
        from app.core.config import settings
        monkeypatch.setattr(settings, "AI_ENABLED", False)
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
        r = client.post(
            "/ai/chat",
            json={"message": "Hello"},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is False
        assert "disabled" in data["message"].lower() or "configured" in data["message"].lower()

    def test_chat_no_key_returns_graceful_error(self, client: TestClient, monkeypatch):
        from app.core.config import settings
        monkeypatch.setattr(settings, "AI_ENABLED", True)
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
        r = client.post(
            "/ai/chat",
            json={"message": "Hello"},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 5. AI provider failure
# ─────────────────────────────────────────────────────────────────────────────

class TestAIProviderFailure:
    def test_provider_exception_returns_graceful_error(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        def _raise(*args, **kwargs):
            raise Exception("API timeout")
        monkeypatch.setattr("app.services.ai_service._call_gemini", _raise)
        r = client.post(
            "/ai/chat",
            json={"message": "Help me debug this API."},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is False
        assert "unavailable" in data["message"].lower()

    def test_no_stack_trace_in_response(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        def _raise(*args, **kwargs):
            raise RuntimeError("Connection refused")
        monkeypatch.setattr("app.services.ai_service._call_gemini", _raise)
        r = client.post(
            "/ai/chat",
            json={"message": "Test question"},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        # No traceback should leak to the user
        assert "Traceback" not in data["message"]
        assert "GEMINI_API_KEY" not in data["message"]


# ─────────────────────────────────────────────────────────────────────────────
# 6. Specialized endpoints
# ─────────────────────────────────────────────────────────────────────────────

class TestSpecializedEndpoints:
    def test_analyze_issue_requires_issue_id(self, client: TestClient):
        r = client.post(
            "/ai/analyze-issue",
            json={},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 422

    def test_analyze_issue_not_found(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/analyze-issue",
            json={"issue_id": 99999999},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is False
        assert "not found" in data["message"].lower()

    def test_generate_test_cases(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/generate-test-cases",
            json={"description": "Login button does not respond on mobile devices"},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_reproduction_steps(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/reproduction-steps",
            json={"description": "Payment form crashes on submit with invalid card"},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_root_cause_analysis(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/root-cause",
            json={"description": "Database connection times out after 30 seconds"},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_sprint_summary_not_found(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/sprint-summary",
            json={"sprint_id": 99999999},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is False
        assert "not found" in data["message"].lower()

    def test_explain_metrics(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/explain-metrics",
            json={
                "question": "Why did unresolved defects increase this week?",
                "metrics_context": "Open: 15, Resolved: 8, In Testing: 4",
            },
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_all_specialized_endpoints_require_tester_role(self, client: TestClient):
        endpoints_bodies = [
            ("/ai/generate-test-cases", {"description": "test"}),
            ("/ai/reproduction-steps", {"description": "test"}),
            ("/ai/root-cause", {"description": "test"}),
            ("/ai/explain-metrics", {"question": "test"}),
        ]
        for endpoint, body in endpoints_bodies:
            r = client.post(
                endpoint,
                json=body,
                headers=auth_header(user_token()),
            )
            assert r.status_code == 403, f"{endpoint} should return 403 for USER role"


# ─────────────────────────────────────────────────────────────────────────────
# 7. Issue context integration
# ─────────────────────────────────────────────────────────────────────────────

class TestIssueContext:
    def test_chat_with_issue_id_nonexistent(self, client: TestClient, monkeypatch):
        """When issue_id is provided but does not exist, AI should still respond."""
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/chat",
            json={"message": "Analyze this issue", "issue_id": 99999999},
            headers=auth_header(tester_token()),
        )
        # Should still succeed — context is optional
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        # Context was not used since issue doesn't exist
        assert data["metadata"]["issue_context_used"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 8. Sprint context integration
# ─────────────────────────────────────────────────────────────────────────────

class TestSprintContext:
    def test_chat_with_sprint_id_nonexistent(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/chat",
            json={"message": "Summarize this sprint", "sprint_id": 99999999},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["metadata"]["sprint_context_used"] is False
