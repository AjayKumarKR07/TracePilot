"""
Admin dashboard service â€” Phase 6.

Computes system-wide statistics using efficient SQL aggregation queries.

Design principles:
  - All counts use SQL func.count() + case() â€” zero Python-level iteration.
  - Single query per entity type (user/project/issue) to minimise round-trips.
  - No sensitive data (password_hash, tokens, OTPs) is ever read or returned.
"""

from datetime import UTC, datetime, timedelta
import time

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database.connection import engine
from app.models.issue import Issue, IssueStatus, Priority, Severity
from app.models.issue_attachment import IssueAttachment
from app.models.issue_comment import IssueComment
from app.models.notification import Notification
from app.models.project import Project, ProjectStatus
from app.models.sprint import Sprint, SprintStatus
from app.models.user import User, UserRole
from app.schemas.admin import (
    AppHealthInfo,
    BacklogStats,
    BackgroundServiceItem,
    ContentStats,
    DashboardResponse,
    DatabaseHealthInfo,
    AIHealthInfo,
    AuthHealthInfo,
    IssuePriorityStats,
    IssueSeverityStats,
    IssueStatusStats,
    NotificationStats,
    ProjectStats,
    RecentActivity,
    SprintStats,
    SystemHealthResponse,
    UserStats,
    WebSocketHealthInfo,
    InactiveAssigneeItem,
    InactiveAssigneeList,
    IssueAgingResponse,
    OldestUnresolvedIssue,
)
from app.services import ai_service
from app.services.websocket_manager import ws_manager


async def get_dashboard_stats(db: AsyncSession) -> DashboardResponse:
    """Return a complete statistics snapshot for the Admin dashboard.

    Uses efficient aggregation queries across users, projects, issues,
    notifications, comments, attachments, sprints, and backlog. No ORM objects are instantiated.
    """
    users = await _user_stats(db)
    projects = await _project_stats(db)
    issue_status = await _issue_status_stats(db)
    issue_severity = await _issue_severity_stats(db)
    issue_priority = await _issue_priority_stats(db)
    recent = await _recent_activity(db)
    notifications = await _notification_stats(db)
    content = await _content_stats(db)
    sprints = await _sprint_stats(db)
    backlog = await _backlog_stats(db)

    return DashboardResponse(
        users=users,
        projects=projects,
        issues=issue_status,
        severity=issue_severity,
        priority=issue_priority,
        recent=recent,
        notifications=notifications,
        content=content,
        sprints=sprints,
        backlog=backlog,
    )



async def get_inactive_assignees(db: AsyncSession) -> InactiveAssigneeList:
    """Return all inactive users who currently have open issues assigned to them."""
    result = await db.execute(
        select(
            User.id.label("user_id"),
            User.full_name,
            User.email,
            User.role,
            func.count(Issue.id).label("assigned_issues_count"),
        )
        .join(Issue, Issue.assignee_id == User.id)
        .where(
            User.is_active == False,
            Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.CLOSED])
        )
        .group_by(User.id)
        .order_by(func.count(Issue.id).desc())
    )
    
    items = []
    for row in result.all():
        items.append(
            InactiveAssigneeItem(
                user_id=row.user_id,
                full_name=row.full_name,
                email=row.email,
                role=row.role.value,
                assigned_issues_count=row.assigned_issues_count,
            )
        )
        
    return InactiveAssigneeList(items=items)


# --------------------------------------------------------------------------- #
# Private aggregation queries                                                  #
# --------------------------------------------------------------------------- #

async def _user_stats(db: AsyncSession) -> UserStats:
    """Compute all user counts in a single SQL query."""
    result = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((User.is_active == True, 1))).label("active"),        # noqa: E712
            func.count(case((User.is_active == False, 1))).label("inactive"),     # noqa: E712
            func.count(case((User.role == UserRole.ADMIN, 1))).label("admins"),
            func.count(case((User.role.in_([UserRole.DEVELOPER, "DEVELOPER"]), 1))).label("testers"),
            func.count(case((User.role == UserRole.USER, 1))).label("users"),
            func.count(case((User.is_email_verified == True, 1))).label("verified"),   # noqa: E712
            func.count(case((User.is_email_verified == False, 1))).label("unverified"),  # noqa: E712
        ).select_from(User)
    )
    row = result.one()
    return UserStats(
        total=row.total,
        active=row.active,
        inactive=row.inactive,
        admins=row.admins,
        developers=0,
        testers=row.testers,
        users=row.users,
        verified=row.verified,
        unverified=row.unverified,
    )


async def _project_stats(db: AsyncSession) -> ProjectStats:
    """Compute project counts in a single SQL query."""
    result = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((Project.status == ProjectStatus.ACTIVE, 1))).label("active"),
            func.count(case((Project.status == ProjectStatus.INACTIVE, 1))).label("inactive"),
        ).select_from(Project)
    )
    row = result.one()
    return ProjectStats(
        total=row.total,
        active=row.active,
        inactive=row.inactive,
    )


async def _issue_status_stats(db: AsyncSession) -> IssueStatusStats:
    """Compute issue counts by status in a single SQL query."""
    result = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((Issue.status == IssueStatus.REPORTED, 1))).label("reported"),
            func.count(case((Issue.status == IssueStatus.TRIAGED, 1))).label("triaged"),
            func.count(case((Issue.status == IssueStatus.ASSIGNED, 1))).label("assigned"),
            func.count(case((Issue.status == IssueStatus.IN_DEVELOPMENT, 1))).label("in_development"),
            func.count(case((Issue.status == IssueStatus.IN_REVIEW, 1))).label("in_review"),
            func.count(case((Issue.status == IssueStatus.IN_TESTING, 1))).label("in_testing"),
            func.count(case((Issue.status == IssueStatus.RESOLVED, 1))).label("resolved"),
            func.count(case((Issue.status == IssueStatus.CLOSED, 1))).label("closed"),
            func.count(case((Issue.status == IssueStatus.REOPENED, 1))).label("reopened"),
        ).select_from(Issue)
    )
    row = result.one()
    resolved_and_closed = row.resolved + row.closed
    return IssueStatusStats(
        total=row.total,
        reported=row.reported,
        triaged=row.triaged,
        assigned=row.assigned,
        in_development=row.in_development,
        in_review=row.in_review,
        in_testing=row.in_testing,
        resolved=row.resolved,
        closed=row.closed,
        reopened=row.reopened,
        unresolved=max(0, row.total - resolved_and_closed),
    )


async def _issue_severity_stats(db: AsyncSession) -> IssueSeverityStats:
    """Compute issue counts by severity in a single SQL query."""
    result = await db.execute(
        select(
            func.count(case((Issue.severity == Severity.MINOR, 1))).label("minor"),
            func.count(case((Issue.severity == Severity.MAJOR, 1))).label("major"),
            func.count(case((Issue.severity == Severity.CRITICAL, 1))).label("critical"),
            func.count(case((Issue.severity == Severity.BLOCKER, 1))).label("blocker"),
        ).select_from(Issue)
    )
    row = result.one()
    return IssueSeverityStats(
        minor=row.minor,
        major=row.major,
        critical=row.critical,
        blocker=row.blocker,
    )


async def _issue_priority_stats(db: AsyncSession) -> IssuePriorityStats:
    """Compute issue counts by priority in a single SQL query."""
    result = await db.execute(
        select(
            func.count(case((Issue.priority == Priority.LOW, 1))).label("low"),
            func.count(case((Issue.priority == Priority.MEDIUM, 1))).label("medium"),
            func.count(case((Issue.priority == Priority.HIGH, 1))).label("high"),
            func.count(case((Issue.priority == Priority.URGENT, 1))).label("urgent"),
        ).select_from(Issue)
    )
    row = result.one()
    return IssuePriorityStats(
        low=row.low,
        medium=row.medium,
        high=row.high,
        urgent=row.urgent,
    )


async def _recent_activity(db: AsyncSession) -> RecentActivity:
    """Count issues created and resolved in the last 7 days."""
    cutoff = datetime.now(UTC) - timedelta(days=7)

    created_result = await db.execute(
        select(func.count())
        .select_from(Issue)
        .where(Issue.created_at >= cutoff)
    )
    resolved_result = await db.execute(
        select(func.count())
        .select_from(Issue)
        .where(
            Issue.status == IssueStatus.RESOLVED,
            Issue.resolved_at >= cutoff,
        )
    )
    return RecentActivity(
        recently_created=created_result.scalar_one(),
        recently_resolved=resolved_result.scalar_one(),
    )


async def _notification_stats(db: AsyncSession) -> NotificationStats:
    """Compute live notification counts."""
    result = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((Notification.is_read == False, 1))).label("unread"),  # noqa: E712
        ).select_from(Notification)
    )
    row = result.one()
    return NotificationStats(
        total=row.total,
        unread=row.unread,
    )


async def _content_stats(db: AsyncSession) -> ContentStats:
    """Compute live counts for comments, attachments, and notifications."""
    comments_result = await db.execute(
        select(func.count()).select_from(IssueComment)
    )
    attachments_result = await db.execute(
        select(func.count()).select_from(IssueAttachment)
    )
    notif_result = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((Notification.is_read == False, 1))).label("unread"),  # noqa: E712
        ).select_from(Notification)
    )
    notif_row = notif_result.one()
    return ContentStats(
        total_comments=comments_result.scalar_one(),
        total_attachments=attachments_result.scalar_one(),
        total_notifications=notif_row.total,
        unread_notifications=notif_row.unread,
    )


async def _sprint_stats(db: AsyncSession) -> SprintStats:
    """Compute sprint metrics in a single SQL query."""
    result = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((Sprint.status == SprintStatus.PLANNED, 1))).label("planned"),
            func.count(case((Sprint.status == SprintStatus.ACTIVE, 1))).label("active"),
            func.count(case((Sprint.status == SprintStatus.IN_PROGRESS, 1))).label("in_progress"),
            func.count(case((Sprint.status == SprintStatus.READY_FOR_APPROVAL, 1))).label("ready_for_approval"),
            func.count(case((Sprint.status == SprintStatus.COMPLETED, 1))).label("completed"),
            func.count(case((Sprint.status == SprintStatus.ARCHIVED, 1))).label("archived"),
        ).select_from(Sprint)
    )
    row = result.one()
    return SprintStats(
        total=row.total,
        planned=row.planned,
        active=row.active,
        in_progress=row.in_progress,
        ready_for_approval=row.ready_for_approval,
        completed=row.completed,
        archived=row.archived,
    )


async def _backlog_stats(db: AsyncSession) -> BacklogStats:
    """Compute defect backlog metrics in a single SQL query."""
    result = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((Issue.assignee_id.is_(None), 1))).label("unassigned"),
            func.count(case((Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]), 1))).label("critical"),
            func.count(case((Issue.priority.in_([Priority.HIGH, Priority.URGENT]), 1))).label("high_priority"),
            func.count(case((Issue.status == IssueStatus.RESOLVED, 1))).label("resolved"),
            func.count(case((Issue.status == IssueStatus.CLOSED, 1))).label("closed"),
            func.count(case((Issue.source == "KAGGLE_ISEC", 1))).label("kaggle_count"),
        ).select_from(Issue).where(Issue.sprint_id.is_(None))
    )
    row = result.one()
    return BacklogStats(
        total=row.total,
        unassigned=row.unassigned,
        critical=row.critical,
        high_priority=row.high_priority,
        resolved=row.resolved,
        closed=row.closed,
        kaggle_count=row.kaggle_count,
    )


async def get_issue_aging_stats(db: AsyncSession) -> IssueAgingResponse:
    """Compute real issue aging statistics across all unresolved defects.

    Only genuinely unresolved issues are included:
      status NOT IN (RESOLVED, CLOSED)
    Age buckets:
      - under_24h: created_at >= now - 24 hours
      - hours_24_to_72: now - 72 hours <= created_at < now - 24 hours
      - days_3_to_7: now - 7 days <= created_at < now - 72 hours
      - over_7d: created_at < now - 7 days
    Operational indicators:
      - critical_blocker_over_24h: severity in (CRITICAL, BLOCKER) and created_at < now - 24 hours
      - unassigned_over_7d: assignee_id is null and created_at < now - 7 days
      - reopened_over_24h: status == REOPENED and updated_at < now - 24 hours
    Oldest unresolved issue:
      - Single indexed lookup for 1 oldest unresolved issue by created_at asc.
    """
    now = datetime.now(UTC)
    cutoff_24h = now - timedelta(hours=24)
    cutoff_72h = now - timedelta(hours=72)
    cutoff_7d = now - timedelta(days=7)

    unresolved_cond = Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.CLOSED])

    stmt = (
        select(
            func.count().label("total_unresolved"),
            func.count(case((Issue.created_at >= cutoff_24h, 1))).label("under_24h"),
            func.count(
                case(((Issue.created_at < cutoff_24h) & (Issue.created_at >= cutoff_72h), 1))
            ).label("hours_24_to_72"),
            func.count(
                case(((Issue.created_at < cutoff_72h) & (Issue.created_at >= cutoff_7d), 1))
            ).label("days_3_to_7"),
            func.count(case((Issue.created_at < cutoff_7d, 1))).label("over_7d"),
            func.count(
                case(
                    (
                        Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER])
                        & (Issue.created_at < cutoff_24h),
                        1,
                    )
                )
            ).label("critical_blocker_over_24h"),
            func.count(
                case(
                    (
                        Issue.assignee_id.is_(None) & (Issue.created_at < cutoff_7d),
                        1,
                    )
                )
            ).label("unassigned_over_7d"),
            func.count(
                case(
                    (
                        (Issue.status == IssueStatus.REOPENED)
                        & (Issue.updated_at < cutoff_24h),
                        1,
                    )
                )
            ).label("reopened_over_24h"),
        )
        .select_from(Issue)
        .where(unresolved_cond)
    )

    agg_result = await db.execute(stmt)
    agg_row = agg_result.one()

    # Query oldest unresolved issue
    oldest_stmt = (
        select(
            Issue.id,
            Issue.issue_key,
            Issue.title,
            Issue.created_at,
            Issue.severity,
            Issue.priority,
            Issue.status,
        )
        .where(unresolved_cond)
        .order_by(Issue.created_at.asc())
        .limit(1)
    )
    oldest_result = await db.execute(oldest_stmt)
    oldest_row = oldest_result.first()

    oldest_item: OldestUnresolvedIssue | None = None
    if oldest_row:
        created_dt = oldest_row.created_at
        if created_dt.tzinfo is None:
            created_dt = created_dt.replace(tzinfo=UTC)
        age_seconds = (now - created_dt).total_seconds()
        age_days = round(max(0.0, age_seconds / 86400.0), 1)

        oldest_item = OldestUnresolvedIssue(
            id=oldest_row.id,
            issue_key=oldest_row.issue_key,
            title=oldest_row.title,
            created_at=oldest_row.created_at,
            age_days=age_days,
            severity=oldest_row.severity.value if hasattr(oldest_row.severity, "value") else str(oldest_row.severity),
            priority=oldest_row.priority.value if hasattr(oldest_row.priority, "value") else str(oldest_row.priority),
            status=oldest_row.status.value if hasattr(oldest_row.status, "value") else str(oldest_row.status),
        )

    return IssueAgingResponse(
        total_unresolved=agg_row.total_unresolved,
        under_24h=agg_row.under_24h,
        hours_24_to_72=agg_row.hours_24_to_72,
        days_3_to_7=agg_row.days_3_to_7,
        over_7d=agg_row.over_7d,
        oldest_unresolved=oldest_item,
        critical_blocker_over_24h=agg_row.critical_blocker_over_24h,
        unassigned_over_7d=agg_row.unassigned_over_7d,
        reopened_over_24h=agg_row.reopened_over_24h,
    )


async def get_system_health(db: AsyncSession) -> SystemHealthResponse:
    """Return aggregated live system health across app, database, websocket, AI, auth, and background services.

    Sanitized: Database credentials, API keys, and JWT secrets are never exposed.
    """
    now = datetime.now(UTC)

    # 1. Database live check
    db_status = "healthy"
    db_connected = False
    latency_ms: float | None = None
    try:
        t0 = time.perf_counter()
        await db.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        db_connected = True
        if latency_ms > 1000:
            db_status = "degraded"
        else:
            db_status = "healthy"
    except Exception:
        db_status = "down"
        db_connected = False
        latency_ms = None

    pool_size = None
    try:
        pool_size = engine.pool.size()
    except Exception:
        pool_size = None

    database_info = DatabaseHealthInfo(
        status=db_status,
        connected=db_connected,
        driver=settings.DB_DRIVER,
        database_name=settings.DB_NAME,
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        latency_ms=latency_ms,
        pool_size=pool_size,
        checked_at=now,
    )

    # 2. Application
    app_status = "healthy"
    app_info = AppHealthInfo(
        status=app_status,
        service="TracePilot API",
        version="0.9.0",
        environment=settings.APP_ENV,
        debug=settings.DEBUG,
        api_prefix=settings.API_V1_PREFIX,
    )

    # 3. WebSocket Manager
    ws_active_users = ws_manager.active_user_count()
    ws_total_conns = sum(len(conns) for conns in ws_manager._connections.values())
    ws_status = "healthy"
    websocket_info = WebSocketHealthInfo(
        status=ws_status,
        active_users=ws_active_users,
        total_connections=ws_total_conns,
        service="FastAPI WebSocket Manager",
    )

    # 4. AI Service
    key_configured = bool(settings.GEMINI_API_KEY or settings.GROQ_API_KEY)
    if settings.AI_ENABLED and key_configured:
        ai_status = "available"
    elif settings.AI_ENABLED and not key_configured:
        ai_status = "misconfigured"
    else:
        ai_status = "disabled"

    active_provider = (
        "groq"
        if (settings.AI_PROVIDER == "groq" or (not settings.GEMINI_API_KEY and settings.GROQ_API_KEY))
        else settings.AI_PROVIDER
    )
    active_model = (
        settings.GROQ_MODEL
        if active_provider == "groq"
        else settings.AI_MODEL
    )
    fallback_model = settings.GROQ_FALLBACK_MODEL if active_provider == "groq" else None

    model_verified: bool | None = None
    if active_provider == "groq" and settings.GROQ_API_KEY and settings.AI_ENABLED:
        try:
            disc = ai_service.verify_groq_models_available()
            model_verified = bool(disc.get("verified") and disc.get("primary_available"))
            if disc.get("error") == "Invalid API key":
                ai_status = "misconfigured"
        except Exception:
            model_verified = False

    ai_info = AIHealthInfo(
        status=ai_status,
        ai_enabled=settings.AI_ENABLED,
        provider=active_provider,
        primary_model=active_model,
        fallback_model=fallback_model,
        api_key_configured=key_configured,
        model_verified=model_verified,
    )

    # 5. Auth (JWT)
    jwt_configured = bool(settings.JWT_SECRET_KEY and settings.JWT_SECRET_KEY != "CHANGE_ME_TO_A_LONG_RANDOM_SECRET")
    auth_status = "healthy" if jwt_configured else "degraded"
    auth_info = AuthHealthInfo(
        status=auth_status,
        jwt_algorithm=settings.JWT_ALGORITHM,
        token_expire_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        secret_configured=jwt_configured,
    )

    # 6. Background Services (real TracePilot workers)
    smtp_configured = bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)
    bg_services = [
        BackgroundServiceItem(
            name="WebSocket Notification Dispatcher",
            status="healthy",
            description="Asynchronous push delivery of alerts to active browser sessions",
        ),
        BackgroundServiceItem(
            name="SMTP Email Delivery Worker",
            status="healthy" if smtp_configured else "degraded",
            description="Background email worker for OTP verification codes and notification emails",
        ),
    ]

    # Overall Status Calculation
    if db_status == "down" or app_status == "down":
        overall_status = "down"
    elif db_status == "degraded" or ai_status == "misconfigured" or auth_status == "degraded":
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return SystemHealthResponse(
        overall_status=overall_status,
        timestamp=now,
        application=app_info,
        database=database_info,
        websocket=websocket_info,
        ai=ai_info,
        auth=auth_info,
        background_services=bg_services,
    )



