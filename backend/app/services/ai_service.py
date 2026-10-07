"""
AI Service for TracePilot.

Architecture:
  AI Router
      ↓
  AI Service  (this file)
      ↓
  AI Provider
      ↓
  Gemini / configured model

The service handles:
  - system prompt construction
  - conversation history management (with limits)
  - issue & sprint context retrieval
  - AI provider call
  - response parsing
  - error handling

The AI is advisory-only. It must NEVER modify database records.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.issue import Issue
from app.models.issue_comment import IssueComment
from app.models.sprint import Sprint

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------#
# Constants                                                                   #
# ---------------------------------------------------------------------------#

MAX_MESSAGE_LENGTH = 4000
MAX_CONVERSATION_TURNS = 10   # 10 user+assistant pairs = 20 messages max
MAX_COMMENT_CHARS = 500       # Truncate long comments in context
TRACEPILOT_SYSTEM_PROMPT = """You are TracePilot AI, an expert software testing assistant embedded in the TracePilot Automated Defect Tracking and Resolution System.

SYSTEM DOMAIN & ARCHITECTURAL CONTEXT:
- TracePilot is an automated defect tracking, QA testing, and sprint resolution system.
- User Roles & Responsibilities:
  * ADMIN: System administration, sprint lifecycle approvals, issue triaging, developer workload assignment, and system governance.
  * DEVELOPER: Defect investigation, root-cause resolution, fix implementation, and unit/integration verification.
  * USER: Issue reporting, reproduction clarification, and post-resolution verification.
- Canonical Workflow:
  USER (Reports Issue) → ADMIN (Triages & Assigns) → DEVELOPER (Investigates & Resolves) → RESOLUTION → ADMIN / USER VERIFICATION (Validates Fix & Closes).
- Core TracePilot Entities & States:
  * Issues: Types (BUG, FEATURE, TASK, IMPROVEMENT), Status (OPEN, IN_PROGRESS, RESOLVED, CLOSED), Severity (CRITICAL, HIGH, MEDIUM, LOW), Priority (URGENT, HIGH, MEDIUM, LOW), Component, Environment, Steps to Reproduce.
  * Projects: Groupings with project keys, leads, and milestones.
  * Sprints: Agile iterations with lifecycle (PLANNED, ACTIVE, COMPLETED, ARCHIVED), assignees, velocity, and admin review comments.
  * Developer Assignment: Issue assignment, workload distribution, and resolution accountability.
  * Issue Aging & Backlog Health: Monitoring stale defects, priority queues, and SLA compliance.
  * SEO / External Context: Only referenced when explicitly provided in the request or project details.

CRITICAL OPERATIONAL RULES:
1. ADVISORY ONLY: You are strictly an advisory assistant. You must NEVER claim to have performed, or be able to automatically perform, database changes (e.g., assigning issues, closing defects, altering sprint status, deleting records, or modifying users). Always instruct the user on the appropriate actions to take through the TracePilot UI.
2. DISTINGUISH FACTS FROM INFERENCE:
   - Always clearly distinguish between:
     (a) Confirmed Facts retrieved directly from TracePilot database context (e.g. specific issue details, status, sprint metrics).
     (b) AI-generated recommendations, hypotheses, and suggested test cases.
     (c) Information that is missing, not provided, or unavailable.
3. NEVER FABRICATE DATA: Never hallucinate or invent non-existent database records, user names, issue IDs, project keys, timestamps, commits, or metrics. If information is not in the context, explicitly state that it is unavailable.
4. ROOT CAUSE UNCERTAINTY: For root cause analysis, always present possibilities using cautious language ("Possible cause:", "Likely area to investigate:", "Hypothesis:") rather than claiming certainty.
5. CONCISE & ACTIONABLE: Deliver concise, highly technical, and actionable guidance formatted in clean markdown (headers ##, bullet points -, numbered steps, and code blocks)."""


# ---------------------------------------------------------------------------#
# Data classes                                                                #
# ---------------------------------------------------------------------------#

@dataclass
class ConversationMessage:
    role: str   # "user" or "assistant"
    content: str


@dataclass
class AIRequest:
    message: str
    conversation_history: list[ConversationMessage] = field(default_factory=list)
    issue_id: int | None = None
    sprint_id: int | None = None
    conversation_id: str | None = None


@dataclass
class AIResponse:
    success: bool
    message: str
    conversation_id: str
    model: str
    issue_context_used: bool = False
    sprint_context_used: bool = False
    error: str | None = None


def _sanitize_error(msg: str) -> str:
    """Ensure no API keys appear in error messages or logs."""
    cleaned = str(msg)
    if settings.GROQ_API_KEY and settings.GROQ_API_KEY in cleaned:
        cleaned = cleaned.replace(settings.GROQ_API_KEY, "[REDACTED]")
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY in cleaned:
        cleaned = cleaned.replace(settings.GEMINI_API_KEY, "[REDACTED]")
    return cleaned


_last_groq_model_used: str = ""


def get_last_groq_model_used() -> str:
    """Return the model ID used by the most recent Groq inference call."""
    return _last_groq_model_used or settings.GROQ_MODEL


def _is_ai_available() -> bool:
    """Return True if AI is enabled and at least one API key (Gemini or Groq) is configured."""
    return bool(settings.AI_ENABLED and (settings.GEMINI_API_KEY or settings.GROQ_API_KEY))


def _get_active_model() -> str:
    """Return the name of the model currently active or intended as default."""
    if settings.AI_PROVIDER == "groq" or (not settings.GEMINI_API_KEY and settings.GROQ_API_KEY):
        return _last_groq_model_used or settings.GROQ_MODEL
    return settings.AI_MODEL


# ---------------------------------------------------------------------------#
# Model Discovery & Health Check                                             #
# ---------------------------------------------------------------------------#

_models_cache: dict[str, Any] = {"timestamp": 0.0, "result": None}


def verify_groq_models_available(cache_ttl_seconds: int = 300) -> dict[str, Any]:
    """
    Check if the configured Groq models exist using GET https://api.groq.com/openai/v1/models.
    Caches results in memory for cache_ttl_seconds to avoid excessive requests.
    Used for startup/health checks and debugging. Never called on every chat request.
    Never exposes GROQ_API_KEY or internal credentials.
    """
    import time
    now = time.time()
    if _models_cache["result"] is not None and (now - _models_cache["timestamp"]) < cache_ttl_seconds:
        return _models_cache["result"]

    if not settings.GROQ_API_KEY:
        res = {
            "verified": False,
            "error": "GROQ_API_KEY is not configured",
            "primary_available": False,
            "fallback_available": False,
        }
        _models_cache["result"] = res
        _models_cache["timestamp"] = now
        return res

    import httpx
    url = "https://api.groq.com/openai/v1/models"
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}

    try:
        with httpx.Client(timeout=6.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                model_ids = {m.get("id") for m in data if isinstance(m, dict)}
                primary_ok = settings.GROQ_MODEL in model_ids
                fallback_ok = settings.GROQ_FALLBACK_MODEL in model_ids
                res = {
                    "verified": True,
                    "primary_available": primary_ok,
                    "fallback_available": fallback_ok,
                    "primary_model": settings.GROQ_MODEL,
                    "fallback_model": settings.GROQ_FALLBACK_MODEL,
                    "models_count": len(model_ids),
                }
            elif resp.status_code == 401:
                res = {
                    "verified": False,
                    "error": "Invalid API key",
                    "primary_available": False,
                    "fallback_available": False,
                }
            else:
                res = {
                    "verified": False,
                    "error": f"HTTP {resp.status_code}",
                    "primary_available": False,
                    "fallback_available": False,
                }
    except Exception as exc:
        res = {
            "verified": False,
            "error": f"Connection error: {type(exc).__name__}",
            "primary_available": False,
            "fallback_available": False,
        }

    _models_cache["result"] = res
    _models_cache["timestamp"] = now
    return res


# ---------------------------------------------------------------------------#
# Provider abstraction                                                        #
# ---------------------------------------------------------------------------#

def _call_groq(
    system_prompt: str,
    conversation_history: list[ConversationMessage],
    user_message: str,
) -> str:
    """
    Call the Groq API via HTTPX (OpenAI-compatible chat completions).

    Routing:
      1. Primary production model: settings.GROQ_MODEL ('openai/gpt-oss-120b')
      2. If primary fails due to temporary errors (429, 5xx, timeout, network failure, model unavailable),
         automatically falls back to settings.GROQ_FALLBACK_MODEL ('openai/gpt-oss-20b').
      3. For permanent errors (401 invalid key, 403 forbidden), fails fast without retrying.

    Never prints or leaks GROQ_API_KEY in logs, exceptions, or responses.
    """
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured.")

    import httpx

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for msg in conversation_history:
        role = "user" if msg.role == "user" else "assistant"
        messages.append({"role": role, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    # Strict production model routing: Primary -> Fallback
    models_to_try = [settings.GROQ_MODEL]
    if settings.GROQ_FALLBACK_MODEL and settings.GROQ_FALLBACK_MODEL != settings.GROQ_MODEL:
        models_to_try.append(settings.GROQ_FALLBACK_MODEL)

    global _last_groq_model_used
    last_exc: Exception | None = None

    for idx, model_name in enumerate(models_to_try):
        is_primary = (idx == 0)
        # Timeout budget: primary 10s, fallback 8s (well under Axios 15s limit)
        timeout_val = 10.0 if is_primary else 8.0

        try:
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": 0.4,
                "max_tokens": 4096,
            }
            with httpx.Client(timeout=timeout_val) as client:
                res = client.post(url, headers=headers, json=payload)

                # Permanent Authentication / Authorization errors: fail fast, do not retry fallback
                if res.status_code == 401:
                    logger.error("Groq authentication failed (HTTP 401). Invalid API key.")
                    raise ValueError("Groq authentication failed. Please verify GROQ_API_KEY configuration.")
                if res.status_code == 403:
                    logger.error("Groq permission denied (HTTP 403).")
                    raise ValueError("Groq API access forbidden.")

                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        msg_obj = choices[0]["message"]
                        content = msg_obj.get("content") or ""
                        if not content.strip() and msg_obj.get("reasoning"):
                            content = msg_obj.get("reasoning", "")
                        if content and content.strip():
                            _last_groq_model_used = model_name
                            return content.strip()

                    raise ValueError("Groq returned malformed or empty message response.")

                # Temporary errors (429 rate limit, 5xx server error, 404/400 model unavailable)
                status = res.status_code
                if status == 429:
                    logger.warning("Groq rate limit (HTTP 429) on model %s", model_name)
                elif status >= 500:
                    logger.warning("Groq server error (HTTP %s) on model %s", status, model_name)
                else:
                    logger.warning("Groq HTTP error (%s) on model %s", status, model_name)

                res.raise_for_status()

        except ValueError:
            # Re-raise auth/config validation errors immediately
            raise
        except Exception as exc:
            last_exc = exc
            sanitized_exc = _sanitize_error(str(exc))
            logger.warning(
                "Groq call failed for model %s: %s%s",
                model_name,
                sanitized_exc,
                " -> attempting fallback..." if is_primary and len(models_to_try) > 1 else "",
            )
            continue

    if last_exc:
        sanitized_msg = _sanitize_error(str(last_exc))
        raise RuntimeError(f"All Groq model attempts failed: {sanitized_msg}")
    raise RuntimeError("All Groq model attempts failed.")


def _call_gemini(
    system_prompt: str,
    conversation_history: list[ConversationMessage],
    user_message: str,
) -> str:
    """
    Call the AI provider.
    - If AI_PROVIDER is 'groq', routes to Groq first.
    - If AI_PROVIDER is 'gemini' (or default):
        Calls Gemini using google.genai.
        If Gemini is unconfigured, or encounters any error (503 overload, quota,
        model unavailable, invalid key), automatically falls back to Groq if configured.
    """
    # 1. Direct Groq preference
    if (settings.AI_PROVIDER == "groq" or not settings.GEMINI_API_KEY) and settings.GROQ_API_KEY:
        try:
            return _call_groq(system_prompt, conversation_history, user_message)
        except Exception as exc:
            logger.warning("Groq provider call failed: %s", _sanitize_error(str(exc)))
            if settings.GEMINI_API_KEY:
                logger.info("Falling back from Groq to Gemini...")
            else:
                raise

    # 2. If Gemini API key is missing or blank but Groq is available: use Groq directly
    if not settings.GEMINI_API_KEY and settings.GROQ_API_KEY:
        logger.info("GEMINI_API_KEY not set; using Groq as default AI provider.")
        return _call_groq(system_prompt, conversation_history, user_message)

    # 3. Call Gemini
    try:
        from google import genai  # type: ignore[import]
        from google.genai import types as genai_types  # type: ignore[import]
    except ImportError:
        if settings.GROQ_API_KEY:
            logger.warning("google-genai package not installed; falling back to Groq.")
            return _call_groq(system_prompt, conversation_history, user_message)
        raise RuntimeError(
            "google-genai package is not installed. "
            "Run: pip install google-genai"
        )

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # Normalize the model name — prefix "models/" if not already present
    model_name = settings.AI_MODEL
    if not model_name.startswith("models/"):
        model_name = f"models/{model_name}"

    import time as _time

    # Model fallback: if primary is overloaded try stable alternatives
    _FALLBACK_MODELS = [model_name, "models/gemini-3.5-flash", "models/gemini-3.1-flash-lite"]

    last_exc: Exception | None = None
    for candidate_model in _FALLBACK_MODELS:
        for retry in range(2):  # 2 retries per model
            try:
                # Use the Chat API (recommended by google.genai SDK to avoid AFC warning)
                chat = client.chats.create(
                    model=candidate_model,
                    config=genai_types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.4,
                        max_output_tokens=2048,
                        top_p=0.9,
                    ),
                    history=[
                        genai_types.Content(
                            role="user" if msg.role == "user" else "model",
                            parts=[genai_types.Part(text=msg.content)],
                        )
                        for msg in conversation_history
                    ],
                )
                response = chat.send_message(user_message)

                # Extract text — response.text is None on thinking models;
                # fall back to iterating candidates[].content.parts[]
                text: str | None = response.text
                if not text:
                    for cand in (response.candidates or []):
                        for part in (cand.content.parts if cand.content else []):
                            if hasattr(part, "text") and part.text:
                                text = part.text
                                break
                        if text:
                            break

                if not text or not text.strip():
                    raise ValueError("Empty response received from AI provider.")
                return text.strip()

            except Exception as exc:
                last_exc = exc
                exc_str = str(exc)

                # If Groq is available, immediately fallback to Groq to avoid slow client timeouts
                if settings.GROQ_API_KEY:
                    logger.warning(
                        "Gemini encounter error (%s); immediately trying Groq fallback...",
                        exc_str[:120],
                    )
                    try:
                        return _call_groq(system_prompt, conversation_history, user_message)
                    except Exception as groq_exc:
                        logger.error("Groq fallback failed: %s; continuing Gemini retries", groq_exc)

                is_overload = "503" in exc_str or "UNAVAILABLE" in exc_str or "high demand" in exc_str.lower()
                is_not_found = "404" in exc_str or "NOT_FOUND" in exc_str
                is_empty = isinstance(exc, ValueError)

                if is_overload:
                    logger.warning(
                        "Gemini 503 overload — model=%s attempt=%d/2: %s",
                        candidate_model, retry + 1, exc_str[:100],
                    )
                    if retry == 0:
                        _time.sleep(1)
                        continue
                    else:
                        break  # try next fallback model
                elif is_not_found or is_empty:
                    logger.warning("Gemini model error — model=%s: %s", candidate_model, exc_str[:100])
                    break  # try next fallback model
                else:
                    raise

    # 4. If all Gemini candidate models failed, try Groq fallback
    if settings.GROQ_API_KEY:
        logger.warning("All Gemini candidate models exhausted; falling back to Groq...")
        try:
            return _call_groq(system_prompt, conversation_history, user_message)
        except Exception as groq_exc:
            logger.error("Groq fallback failed: %s", groq_exc)

    raise last_exc  # type: ignore[misc]  # all fallbacks exhausted





# ---------------------------------------------------------------------------#
# Context builders                                                            #
# ---------------------------------------------------------------------------#

async def _build_issue_context(db: AsyncSession, issue_id: int) -> str | None:
    """Retrieve issue + comments from DB and format as a context string."""
    result = await db.execute(
        select(Issue)
        .options(
            selectinload(Issue.reporter),
            selectinload(Issue.assignee),
            selectinload(Issue.comments),
        )
        .where(Issue.id == issue_id)
    )
    issue: Issue | None = result.scalar_one_or_none()

    if issue is None:
        return None

    lines = [
        f"Issue ID: {issue.id}",
        f"Issue Key: {issue.issue_key}",
        f"Title: {issue.title}",
        f"Type: {issue.issue_type.value if issue.issue_type else 'N/A'}",
        f"Status: {issue.status.value if issue.status else 'N/A'}",
        f"Severity: {issue.severity.value if issue.severity else 'N/A'}",
        f"Priority: {issue.priority.value if issue.priority else 'N/A'}",
        f"Component: {issue.component or 'N/A'}",
        f"Category: {issue.category or 'N/A'}",
        f"Environment: {issue.environment or 'N/A'}",
        f"Description:\n{issue.description or 'N/A'}",
        f"Steps to Reproduce:\n{issue.steps_to_reproduce or 'N/A'}",
        f"Expected Result: {issue.expected_result or 'N/A'}",
        f"Actual Result: {issue.actual_result or 'N/A'}",
        f"Resolution Summary: {issue.resolution_summary or 'N/A'}",
        f"Reporter: {issue.reporter.full_name if issue.reporter else 'N/A'}",
        f"Assignee: {issue.assignee.full_name if issue.assignee else 'Unassigned'}",
    ]

    if issue.comments:
        lines.append("\nRecent Comments (latest first):")
        for comment in sorted(issue.comments, key=lambda c: c.created_at, reverse=True)[:5]:
            author = getattr(comment, "author", None)
            author_name = author.full_name if author else "Unknown"
            content = (comment.content or "")[:MAX_COMMENT_CHARS]
            lines.append(f"  - [{author_name}]: {content}")

    return "\n".join(lines)


async def _build_sprint_context(db: AsyncSession, sprint_id: int) -> str | None:
    """Retrieve sprint data from DB and format as a context string."""
    result = await db.execute(
        select(Sprint)
        .options(
            selectinload(Sprint.issues),
            selectinload(Sprint.assigned_tester),
            selectinload(Sprint.project),
        )
        .where(Sprint.id == sprint_id)
    )
    sprint: Sprint | None = result.scalar_one_or_none()

    if sprint is None:
        return None

    issues = sprint.issues or []
    total = len(issues)
    resolved = sum(1 for i in issues if i.status.value in ("RESOLVED", "CLOSED"))
    in_testing = sum(1 for i in issues if i.status.value == "IN_TESTING")
    in_review = sum(1 for i in issues if i.status.value == "IN_REVIEW")
    in_dev = sum(1 for i in issues if i.status.value == "IN_DEVELOPMENT")
    unresolved = total - resolved

    priority_dist: dict[str, int] = {}
    for iss in issues:
        p = iss.priority.value if iss.priority else "UNKNOWN"
        priority_dist[p] = priority_dist.get(p, 0) + 1

    completion_pct = round((resolved / total * 100), 1) if total > 0 else 0.0

    lines = [
        f"Sprint ID: {sprint.id}",
        f"Sprint Name: {sprint.name}",
        f"Project: {sprint.project.name if sprint.project else 'N/A'}",
        f"Status: {sprint.status.value if sprint.status else 'N/A'}",
        f"Goal: {sprint.goal or 'N/A'}",
        f"Goal Status: {sprint.goal_status or 'N/A'}",
        f"Start Date: {sprint.start_date.date() if sprint.start_date else 'N/A'}",
        f"End Date: {sprint.end_date.date() if sprint.end_date else 'N/A'}",
        f"Assigned Tester: {sprint.assigned_tester.full_name if sprint.assigned_tester else 'N/A'}",
        f"\nIssue Statistics:",
        f"  Total Issues: {total}",
        f"  Resolved/Closed: {resolved}",
        f"  Unresolved: {unresolved}",
        f"  In Testing: {in_testing}",
        f"  In Review: {in_review}",
        f"  In Development: {in_dev}",
        f"  Completion: {completion_pct}%",
        f"\nPriority Distribution: {priority_dist}",
    ]

    if sprint.review_comment:
        lines.append(f"\nAdmin Review Comment: {sprint.review_comment}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------#
# Prompt builders for specialized endpoints                                  #
# ---------------------------------------------------------------------------#

def _build_issue_analysis_prompt(issue_context: str) -> str:
    return f"""You are a software testing assistant. Analyze the following defect from the TracePilot system.

--- DEFECT DETAILS ---
{issue_context}
--- END DEFECT DETAILS ---

Please provide a structured analysis covering:

## 1. Understanding the Defect
Summarize what this defect is about in plain language.

## 2. Possible Root Causes
List 3-5 possible causes. Use "Possible cause:" prefix and avoid claiming certainty.

## 3. Reproduction Approach
Step-by-step guidance to reproduce this defect.

## 4. Test Scenarios
Specific test cases to validate the defect and its fix.

## 5. Edge Cases
Boundary conditions and edge cases to consider.

## 6. Suggested Verification Steps
How to verify this defect is resolved after a fix is applied.

## 7. Additional Information Needed
What additional details (logs, screenshots, environment info) would help investigation.

Note: This analysis is advisory. All actions must be taken through the TracePilot UI by the appropriate team member."""


def _build_test_cases_prompt(issue_context: str | None, description: str) -> str:
    context_section = f"\n--- ISSUE CONTEXT ---\n{issue_context}\n--- END CONTEXT ---\n" if issue_context else ""
    return f"""You are a software QA engineer. Generate comprehensive, structured test cases.

{context_section}
Additional Description: {description}

Generate a set of test cases in the following format for EACH test case:

### Test Case N: [Title]
**Type:** [Positive/Negative/Boundary/Regression/Validation]
**Priority:** [HIGH/MEDIUM/LOW]
**Precondition:** [What must be true before the test]
**Test Data:** [Specific data values to use]
**Steps:**
1. Step one
2. Step two
3. ...
**Expected Result:** [What should happen]
**Verification:** [How to confirm the result]

Include:
- At least 2 positive test cases (happy path)
- At least 2 negative test cases (invalid input, error conditions)
- At least 1 boundary/edge case test
- At least 1 regression test (to ensure existing functionality is not broken)
- Validation test cases where applicable

Do not generate duplicate or redundant test cases."""


def _build_reproduction_steps_prompt(issue_context: str | None, description: str) -> str:
    context_section = f"\n--- ISSUE CONTEXT ---\n{issue_context}\n--- END CONTEXT ---\n" if issue_context else ""
    return f"""You are a software testing specialist. Generate detailed reproduction steps for the following defect.

{context_section}
Additional Details: {description}

Provide a structured reproduction guide:

## Preconditions
- List all required system states, user roles, and configurations

## Environment Requirements
- OS, browser, device requirements
- Software versions if relevant

## Test Data Required
- Specific data values, user accounts, or records needed

## Step-by-Step Reproduction
1. Numbered, precise steps
2. Include exact UI elements to click, values to enter, etc.

## Expected Behavior
What should happen according to requirements/specs.

## Actual Behavior
What actually happens (the defect).

## Evidence to Collect
- Screenshots, logs, network requests to capture
- Specific log files or console output to check

## Additional Debugging
- Developer tools, API calls, DB queries that may help investigate

## Missing Information
Explicitly list any information that is missing and would help reproduce this defect.
Do NOT invent details — state what is unknown."""


def _build_root_cause_prompt(issue_context: str | None, description: str) -> str:
    context_section = f"\n--- ISSUE CONTEXT ---\n{issue_context}\n--- END CONTEXT ---\n" if issue_context else ""
    return f"""You are a senior software engineer performing root cause analysis.

{context_section}
Additional Details: {description}

Provide a structured root cause analysis:

## Observed Symptoms
Describe what is happening based on the available information.

## Possible Causes
List potential root causes, each labeled as "Possible cause:". Do NOT present speculation as confirmed facts.
- Consider frontend, backend, database, and infrastructure layers separately.

## Affected Layer
Which layer(s) are likely involved: Frontend / Backend API / Database / Infrastructure / Integration / Configuration?

## Investigation Steps
Step-by-step investigation approach a developer/tester should follow.

## Logs to Check
- Application logs, error logs, access logs to examine
- What patterns or error messages to search for

## Database/API/Frontend Checks
Specific queries, API calls, or UI checks that may reveal the cause.

## Recommended Next Debugging Step
The single most important action to take next to narrow down the cause.

Important: Use cautious language throughout. Distinguish between confirmed facts and hypotheses."""


def _build_sprint_summary_prompt(sprint_context: str, description: str) -> str:
    return f"""You are a QA lead analyzing sprint data in TracePilot.

--- SPRINT DATA ---
{sprint_context}
--- END SPRINT DATA ---

Additional Context: {description}

Provide a comprehensive sprint analysis:

## Sprint Status Overview
Summarize the current state of this sprint.

## Completion Analysis
Interpret the completion percentage and what it means for the sprint timeline.

## Issue Breakdown
Analyze the distribution of issues by status, priority, and type.

## Testing Observations
Key observations from a testing perspective.

## Risks and Concerns
Identify risks: blocked issues, approaching deadline, high-severity unresolved defects.

## Recommended Testing Focus
What should the tester prioritize right now?

## Sprint Health Assessment
Overall health: On Track / At Risk / Critical

Important: This is an analysis only. Do not suggest changing sprint status or modifying issues."""


def _build_metrics_prompt(metrics_context: str, question: str) -> str:
    return f"""You are a QA analytics expert interpreting defect tracking metrics from TracePilot.

--- METRICS CONTEXT ---
{metrics_context}
--- END METRICS CONTEXT ---

Question: {question}

Please provide a clear explanation:

## Answer
Direct answer to the question.

## Interpretation
What these metrics mean in practice for the QA team.

## Trend Analysis
What the data suggests about the project's quality trend.

## Distinguishing Facts from Interpretation
- **Confirmed metrics:** [actual numbers from the data]
- **Interpretations:** [what these numbers suggest]

## Recommended Actions
Based on these metrics, what should the team consider?

Be precise about what is measured data vs. inference."""


# ---------------------------------------------------------------------------#
# Core AI chat function                                                       #
# ---------------------------------------------------------------------------#

async def chat(request: AIRequest, db: AsyncSession) -> AIResponse:
    """
    Core AI chat handler.

    Retrieves context if issue_id or sprint_id are provided,
    builds the appropriate prompt, calls the AI provider, and returns the response.
    """
    import uuid

    if not settings.AI_ENABLED:
        return AIResponse(
            success=False,
            message="AI service is currently disabled. Please enable AI in the backend configuration.",
            conversation_id=request.conversation_id or str(uuid.uuid4()),
            model=settings.AI_MODEL,
            error="AI_DISABLED",
        )

    if not (settings.GEMINI_API_KEY or settings.GROQ_API_KEY):
        return AIResponse(
            success=False,
            message="AI service is not configured. Please set GEMINI_API_KEY or GROQ_API_KEY in the backend environment.",
            conversation_id=request.conversation_id or str(uuid.uuid4()),
            model=_get_active_model(),
            error="AI_NOT_CONFIGURED",
        )

    conversation_id = request.conversation_id or str(uuid.uuid4())

    # Validate message length
    if len(request.message) > MAX_MESSAGE_LENGTH:
        return AIResponse(
            success=False,
            message=f"Message is too long. Please limit your message to {MAX_MESSAGE_LENGTH} characters.",
            conversation_id=conversation_id,
            model=_get_active_model(),
            error="MESSAGE_TOO_LONG",
        )

    # Limit conversation history
    history = request.conversation_history[-MAX_CONVERSATION_TURNS * 2:]

    issue_context: str | None = None
    sprint_context: str | None = None
    issue_context_used = False
    sprint_context_used = False

    # Retrieve issue context if requested
    if request.issue_id:
        try:
            issue_context = await _build_issue_context(db, request.issue_id)
            if issue_context:
                issue_context_used = True
        except Exception as exc:
            logger.warning("Failed to retrieve issue context for id=%s: %s", request.issue_id, exc)

    # Retrieve sprint context if requested
    if request.sprint_id:
        try:
            sprint_context = await _build_sprint_context(db, request.sprint_id)
            if sprint_context:
                sprint_context_used = True
        except Exception as exc:
            logger.warning("Failed to retrieve sprint context for id=%s: %s", request.sprint_id, exc)

    # Build the user-facing message (enriched with context if available)
    full_user_message = request.message

    if issue_context:
        full_user_message = (
            f"Context — Issue from TracePilot:\n{issue_context}\n\n"
            f"User Question: {request.message}"
        )
    elif sprint_context:
        full_user_message = (
            f"Context — Sprint from TracePilot:\n{sprint_context}\n\n"
            f"User Question: {request.message}"
        )

    try:
        ai_message = await asyncio.to_thread(
            _call_gemini,
            TRACEPILOT_SYSTEM_PROMPT,
            history,
            full_user_message,
        )
        return AIResponse(
            success=True,
            message=ai_message,
            conversation_id=conversation_id,
            model=_get_active_model(),
            issue_context_used=issue_context_used,
            sprint_context_used=sprint_context_used,
        )
    except Exception as exc:
        logger.error("AI provider error: %s", _sanitize_error(str(exc)), exc_info=True)
        return AIResponse(
            success=False,
            message="AI service is temporarily unavailable. Please try again in a moment.",
            conversation_id=conversation_id,
            model=_get_active_model(),
            error=str(type(exc).__name__),
        )


# ---------------------------------------------------------------------------#
# Specialized endpoint handlers                                               #
# ---------------------------------------------------------------------------#

async def analyze_issue(issue_id: int, db: AsyncSession) -> AIResponse:
    """Perform structured defect analysis for a specific issue."""
    import uuid

    if not _is_ai_available():
        return AIResponse(
            success=False,
            message="AI service is not available or not configured.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error="AI_DISABLED",
        )

    issue_context = await _build_issue_context(db, issue_id)
    if not issue_context:
        return AIResponse(
            success=False,
            message=f"Issue with ID {issue_id} was not found.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error="ISSUE_NOT_FOUND",
        )

    prompt = _build_issue_analysis_prompt(issue_context)
    try:
        response_text = await asyncio.to_thread(_call_gemini, TRACEPILOT_SYSTEM_PROMPT, [], prompt)
        return AIResponse(
            success=True,
            message=response_text,
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            issue_context_used=True,
        )
    except Exception as exc:
        logger.error("AI analyze_issue error: %s", _sanitize_error(str(exc)), exc_info=True)
        return AIResponse(
            success=False,
            message="AI service is temporarily unavailable. Please try again.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error=str(type(exc).__name__),
        )


async def generate_test_cases(
    description: str, issue_id: int | None, db: AsyncSession
) -> AIResponse:
    """Generate structured test cases for an issue or description."""
    import uuid

    if not _is_ai_available():
        return AIResponse(
            success=False,
            message="AI service is not available or not configured.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error="AI_DISABLED",
        )

    issue_context: str | None = None
    if issue_id:
        issue_context = await _build_issue_context(db, issue_id)

    prompt = _build_test_cases_prompt(issue_context, description)
    try:
        response_text = await asyncio.to_thread(_call_gemini, TRACEPILOT_SYSTEM_PROMPT, [], prompt)
        return AIResponse(
            success=True,
            message=response_text,
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            issue_context_used=bool(issue_context),
        )
    except Exception as exc:
        logger.error("AI generate_test_cases error: %s", exc, exc_info=True)
        return AIResponse(
            success=False,
            message="AI service is temporarily unavailable. Please try again.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error=str(type(exc).__name__),
        )


async def reproduction_steps(
    description: str, issue_id: int | None, db: AsyncSession
) -> AIResponse:
    """Generate detailed reproduction steps for a defect."""
    import uuid

    if not _is_ai_available():
        return AIResponse(
            success=False,
            message="AI service is not available or not configured.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error="AI_DISABLED",
        )

    issue_context: str | None = None
    if issue_id:
        issue_context = await _build_issue_context(db, issue_id)

    prompt = _build_reproduction_steps_prompt(issue_context, description)
    try:
        response_text = await asyncio.to_thread(_call_gemini, TRACEPILOT_SYSTEM_PROMPT, [], prompt)
        return AIResponse(
            success=True,
            message=response_text,
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            issue_context_used=bool(issue_context),
        )
    except Exception as exc:
        logger.error("AI reproduction_steps error: %s", exc, exc_info=True)
        return AIResponse(
            success=False,
            message="AI service is temporarily unavailable. Please try again.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error=str(type(exc).__name__),
        )


async def root_cause_analysis(
    description: str, issue_id: int | None, db: AsyncSession
) -> AIResponse:
    """Perform root cause analysis for a defect."""
    import uuid

    if not _is_ai_available():
        return AIResponse(
            success=False,
            message="AI service is not available or not configured.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error="AI_DISABLED",
        )

    issue_context: str | None = None
    if issue_id:
        issue_context = await _build_issue_context(db, issue_id)

    prompt = _build_root_cause_prompt(issue_context, description)
    try:
        response_text = await asyncio.to_thread(_call_gemini, TRACEPILOT_SYSTEM_PROMPT, [], prompt)
        return AIResponse(
            success=True,
            message=response_text,
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            issue_context_used=bool(issue_context),
        )
    except Exception as exc:
        logger.error("AI root_cause_analysis error: %s", _sanitize_error(str(exc)), exc_info=True)
        return AIResponse(
            success=False,
            message="AI service is temporarily unavailable. Please try again.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error=str(type(exc).__name__),
        )


async def sprint_summary(
    sprint_id: int, description: str, db: AsyncSession
) -> AIResponse:
    """Generate an AI-powered sprint summary and analysis."""
    import uuid

    if not _is_ai_available():
        return AIResponse(
            success=False,
            message="AI service is not available or not configured.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error="AI_DISABLED",
        )

    sprint_context = await _build_sprint_context(db, sprint_id)
    if not sprint_context:
        return AIResponse(
            success=False,
            message=f"Sprint with ID {sprint_id} was not found.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error="SPRINT_NOT_FOUND",
        )

    prompt = _build_sprint_summary_prompt(sprint_context, description)
    try:
        response_text = await asyncio.to_thread(_call_gemini, TRACEPILOT_SYSTEM_PROMPT, [], prompt)
        return AIResponse(
            success=True,
            message=response_text,
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            sprint_context_used=True,
        )
    except Exception as exc:
        logger.error("AI sprint_summary error: %s", _sanitize_error(str(exc)), exc_info=True)
        return AIResponse(
            success=False,
            message="AI service is temporarily unavailable. Please try again.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error=str(type(exc).__name__),
        )


async def explain_metrics(metrics_context: str, question: str) -> AIResponse:
    """Explain TracePilot analytics metrics in plain language."""
    import uuid

    if not _is_ai_available():
        return AIResponse(
            success=False,
            message="AI service is not available or not configured.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error="AI_DISABLED",
        )

    prompt = _build_metrics_prompt(metrics_context, question)
    try:
        response_text = await asyncio.to_thread(_call_gemini, TRACEPILOT_SYSTEM_PROMPT, [], prompt)
        return AIResponse(
            success=True,
            message=response_text,
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
        )
    except Exception as exc:
        logger.error("AI explain_metrics error: %s", _sanitize_error(str(exc)), exc_info=True)
        return AIResponse(
            success=False,
            message="AI service is temporarily unavailable. Please try again.",
            conversation_id=str(uuid.uuid4()),
            model=_get_active_model(),
            error=str(type(exc).__name__),
        )
