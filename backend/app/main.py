"""
TracePilot FastAPI application entry point.

Phase 1: Structural foundation
Phase 2: PostgreSQL + SQLAlchemy
Phase 3: Authentication + OTP + JWT + RBAC
Phase 4: Defect Management APIs (Projects + Issues)
Phase 5: Audit Logs & Activity Tracking
Phase 6: Admin Management & Dashboard APIs
Phase 7: Issue Comments & File Attachments
Phase 8: Real-Time Notifications & WebSocket
Phase 9: Advanced Analytics, Reporting & Dashboard
"""

import sys
if sys.platform == "win32":
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from pydantic import BaseModel

from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes.admin import router as admin_router
from app.routes.analytics import router as analytics_router
from app.routes.attachments import router as attachments_router
from app.routes.audit import router as audit_router
from app.routes.auth import router as auth_router
from app.routes.collaboration import router as collaboration_router
from app.routes.comments import router as comments_router
from app.routes.export import router as export_router
from app.routes.health import router as health_router
from app.routes.issues import router as issues_router
from app.routes.notifications import router as notifications_router
from app.routes.projects import router as projects_router
from app.routes.users import router as users_router
from app.routes.websocket import router as ws_router
from app.routes.sprints import router as sprints_router
from app.routes.webhooks import router as webhooks_router
from app.routes.ai import router as ai_router


class RootResponse(BaseModel):
    message: str


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "TracePilot – Automated Defect Tracking and Resolution Assistance System. "
        "Built for the Infosys Batch 3 internship project."
    ),
    version="0.9.0",
    docs_url="/docs",
    redoc_url="/redoc",
    debug=settings.DEBUG,
)

# -----------------------------------------------------------------
# CORS Configuration (allows frontend development server)
# -----------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------
# Routers
# -----------------------------------------------------------------
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(issues_router)
app.include_router(audit_router)
app.include_router(users_router)
app.include_router(admin_router)
app.include_router(comments_router)
app.include_router(attachments_router)
app.include_router(notifications_router)
app.include_router(ws_router)
app.include_router(analytics_router)
app.include_router(sprints_router)
app.include_router(webhooks_router)
app.include_router(collaboration_router)
app.include_router(export_router)
app.include_router(ai_router)


# -----------------------------------------------------------------
# Root endpoint
# -----------------------------------------------------------------
@app.get("/", response_model=RootResponse, summary="Root", tags=["Root"])
async def root() -> RootResponse:
    """Confirm the API is reachable."""
    return RootResponse(message="TracePilot API is running")
