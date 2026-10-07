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

    def test_chat_user_role_allowed(self, client: TestClient, monkeypatch):
        """USER role is allowed to access the AI chat."""
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        r = client.post(
            "/ai/chat",
            json={"message": "Hello"},
            headers=auth_header(user_token()),
        )
        assert r.status_code == 200

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
        monkeypatch.setattr(settings, "GROQ_API_KEY", "")
        r = client.post(
            "/ai/chat",
            json={"message": "Hello"},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is False

    def test_chat_groq_fallback_when_gemini_missing(self, client: TestClient, monkeypatch):
        from app.core.config import settings
        monkeypatch.setattr(settings, "AI_ENABLED", True)
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
        monkeypatch.setattr(settings, "GROQ_API_KEY", "mock-groq-key")
        monkeypatch.setattr("app.services.ai_service._call_groq", lambda *args, **kwargs: "Groq response")
        r = client.post(
            "/ai/chat",
            json={"message": "Hello"},
            headers=auth_header(tester_token()),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["message"] == "Groq response"


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

    def test_all_specialized_endpoints_allow_user_role(self, client: TestClient, monkeypatch):
        _mock_ai_enabled(monkeypatch)
        _mock_gemini_call(monkeypatch)
        endpoints_bodies = [
            ("/ai/generate-test-cases", {"description": "test"}),
            ("/ai/reproduction-steps", {"description": "test"}),
            ("/ai/root-cause", {"description": "test"}),
            ("/ai/explain-metrics", {"question": "test", "metrics_context": "test"}),
        ]
        for endpoint, body in endpoints_bodies:
            r = client.post(
                endpoint,
                json=body,
                headers=auth_header(user_token()),
            )
            assert r.status_code == 200, f"{endpoint} should return 200 for USER role"


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


# ─────────────────────────────────────────────────────────────────────────────
# 9. Groq Production Models Suite
# ─────────────────────────────────────────────────────────────────────────────

import httpx

def _mock_groq_env(monkeypatch, key: str = "mock-groq-key-never-real"):
    from app.core.config import settings
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_PROVIDER", "groq")
    monkeypatch.setattr(settings, "GROQ_API_KEY", key)
    monkeypatch.setattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b")
    monkeypatch.setattr(settings, "GROQ_FALLBACK_MODEL", "openai/gpt-oss-20b")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")


class TestGroqProductionModels:
    """Comprehensive test suite for Groq production inference models."""

    @staticmethod
    def _groq_patch(handler):
        orig_post = httpx.Client.post

        def _post_wrapper(self, url, *args, **kwargs):
            if "api.groq.com" in str(url):
                return handler(str(url), *args, **kwargs)
            return orig_post(self, url, *args, **kwargs)

        return patch.object(httpx.Client, "post", _post_wrapper)

    def test_groq_provider_selection(self, client: TestClient, monkeypatch):
        """1. Verify Groq provider selection and default production models."""
        _mock_groq_env(monkeypatch)
        monkeypatch.setattr(
            "app.services.ai_service.verify_groq_models_available",
            lambda *a, **kw: {"verified": True, "primary_available": True, "fallback_available": True},
        )
        r = client.get("/ai/health", headers=auth_header(tester_token()))
        assert r.status_code == 200
        data = r.json()
        assert data["ai_provider"] == "groq"
        assert data["ai_model"] == "openai/gpt-oss-120b"
        assert data["fallback_model"] == "openai/gpt-oss-20b"
        assert data["model_verified"] is True
        assert data["status"] == "available"

    def test_primary_model_selection(self, monkeypatch):
        """2. Verify primary model 'openai/gpt-oss-120b' is selected on initial call."""
        _mock_groq_env(monkeypatch)
        from app.services import ai_service

        recorded_models: list[str] = []

        def mock_post(url, *args, **kwargs):
            json_body = kwargs.get("json", {})
            recorded_models.append(json_body.get("model"))
            return httpx.Response(
                200,
                json={"choices": [{"message": {"role": "assistant", "content": "Primary success"}}]},
                request=httpx.Request("POST", url),
            )

        with self._groq_patch(mock_post):
            resp = ai_service._call_groq("System prompt", [], "Test message")
            assert resp == "Primary success"
            assert recorded_models == ["openai/gpt-oss-120b"]
            assert ai_service.get_last_groq_model_used() == "openai/gpt-oss-120b"

    def test_fallback_model_selection(self, monkeypatch):
        """3. Verify fallback model 'openai/gpt-oss-20b' is selected if primary fails."""
        _mock_groq_env(monkeypatch)
        from app.services import ai_service

        recorded_models: list[str] = []

        def mock_post(url, *args, **kwargs):
            json_body = kwargs.get("json", {})
            model = json_body.get("model")
            recorded_models.append(model)
            if model == "openai/gpt-oss-120b":
                # Primary model failure (503 Service Unavailable)
                return httpx.Response(503, text="Service Unavailable", request=httpx.Request("POST", url))
            # Fallback model succeeds
            return httpx.Response(
                200,
                json={"choices": [{"message": {"role": "assistant", "content": "Fallback response"}}]},
                request=httpx.Request("POST", url),
            )

        with self._groq_patch(mock_post):
            resp = ai_service._call_groq("System prompt", [], "Test message")
            assert resp == "Fallback response"
            assert recorded_models == ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
            assert ai_service.get_last_groq_model_used() == "openai/gpt-oss-20b"

    def test_successful_chat_response(self, client: TestClient, monkeypatch):
        """4. Verify successful chat response end-to-end with Groq provider metadata."""
        _mock_groq_env(monkeypatch)

        def mock_post(url, *args, **kwargs):
            return httpx.Response(
                200,
                json={"choices": [{"message": {"role": "assistant", "content": "QA guidance from gpt-120b"}}]},
                request=httpx.Request("POST", url),
            )

        with self._groq_patch(mock_post):
            r = client.post(
                "/ai/chat",
                json={"message": "What is exploratory testing?"},
                headers=auth_header(tester_token()),
            )
            assert r.status_code == 200
            data = r.json()
            assert data["success"] is True
            assert data["message"] == "QA guidance from gpt-120b"
            assert data["metadata"]["provider"] == "groq"
            assert data["metadata"]["model"] == "openai/gpt-oss-120b"

    def test_primary_model_failure_fallback_end_to_end(self, client: TestClient, monkeypatch):
        """5. Verify primary model failure -> fallback works end-to-end through API."""
        _mock_groq_env(monkeypatch)

        def mock_post(url, *args, **kwargs):
            json_body = kwargs.get("json", {})
            if json_body.get("model") == "openai/gpt-oss-120b":
                return httpx.Response(500, text="Internal Server Error", request=httpx.Request("POST", url))
            return httpx.Response(
                200,
                json={"choices": [{"message": {"role": "assistant", "content": "Answer from fallback 20b"}}]},
                request=httpx.Request("POST", url),
            )

        with self._groq_patch(mock_post):
            r = client.post(
                "/ai/chat",
                json={"message": "Explain test boundary analysis"},
                headers=auth_header(tester_token()),
            )
            assert r.status_code == 200
            data = r.json()
            assert data["success"] is True
            assert data["message"] == "Answer from fallback 20b"
            assert data["metadata"]["model"] == "openai/gpt-oss-20b"

    def test_429_rate_limit_handling(self, client: TestClient, monkeypatch):
        """6. Verify HTTP 429 rate limit triggers immediate fallback without failure."""
        _mock_groq_env(monkeypatch)

        def mock_post(url, *args, **kwargs):
            json_body = kwargs.get("json", {})
            if json_body.get("model") == "openai/gpt-oss-120b":
                return httpx.Response(429, text="Rate limit exceeded", request=httpx.Request("POST", url))
            return httpx.Response(
                200,
                json={"choices": [{"message": {"role": "assistant", "content": "Recovered via 20b on 429"}}]},
                request=httpx.Request("POST", url),
            )

        with self._groq_patch(mock_post):
            r = client.post(
                "/ai/chat",
                json={"message": "Suggest regression checklist"},
                headers=auth_header(tester_token()),
            )
            assert r.status_code == 200
            data = r.json()
            assert data["success"] is True
            assert data["message"] == "Recovered via 20b on 429"
            assert data["metadata"]["model"] == "openai/gpt-oss-20b"

    def test_5xx_handling(self, client: TestClient, monkeypatch):
        """7. Verify 5xx errors trigger fallback, and if both fail, returns graceful error."""
        _mock_groq_env(monkeypatch)

        # Case A: 502 triggers fallback successfully
        def mock_502_then_ok(url, *args, **kwargs):
            json_body = kwargs.get("json", {})
            if json_body.get("model") == "openai/gpt-oss-120b":
                return httpx.Response(502, text="Bad Gateway", request=httpx.Request("POST", url))
            return httpx.Response(
                200,
                json={"choices": [{"message": {"role": "assistant", "content": "Recovered on 502"}}]},
                request=httpx.Request("POST", url),
            )

        with self._groq_patch(mock_502_then_ok):
            r = client.post(
                "/ai/chat",
                json={"message": "Help"},
                headers=auth_header(tester_token()),
            )
            assert r.status_code == 200
            assert r.json()["success"] is True

        # Case B: Both 120b and 20b return 500 -> graceful response, no unhandled 500 crash
        def mock_both_500(url, *args, **kwargs):
            return httpx.Response(500, text="Internal Server Error", request=httpx.Request("POST", url))

        with self._groq_patch(mock_both_500):
            r = client.post(
                "/ai/chat",
                json={"message": "Help"},
                headers=auth_header(tester_token()),
            )
            assert r.status_code == 200
            data = r.json()
            assert data["success"] is False
            assert "temporarily unavailable" in data["message"].lower()

    def test_invalid_api_key_handling(self, client: TestClient, monkeypatch):
        """8. Verify 401 Unauthorized fails immediately and does not retry fallback model."""
        _mock_groq_env(monkeypatch)
        calls_made = []

        def mock_401(url, *args, **kwargs):
            json_body = kwargs.get("json", {})
            calls_made.append(json_body.get("model"))
            return httpx.Response(401, text="Unauthorized: Invalid API Key", request=httpx.Request("POST", url))

        with self._groq_patch(mock_401):
            r = client.post(
                "/ai/chat",
                json={"message": "Hello"},
                headers=auth_header(tester_token()),
            )
            assert r.status_code == 200
            data = r.json()
            assert data["success"] is False
            # Fails immediately on 401 without retrying fallback model
            assert len(calls_made) == 1
            assert calls_made[0] == "openai/gpt-oss-120b"

    def test_api_key_is_never_exposed(self, client: TestClient, monkeypatch):
        """9. Verify secret API key is never exposed in responses or exceptions."""
        dummy_secret = "gsk_TEST_SECRET_KEY_MUST_NOT_LEAK_99999"
        _mock_groq_env(monkeypatch, key=dummy_secret)

        def mock_error_with_key(url, *args, **kwargs):
            # Simulate a provider error containing the key string
            return httpx.Response(
                400,
                text=f"Error using key {dummy_secret}: bad request",
                request=httpx.Request("POST", url),
            )

        with self._groq_patch(mock_error_with_key):
            r = client.post(
                "/ai/chat",
                json={"message": "Test secret sanitization"},
                headers=auth_header(tester_token()),
            )
            assert r.status_code == 200
            raw_response = r.text
            assert dummy_secret not in raw_response
            assert "gsk_" not in raw_response

    def test_all_user_roles_access_groq(self, client: TestClient, monkeypatch):
        """10. Verify USER, DEVELOPER, and ADMIN roles all access Groq AI assistant."""
        _mock_groq_env(monkeypatch)

        def mock_post(url, *args, **kwargs):
            return httpx.Response(
                200,
                json={"choices": [{"message": {"role": "assistant", "content": "Role test passed"}}]},
                request=httpx.Request("POST", url),
            )

        with self._groq_patch(mock_post):
            for role_token in [user_token(), tester_token(), admin_token()]:
                r = client.post(
                    "/ai/chat",
                    json={"message": "Testing role access"},
                    headers=auth_header(role_token),
                )
                assert r.status_code == 200
                assert r.json()["success"] is True

    def test_existing_ai_endpoints_work_with_groq(self, client: TestClient, monkeypatch):
        """11. Verify all specialized AI endpoints work properly with Groq provider."""
        _mock_groq_env(monkeypatch)

        def mock_post(url, *args, **kwargs):
            return httpx.Response(
                200,
                json={"choices": [{"message": {"role": "assistant", "content": "Specialized output"}}]},
                request=httpx.Request("POST", url),
            )

        with self._groq_patch(mock_post):
            endpoints_and_payloads = [
                ("/ai/generate-test-cases", {"description": "Login flow"}),
                ("/ai/reproduction-steps", {"description": "Crash on submit"}),
                ("/ai/root-cause", {"description": "High latency on search"}),
                ("/ai/explain-metrics", {"question": "What is MTTR?", "metrics_context": "MTTR=24h"}),
            ]
            for endpoint, payload in endpoints_and_payloads:
                r = client.post(endpoint, json=payload, headers=auth_header(tester_token()))
                assert r.status_code == 200
                data = r.json()
                assert data["success"] is True
                assert data["message"] == "Specialized output"
                assert data["metadata"]["provider"] == "groq"
                assert data["metadata"]["model"] == "openai/gpt-oss-120b"

    def test_model_discovery_verification(self, monkeypatch):
        """12. Verify GET /models discovery check caches safely and identifies models."""
        _mock_groq_env(monkeypatch)
        from app.services import ai_service

        def mock_models_get(self, url, *args, **kwargs):
            return httpx.Response(
                200,
                json={
                    "data": [
                        {"id": "openai/gpt-oss-120b"},
                        {"id": "openai/gpt-oss-20b"},
                        {"id": "other-model"},
                    ]
                },
                request=httpx.Request("GET", url),
            )

        with patch.object(httpx.Client, "get", mock_models_get):
            # Clear cache
            ai_service._models_cache["result"] = None
            ai_service._models_cache["timestamp"] = 0.0

            result = ai_service.verify_groq_models_available(cache_ttl_seconds=60)
            assert result["verified"] is True
            assert result["primary_available"] is True
            assert result["fallback_available"] is True
            assert result["models_count"] == 3


