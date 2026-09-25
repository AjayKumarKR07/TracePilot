"""
AI / Chatbot API routes for TracePilot.

RBAC:
  All endpoints require authentication (JWT Bearer).
  TESTER and ADMIN roles can access the AI endpoints.
  USER role is not granted access to the AI testing assistant.

Endpoints:
  POST /ai/chat                - General AI chat with optional issue/sprint context
  POST /ai/analyze-issue       - Structured defect analysis for a specific issue
  POST /ai/generate-test-cases - Generate structured test cases
  POST /ai/reproduction-steps  - Generate detailed reproduction steps
  POST /ai/root-cause          - Root cause analysis
  POST /ai/sprint-summary      - AI sprint summary and analysis
  POST /ai/explain-metrics     - Explain TracePilot analytics metrics
  GET  /ai/health              - AI service health check

The AI is ADVISORY ONLY. These endpoints never modify any database records.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database.session import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.services import ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

# Roles that can use the AI assistant
_AI_ALLOWED_ROLES = [UserRole.TESTER, UserRole.ADMIN]


# --------------------------------------------------------------------------- #
# Request / Response Schemas                                                  #
# --------------------------------------------------------------------------- #

class ConversationMessageSchema(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000, description="User message")
    conversation_id: str | None = Field(None, description="Existing conversation ID")
    issue_id: int | None = Field(None, description="Optional issue ID for context")
    sprint_id: int | None = Field(None, description="Optional sprint ID for context")
    conversation: list[ConversationMessageSchema] = Field(
        default_factory=list,
        max_length=20,
        description="Recent conversation history (max 20 messages)",
    )


class ChatResponse(BaseModel):
    success: bool
    message: str
    conversation_id: str
    metadata: dict


class AnalyzeIssueRequest(BaseModel):
    issue_id: int = Field(..., description="Issue ID to analyze")


class GenerateTestCasesRequest(BaseModel):
    description: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="Description of the feature/defect to generate test cases for",
    )
    issue_id: int | None = Field(None, description="Optional issue ID for context")


class ReproductionStepsRequest(BaseModel):
    description: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="Description of the defect",
    )
    issue_id: int | None = Field(None, description="Optional issue ID for context")


class RootCauseRequest(BaseModel):
    description: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="Description of the problem",
    )
    issue_id: int | None = Field(None, description="Optional issue ID for context")


class SprintSummaryRequest(BaseModel):
    sprint_id: int = Field(..., description="Sprint ID to summarize")
    additional_context: str = Field(
        default="",
        max_length=1000,
        description="Optional additional context or questions",
    )


class ExplainMetricsRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Question about the metrics",
    )
    metrics_context: str = Field(
        default="",
        max_length=4000,
        description="Raw metrics data or context to explain",
    )


class AIHealthResponse(BaseModel):
    ai_enabled: bool
    ai_provider: str
    ai_model: str
    api_key_configured: bool
    status: str


# --------------------------------------------------------------------------- #
# Helper                                                                      #
# --------------------------------------------------------------------------- #

def _ai_response_to_dict(resp: ai_service.AIResponse) -> ChatResponse:
    return ChatResponse(
        success=resp.success,
        message=resp.message,
        conversation_id=resp.conversation_id,
        metadata={
            "model": resp.model,
            "issue_context_used": resp.issue_context_used,
            "sprint_context_used": resp.sprint_context_used,
            "provider": settings.AI_PROVIDER,
        },
    )


def _build_conversation_history(
    conversation: list[ConversationMessageSchema],
) -> list[ai_service.ConversationMessage]:
    return [
        ai_service.ConversationMessage(role=m.role, content=m.content)
        for m in conversation
    ]


# --------------------------------------------------------------------------- #
# Health Check                                                                #
# --------------------------------------------------------------------------- #

@router.get(
    "/health",
    response_model=AIHealthResponse,
    summary="AI Service Health Check",
)
async def ai_health(
    current_user: User = Depends(get_current_user),
) -> AIHealthResponse:
    """Check if the AI service is configured and available."""
    key_configured = bool(settings.GEMINI_API_KEY)
    if settings.AI_ENABLED and key_configured:
        status = "available"
    elif settings.AI_ENABLED and not key_configured:
        status = "misconfigured"
    else:
        status = "disabled"

    return AIHealthResponse(
        ai_enabled=settings.AI_ENABLED,
        ai_provider=settings.AI_PROVIDER,
        ai_model=settings.AI_MODEL,
        api_key_configured=key_configured,
        status=status,
    )


# --------------------------------------------------------------------------- #
# Core Chat Endpoint                                                          #
# --------------------------------------------------------------------------- #

@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="AI Testing Assistant Chat",
)
async def ai_chat(
    body: ChatRequest,
    current_user: User = Depends(require_role(*_AI_ALLOWED_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    General AI chat endpoint with optional TracePilot context.

    Supports:
    - General testing and QA questions
    - Issue context (when issue_id is provided)
    - Sprint context (when sprint_id is provided)
    - Conversation history (frontend-managed, sent with each request)

    The AI is advisory only and will not modify any data.
    """
    request = ai_service.AIRequest(
        message=body.message,
        conversation_history=_build_conversation_history(body.conversation),
        issue_id=body.issue_id,
        sprint_id=body.sprint_id,
        conversation_id=body.conversation_id,
    )

    result = await ai_service.chat(request, db)
    logger.info(
        "AI chat: user=%s success=%s issue_id=%s sprint_id=%s",
        current_user.id,
        result.success,
        body.issue_id,
        body.sprint_id,
    )
    return _ai_response_to_dict(result)


# --------------------------------------------------------------------------- #
# Specialized Endpoints                                                       #
# --------------------------------------------------------------------------- #

@router.post(
    "/analyze-issue",
    response_model=ChatResponse,
    summary="Analyze a specific defect",
)
async def analyze_issue(
    body: AnalyzeIssueRequest,
    current_user: User = Depends(require_role(*_AI_ALLOWED_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Perform structured AI analysis of a specific issue.
    Returns: understanding, root causes, reproduction approach, test scenarios, edge cases.
    """
    result = await ai_service.analyze_issue(body.issue_id, db)
    logger.info("AI analyze_issue: user=%s issue_id=%s success=%s", current_user.id, body.issue_id, result.success)
    return _ai_response_to_dict(result)


@router.post(
    "/generate-test-cases",
    response_model=ChatResponse,
    summary="Generate structured test cases",
)
async def generate_test_cases(
    body: GenerateTestCasesRequest,
    current_user: User = Depends(require_role(*_AI_ALLOWED_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Generate comprehensive structured test cases.
    Includes positive, negative, boundary, validation, and regression cases.
    """
    result = await ai_service.generate_test_cases(body.description, body.issue_id, db)
    logger.info("AI generate_test_cases: user=%s issue_id=%s success=%s", current_user.id, body.issue_id, result.success)
    return _ai_response_to_dict(result)


@router.post(
    "/reproduction-steps",
    response_model=ChatResponse,
    summary="Generate reproduction steps for a defect",
)
async def reproduction_steps(
    body: ReproductionStepsRequest,
    current_user: User = Depends(require_role(*_AI_ALLOWED_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Generate detailed step-by-step reproduction guide for a defect.
    Includes preconditions, test data, steps, evidence collection.
    """
    result = await ai_service.reproduction_steps(body.description, body.issue_id, db)
    logger.info("AI reproduction_steps: user=%s issue_id=%s success=%s", current_user.id, body.issue_id, result.success)
    return _ai_response_to_dict(result)


@router.post(
    "/root-cause",
    response_model=ChatResponse,
    summary="Root cause analysis for a defect",
)
async def root_cause_analysis(
    body: RootCauseRequest,
    current_user: User = Depends(require_role(*_AI_ALLOWED_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Perform advisory root cause analysis.
    Returns possible causes (with appropriate uncertainty), investigation steps, logs to check.
    Does NOT claim certainty — uses cautious, investigative language.
    """
    result = await ai_service.root_cause_analysis(body.description, body.issue_id, db)
    logger.info("AI root_cause: user=%s issue_id=%s success=%s", current_user.id, body.issue_id, result.success)
    return _ai_response_to_dict(result)


@router.post(
    "/sprint-summary",
    response_model=ChatResponse,
    summary="AI-powered sprint analysis and summary",
)
async def sprint_summary(
    body: SprintSummaryRequest,
    current_user: User = Depends(require_role(*_AI_ALLOWED_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Generate an AI sprint analysis using live sprint data.
    Returns: status overview, completion analysis, risks, testing focus recommendations.
    Does NOT modify the sprint.
    """
    result = await ai_service.sprint_summary(body.sprint_id, body.additional_context, db)
    logger.info("AI sprint_summary: user=%s sprint_id=%s success=%s", current_user.id, body.sprint_id, result.success)
    return _ai_response_to_dict(result)


@router.post(
    "/explain-metrics",
    response_model=ChatResponse,
    summary="Explain TracePilot analytics metrics",
)
async def explain_metrics(
    body: ExplainMetricsRequest,
    current_user: User = Depends(require_role(*_AI_ALLOWED_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Explain analytics metrics in plain language.
    Distinguishes actual data from interpretation.
    """
    result = await ai_service.explain_metrics(body.metrics_context, body.question)
    logger.info("AI explain_metrics: user=%s success=%s", current_user.id, result.success)
    return _ai_response_to_dict(result)
