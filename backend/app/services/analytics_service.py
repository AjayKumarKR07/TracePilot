"""
Analytics and reporting service â€” Phase 9.

Computes system-wide, project-level, developer-performance, and time-series
metrics using efficient SQL aggregation queries. All endpoints query live
PostgreSQL tables directly without any mock or cached data.

RBAC:
  - ADMIN: Has full visibility across all users, projects, and issues.
  - TESTER: Scoped to issues they reported OR are assigned to.
  - USER: Scoped only to their own reported issues.
"""

import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Response, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_log import AuditAction, AuditLog
from app.models.issue import Issue, IssueStatus, Priority, Severity
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole
from app.schemas.analytics import (
    BacklogAgingBucketItem,
    BacklogAgingDistributionResponse,
    BacklogRiskIssueItem,
    BacklogRiskIssuesResponse,
    BacklogRiskSummary,
    DeveloperAnalyticsItem,
    DeveloperAnalyticsResponse,
    IssueStatusDistributionResponse,
    IssueTrendItem,
    IssueTrendResponse,
    OldestUnresolvedBacklogIssue,
    ProjectAnalyticsListResponse,
    ProjectAnalyticsResponse,
    SeverityDistributionResponse,
    PriorityDistributionResponse,
    SystemAnalyticsResponse,
)


# --------------------------------------------------------------------------- #
# A. System Overview (Admin Only)                                              #
# --------------------------------------------------------------------------- #

async def get_system_overview(
    db: AsyncSession,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> SystemAnalyticsResponse:
    """Return live system counts for users, projects, issues, and severities.

    Admin-only. Computes all counts via SQL aggregations in PostgreSQL.
    """
    user_result = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((User.is_active == True, 1))).label("active"),        # noqa: E712
            func.count(case((User.is_active == False, 1))).label("inactive"),     # noqa: E712
        ).select_from(User)
    )
    user_row = user_result.one()

    proj_result = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((Project.status == ProjectStatus.ACTIVE, 1))).label("active"),
        ).select_from(Project)
    )
    proj_row = proj_result.one()

    issue_query = select(
            func.count().label("total"),
            func.count(
                case((
                    Issue.status.in_([
                        IssueStatus.REPORTED,
                        IssueStatus.TRIAGED,
                        IssueStatus.ASSIGNED,
                        IssueStatus.REOPENED,
                    ]),
                    1,
                ))
            ).label("open"),
            func.count(
                case((
                    Issue.status.in_([
                        IssueStatus.IN_DEVELOPMENT,
                        IssueStatus.IN_REVIEW,
                        IssueStatus.IN_TESTING,
                    ]),
                    1,
                ))
            ).label("in_progress"),
            func.count(case((Issue.status == IssueStatus.RESOLVED, 1))).label("resolved"),
            func.count(case((Issue.status == IssueStatus.CLOSED, 1))).label("closed"),
            func.count(
                case((
                    Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]),
                    1,
                ))
            ).label("critical"),
            func.count(case((Issue.severity == Severity.MAJOR, 1))).label("high"),
            func.count(case((Issue.severity == Severity.MINOR, 1))).label("medium"),
            func.count(case((Issue.priority == Priority.LOW, 1))).label("low"),
        ).select_from(Issue)

    if start_date is not None:
        issue_query = issue_query.where(Issue.created_at >= start_date)
    if end_date is not None:
        issue_query = issue_query.where(Issue.created_at <= end_date)

    issue_result = await db.execute(issue_query)
    issue_row = issue_result.one()

    return SystemAnalyticsResponse(
        total_users=user_row.total,
        active_users=user_row.active,
        inactive_users=user_row.inactive,
        total_projects=proj_row.total,
        active_projects=proj_row.active,
        total_issues=issue_row.total,
        open_issues=issue_row.open,
        in_progress_issues=issue_row.in_progress,
        resolved_issues=issue_row.resolved,
        closed_issues=issue_row.closed,
        critical_issues=issue_row.critical,
        high_issues=issue_row.high,
        medium_issues=issue_row.medium,
        low_issues=issue_row.low,
    )


# --------------------------------------------------------------------------- #
# B. Status Distribution                                                      #
# --------------------------------------------------------------------------- #

async def get_status_distribution(
    db: AsyncSession,
    current_user: User,
    project_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> IssueStatusDistributionResponse:
    """Return issue status distribution respecting RBAC and optional filters."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be greater than end_date.",
        )

    query = select(Issue.status, func.count().label("cnt")).group_by(Issue.status)

    if current_user.role == UserRole.USER:
        # Users see only their own reported issues
        query = query.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        # Testers see only assigned issues
        query = query.where(Issue.assignee_id == current_user.id)

    if project_id is not None:
        query = query.where(Issue.project_id == project_id)
    if start_date is not None:
        query = query.where(Issue.created_at >= start_date)
    if end_date is not None:
        query = query.where(Issue.created_at <= end_date)

    result = await db.execute(query)
    counts = {row.status: row.cnt for row in result.all()}

    return IssueStatusDistributionResponse(
        REPORTED=counts.get(IssueStatus.REPORTED, 0),
        TRIAGED=counts.get(IssueStatus.TRIAGED, 0),
        ASSIGNED=counts.get(IssueStatus.ASSIGNED, 0),
        IN_DEVELOPMENT=counts.get(IssueStatus.IN_DEVELOPMENT, 0),
        IN_REVIEW=counts.get(IssueStatus.IN_REVIEW, 0),
        IN_TESTING=counts.get(IssueStatus.IN_TESTING, 0),
        RESOLVED=counts.get(IssueStatus.RESOLVED, 0),
        CLOSED=counts.get(IssueStatus.CLOSED, 0),
        REOPENED=counts.get(IssueStatus.REOPENED, 0),
    )


# --------------------------------------------------------------------------- #
# C. Severity Distribution                                                    #
# --------------------------------------------------------------------------- #

async def get_severity_distribution(
    db: AsyncSession,
    current_user: User,
    project_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    include_test: bool = False,
) -> SeverityDistributionResponse:
    """Return issue severity distribution respecting RBAC and optional filters."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be greater than end_date.",
        )

    query = select(Issue.severity, func.count().label("cnt")).group_by(Issue.severity)

    if not include_test:
        query = query.join(Project, Issue.project_id == Project.id).where(
            Project.is_test == False  # noqa: E712
        )

    if current_user.role == UserRole.USER:
        # Users see only their own reported issues
        query = query.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        # Developers see only assigned issues
        query = query.where(Issue.assignee_id == current_user.id)

    if project_id is not None:
        query = query.where(Issue.project_id == project_id)
    if start_date is not None:
        query = query.where(Issue.created_at >= start_date)
    if end_date is not None:
        query = query.where(Issue.created_at <= end_date)

    result = await db.execute(query)
    counts = {row.severity: row.cnt for row in result.all()}

    minor = counts.get(Severity.MINOR, 0)
    major = counts.get(Severity.MAJOR, 0)
    critical = counts.get(Severity.CRITICAL, 0)
    blocker = counts.get(Severity.BLOCKER, 0)
    total = minor + major + critical + blocker
    critical_blocker_total = critical + blocker
    critical_blocker_pct = round((critical_blocker_total / total * 100.0), 2) if total > 0 else 0.0

    return SeverityDistributionResponse(
        MINOR=minor,
        MAJOR=major,
        CRITICAL=critical,
        BLOCKER=blocker,
        total=total,
        critical_blocker_total=critical_blocker_total,
        critical_blocker_pct=critical_blocker_pct,
    )


# --------------------------------------------------------------------------- #
# C2. Priority Distribution                                                   #
# --------------------------------------------------------------------------- #

async def get_priority_distribution(
    db: AsyncSession,
    current_user: User,
    project_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> PriorityDistributionResponse:
    """Return issue priority distribution respecting RBAC and optional filters."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be greater than end_date.",
        )

    query = select(Issue.priority, func.count().label("cnt")).group_by(Issue.priority)

    if current_user.role == UserRole.USER:
        # Users see only their own reported issues
        query = query.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        # Testers see only assigned issues
        query = query.where(Issue.assignee_id == current_user.id)

    if project_id is not None:
        query = query.where(Issue.project_id == project_id)
    if start_date is not None:
        query = query.where(Issue.created_at >= start_date)
    if end_date is not None:
        query = query.where(Issue.created_at <= end_date)

    result = await db.execute(query)
    counts = {row.priority: row.cnt for row in result.all()}

    return PriorityDistributionResponse(
        LOW=counts.get(Priority.LOW, 0),
        MEDIUM=counts.get(Priority.MEDIUM, 0),
        HIGH=counts.get(Priority.HIGH, 0),
        URGENT=counts.get(Priority.URGENT, 0),
    )


# --------------------------------------------------------------------------- #
# D. Issue Trends                                                              #
# --------------------------------------------------------------------------- #

async def get_issue_trends(
    db: AsyncSession,
    current_user: User,
    interval: str = "day",
    project_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> IssueTrendResponse:
    """Return aggregated issue creation and resolution trends by time interval."""
    interval_clean = interval.strip().lower()
    if interval_clean not in ("day", "week", "month"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interval must be 'day', 'week', or 'month'.",
        )

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be greater than end_date.",
        )

    created_query = select(
        func.date_trunc(interval_clean, Issue.created_at).label("period"),
        func.count().label("cnt"),
    ).group_by("period")

    resolved_query = select(
        func.date_trunc(interval_clean, Issue.resolved_at).label("period"),
        func.count().label("cnt"),
    ).where(Issue.resolved_at.isnot(None)).group_by("period")

    if current_user.role == UserRole.USER:
        # Users see only their own reported issues
        created_query = created_query.where(Issue.reporter_id == current_user.id)
        resolved_query = resolved_query.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        # Testers see only assigned issues
        created_query = created_query.where(Issue.assignee_id == current_user.id)
        resolved_query = resolved_query.where(Issue.assignee_id == current_user.id)

    if project_id is not None:
        created_query = created_query.where(Issue.project_id == project_id)
        resolved_query = resolved_query.where(Issue.project_id == project_id)
    if start_date is not None:
        created_query = created_query.where(Issue.created_at >= start_date)
        resolved_query = resolved_query.where(Issue.resolved_at >= start_date)
    if end_date is not None:
        created_query = created_query.where(Issue.created_at <= end_date)
        resolved_query = resolved_query.where(Issue.resolved_at <= end_date)

    created_res = await db.execute(created_query)
    resolved_res = await db.execute(resolved_query)

    created_map: dict[str, int] = {}
    for row in created_res.all():
        if row.period:
            dt_str = row.period.strftime("%Y-%m-%d")
            created_map[dt_str] = row.cnt

    resolved_map: dict[str, int] = {}
    for row in resolved_res.all():
        if row.period:
            dt_str = row.period.strftime("%Y-%m-%d")
            resolved_map[dt_str] = row.cnt

    all_dates = sorted(set(created_map.keys()) | set(resolved_map.keys()))
    items = [
        IssueTrendItem(
            date=d,
            created_count=created_map.get(d, 0),
            resolved_count=resolved_map.get(d, 0),
        )
        for d in all_dates
    ]
    total_created = sum(created_map.values())
    total_resolved = sum(resolved_map.values())

    return IssueTrendResponse(
        interval=interval_clean,
        items=items,
        total_created=total_created,
        total_resolved=total_resolved,
    )


# --------------------------------------------------------------------------- #
# E. All Projects Analytics                                                    #
# --------------------------------------------------------------------------- #

async def get_all_projects_analytics(
    db: AsyncSession,
    current_user: User,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    include_test: bool = False,
) -> ProjectAnalyticsListResponse:
    """Return aggregated issue metrics and resolution rate for all projects."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be greater than end_date.",
        )

    proj_query = select(Project).order_by(Project.name)
    if not include_test:
        proj_query = proj_query.where(Project.is_test == False)  # noqa: E712
    proj_res = await db.execute(proj_query)
    projects = proj_res.scalars().all()

    open_statuses = [
        IssueStatus.REPORTED,
        IssueStatus.TRIAGED,
        IssueStatus.ASSIGNED,
        IssueStatus.IN_DEVELOPMENT,
        IssueStatus.IN_REVIEW,
        IssueStatus.IN_TESTING,
        IssueStatus.REOPENED,
    ]

    issue_query = select(
        Issue.project_id,
        func.count().label("total"),
        func.count(
            case((Issue.status.in_(open_statuses), 1))
        ).label("open"),
        func.count(
            case((
                Issue.status.in_([
                    IssueStatus.IN_DEVELOPMENT,
                    IssueStatus.IN_REVIEW,
                    IssueStatus.IN_TESTING,
                ]),
                1,
            ))
        ).label("in_progress"),
        func.count(case((Issue.status == IssueStatus.RESOLVED, 1))).label("resolved"),
        func.count(case((Issue.status == IssueStatus.CLOSED, 1))).label("closed"),
        func.count(
            case((
                Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]),
                1,
            ))
        ).label("critical"),
        func.count(
            case((
                and_(
                    Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]),
                    Issue.status.in_(open_statuses),
                ),
                1,
            ))
        ).label("critical_blocker_open"),
        func.count(
            case((
                Issue.status.in_([IssueStatus.RESOLVED, IssueStatus.CLOSED]),
                1,
            ))
        ).label("resolved_closed"),
        func.count(case((Issue.assignee_id.is_(None), 1))).label("unassigned"),
        func.avg(
            case((
                and_(
                    Issue.resolved_at.isnot(None),
                    Issue.resolved_at >= Issue.created_at,
                ),
                func.extract("epoch", Issue.resolved_at - Issue.created_at) / 3600.0,
            ))
        ).label("avg_res_time"),
    ).group_by(Issue.project_id)

    if not include_test:
        issue_query = issue_query.join(Project, Issue.project_id == Project.id).where(
            Project.is_test == False  # noqa: E712
        )

    if current_user.role == UserRole.USER:
        # Users see only their own reported issues
        issue_query = issue_query.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        # Developers see only assigned issues
        issue_query = issue_query.where(Issue.assignee_id == current_user.id)

    if start_date is not None:
        issue_query = issue_query.where(Issue.created_at >= start_date)
    if end_date is not None:
        issue_query = issue_query.where(Issue.created_at <= end_date)

    issue_res = await db.execute(issue_query)
    stats_by_project = {row.project_id: row for row in issue_res.all()}

    items: list[ProjectAnalyticsResponse] = []
    for proj in projects:
        row = stats_by_project.get(proj.id)
        total = row.total if row else 0

        if (start_date is not None or end_date is not None) and total == 0:
            continue

        open_cnt = row.open if row else 0
        in_prog = row.in_progress if row else 0
        res_cnt = row.resolved if row else 0
        closed_cnt = row.closed if row else 0
        crit_cnt = row.critical if row else 0
        crit_blocker_open_cnt = row.critical_blocker_open if row else 0
        res_closed_cnt = row.resolved_closed if row else 0
        unassigned_cnt = row.unassigned if row else 0
        avg_hours = float(row.avg_res_time) if (row and row.avg_res_time is not None) else None
        if avg_hours is not None:
            avg_hours = round(avg_hours, 2)
        rate = round((res_closed_cnt / total * 100.0), 2) if total > 0 else 0.0

        items.append(
            ProjectAnalyticsResponse(
                project_id=proj.id,
                project_name=proj.name,
                project_key=proj.project_key,
                total_issues=total,
                open_issues=open_cnt,
                in_progress_issues=in_prog,
                resolved_issues=res_cnt,
                closed_issues=closed_cnt,
                critical_issues=crit_cnt,
                resolution_rate=rate,
                critical_blocker_open_issues=crit_blocker_open_cnt,
                resolved_closed_issues=res_closed_cnt,
                fix_rate=rate,
                avg_resolution_time_hours=avg_hours,
                unassigned_issues=unassigned_cnt,
            )
        )

    return ProjectAnalyticsListResponse(items=items, total=len(items))


# --------------------------------------------------------------------------- #
# F. Single Project Analytics                                                  #
# --------------------------------------------------------------------------- #

async def get_project_analytics(
    project_id: int,
    db: AsyncSession,
    current_user: User,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> ProjectAnalyticsResponse:
    """Return metrics for a single project. Returns 404 if project is missing."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be greater than end_date.",
        )

    proj_res = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_res.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found.",
        )

    open_statuses = [
        IssueStatus.REPORTED,
        IssueStatus.TRIAGED,
        IssueStatus.ASSIGNED,
        IssueStatus.IN_DEVELOPMENT,
        IssueStatus.IN_REVIEW,
        IssueStatus.IN_TESTING,
        IssueStatus.REOPENED,
    ]

    issue_query = select(
        func.count().label("total"),
        func.count(
            case((Issue.status.in_(open_statuses), 1))
        ).label("open"),
        func.count(
            case((
                Issue.status.in_([
                    IssueStatus.IN_DEVELOPMENT,
                    IssueStatus.IN_REVIEW,
                    IssueStatus.IN_TESTING,
                ]),
                1,
            ))
        ).label("in_progress"),
        func.count(case((Issue.status == IssueStatus.RESOLVED, 1))).label("resolved"),
        func.count(case((Issue.status == IssueStatus.CLOSED, 1))).label("closed"),
        func.count(
            case((
                Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]),
                1,
            ))
        ).label("critical"),
        func.count(
            case((
                and_(
                    Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]),
                    Issue.status.in_(open_statuses),
                ),
                1,
            ))
        ).label("critical_blocker_open"),
        func.count(
            case((
                Issue.status.in_([IssueStatus.RESOLVED, IssueStatus.CLOSED]),
                1,
            ))
        ).label("resolved_closed"),
        func.count(case((Issue.assignee_id.is_(None), 1))).label("unassigned"),
        func.avg(
            case((
                and_(
                    Issue.resolved_at.isnot(None),
                    Issue.resolved_at >= Issue.created_at,
                ),
                func.extract("epoch", Issue.resolved_at - Issue.created_at) / 3600.0,
            ))
        ).label("avg_res_time"),
    ).select_from(Issue).where(Issue.project_id == project_id)

    if current_user.role == UserRole.USER:
        # Users see only their own reported issues
        issue_query = issue_query.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        # Developers see only assigned issues
        issue_query = issue_query.where(Issue.assignee_id == current_user.id)

    if start_date is not None:
        issue_query = issue_query.where(Issue.created_at >= start_date)
    if end_date is not None:
        issue_query = issue_query.where(Issue.created_at <= end_date)

    row = (await db.execute(issue_query)).one()
    total = row.total or 0
    open_cnt = row.open or 0
    in_prog = row.in_progress or 0
    res_cnt = row.resolved or 0
    closed_cnt = row.closed or 0
    crit_cnt = row.critical or 0
    crit_blocker_open_cnt = row.critical_blocker_open or 0
    res_closed_cnt = row.resolved_closed or 0
    unassigned_cnt = row.unassigned or 0
    avg_hours = float(row.avg_res_time) if (row.avg_res_time is not None) else None
    if avg_hours is not None:
        avg_hours = round(avg_hours, 2)
    rate = round((res_closed_cnt / total * 100.0), 2) if total > 0 else 0.0

    return ProjectAnalyticsResponse(
        project_id=project.id,
        project_name=project.name,
        project_key=project.project_key,
        total_issues=total,
        open_issues=open_cnt,
        in_progress_issues=in_prog,
        resolved_issues=res_cnt,
        closed_issues=closed_cnt,
        critical_issues=crit_cnt,
        resolution_rate=rate,
        critical_blocker_open_issues=crit_blocker_open_cnt,
        resolved_closed_issues=res_closed_cnt,
        fix_rate=rate,
        avg_resolution_time_hours=avg_hours,
        unassigned_issues=unassigned_cnt,
    )


# --------------------------------------------------------------------------- #
# G. Developer Performance (Admin Only)                                        #
# --------------------------------------------------------------------------- #

async def get_developer_performance(
    db: AsyncSession,
    preset: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    project_id: int | None = None,
    include_test: bool = False,
) -> DeveloperAnalyticsResponse:
    """Return assignment, resolution, reopened counts, and workload metrics for active developers.

    By default (include_test=False), automated test-fixture accounts (@example.com)
    and test-fixture projects (Project.is_test=True) are excluded so production
    and admin dashboards display only legitimate team workload.
    """
    # Preset date range calculation
    if preset:
        now_utc = datetime.now(timezone.utc)
        if preset == "7d":
            start_date = now_utc - timedelta(days=7)
            end_date = now_utc
        elif preset == "30d":
            start_date = now_utc - timedelta(days=30)
            end_date = now_utc
        elif preset == "90d":
            start_date = now_utc - timedelta(days=90)
            end_date = now_utc

    # 1. Fetch active developers (canonical DEVELOPER or legacy TESTER role)
    dev_query = select(User).where(
        User.role.in_([UserRole.DEVELOPER, "TESTER"]),
        User.is_active == True,
    )
    if not include_test:
        dev_query = dev_query.where(User.email.not_like("%@example.com"))

    dev_res = await db.execute(dev_query.order_by(User.id))
    developers = dev_res.scalars().all()

    # 2. Live assigned unresolved issues & critical backlog per developer
    workload_query = select(
        Issue.assignee_id,
        func.count().label("open_issues"),
        func.count(
            case((
                Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]),
                1,
            ))
        ).label("critical_open_issues"),
    ).where(
        Issue.assignee_id.isnot(None),
        Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.CLOSED]),
    )

    if not include_test:
        workload_query = workload_query.join(Project, Issue.project_id == Project.id).where(
            Project.is_test == False
        )
    if project_id is not None:
        workload_query = workload_query.where(Issue.project_id == project_id)

    workload_query = workload_query.group_by(Issue.assignee_id)
    workload_res = await db.execute(workload_query)
    workload_by_dev = {row.assignee_id: row for row in workload_res.all()}

    # 3. Performance in selectable date range (resolved & closed issues, resolution time)
    perf_query = select(
        Issue.assignee_id,
        func.count(
            case((Issue.status == IssueStatus.RESOLVED, 1))
        ).label("resolved_issues"),
        func.count(
            case((Issue.status == IssueStatus.CLOSED, 1))
        ).label("closed_issues"),
        func.avg(
            case((
                and_(Issue.resolved_at.isnot(None), Issue.resolved_at >= Issue.created_at),
                func.extract("epoch", Issue.resolved_at - Issue.created_at) / 3600.0,
            ))
        ).label("avg_res_time"),
    ).where(
        Issue.assignee_id.isnot(None),
        Issue.status.in_([IssueStatus.RESOLVED, IssueStatus.CLOSED]),
    )

    if not include_test:
        perf_query = perf_query.join(Project, Issue.project_id == Project.id).where(
            Project.is_test == False
        )
    if project_id is not None:
        perf_query = perf_query.where(Issue.project_id == project_id)

    res_date_col = func.coalesce(Issue.resolved_at, Issue.updated_at, Issue.created_at)
    if start_date is not None:
        perf_query = perf_query.where(res_date_col >= start_date)
    if end_date is not None:
        perf_query = perf_query.where(res_date_col <= end_date)

    perf_query = perf_query.group_by(Issue.assignee_id)
    perf_res = await db.execute(perf_query)
    perf_by_dev = {row.assignee_id: row for row in perf_res.all()}

    # 4. Reopened issue count per developer (audit event or current REOPENED status)
    reopen_query = (
        select(
            Issue.assignee_id,
            func.count(func.distinct(Issue.id)).label("reopened_count"),
        )
        .select_from(Issue)
        .outerjoin(
            AuditLog,
            and_(
                AuditLog.entity_id == Issue.id,
                AuditLog.entity_type == "ISSUE",
                AuditLog.action == AuditAction.ISSUE_REOPENED,
            ),
        )
        .where(
            Issue.assignee_id.isnot(None),
            or_(
                AuditLog.id.isnot(None),
                Issue.status == IssueStatus.REOPENED,
            ),
        )
    )

    if not include_test:
        reopen_query = reopen_query.join(Project, Issue.project_id == Project.id).where(
            Project.is_test == False
        )
    if project_id is not None:
        reopen_query = reopen_query.where(Issue.project_id == project_id)

    reopen_query = reopen_query.group_by(Issue.assignee_id)
    reopen_res = await db.execute(reopen_query)
    reopen_by_dev = {row.assignee_id: row.reopened_count for row in reopen_res.all()}

    # 5. Unassigned work (separate summary, not attributed to any developer)
    unassigned_query = select(
        func.count(
            case((
                Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.CLOSED]),
                1,
            ))
        ).label("unassigned_open"),
        func.count(
            case((
                and_(
                    Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.CLOSED]),
                    Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]),
                ),
                1,
            ))
        ).label("unassigned_critical"),
    ).where(
        Issue.assignee_id.is_(None)
    )

    if not include_test:
        unassigned_query = unassigned_query.join(Project, Issue.project_id == Project.id).where(
            Project.is_test == False
        )
    if project_id is not None:
        unassigned_query = unassigned_query.where(Issue.project_id == project_id)

    unassigned_res = await db.execute(unassigned_query)
    unassigned_row = unassigned_res.one()
    total_unassigned_open = unassigned_row.unassigned_open or 0
    total_unassigned_critical = unassigned_row.unassigned_critical or 0

    # 6. Overall totals across active developers
    total_assigned_open = sum(
        workload_by_dev[dev.id].open_issues
        for dev in developers
        if dev.id in workload_by_dev
    )
    total_critical_open = sum(
        workload_by_dev[dev.id].critical_open_issues
        for dev in developers
        if dev.id in workload_by_dev
    )
    total_resolved_period = sum(
        perf_by_dev[dev.id].resolved_issues
        for dev in developers
        if dev.id in perf_by_dev
    )
    total_closed_period = sum(
        perf_by_dev[dev.id].closed_issues
        for dev in developers
        if dev.id in perf_by_dev
    )

    valid_res_times = [
        float(perf_by_dev[dev.id].avg_res_time)
        for dev in developers
        if dev.id in perf_by_dev and perf_by_dev[dev.id].avg_res_time is not None
    ]
    team_avg_res_time = (
        round(sum(valid_res_times) / len(valid_res_times), 2)
        if valid_res_times
        else None
    )

    # 7. Assemble items
    items: list[DeveloperAnalyticsItem] = []
    for dev in developers:
        w_row = workload_by_dev.get(dev.id)
        p_row = perf_by_dev.get(dev.id)

        open_cnt = w_row.open_issues if w_row else 0
        crit_open = w_row.critical_open_issues if w_row else 0
        resolved = p_row.resolved_issues if p_row else 0
        closed = p_row.closed_issues if p_row else 0
        total_completed = resolved + closed
        reopened = reopen_by_dev.get(dev.id, 0)

        avg_time = (
            round(float(p_row.avg_res_time), 2)
            if (p_row and p_row.avg_res_time is not None)
            else None
        )

        share_pct = (
            round((open_cnt / total_assigned_open * 100.0), 1)
            if total_assigned_open > 0
            else 0.0
        )

        total_workload_lifecycle = open_cnt + total_completed
        rate = (
            round((total_completed / total_workload_lifecycle * 100.0), 2)
            if total_workload_lifecycle > 0
            else 0.0
        )

        items.append(
            DeveloperAnalyticsItem(
                developer_id=dev.id,
                developer_name=dev.full_name,
                developer_email=dev.email,
                assigned_issues=total_workload_lifecycle,
                resolved_issues=resolved,
                open_issues=open_cnt,
                critical_open_issues=crit_open,
                closed_issues=closed,
                reopened_issues=reopened,
                total_completed_period=total_completed,
                workload_share_pct=share_pct,
                resolution_rate=rate,
                average_resolution_time_hours=avg_time,
            )
        )

    # Prioritize active workload descending, then critical backlog, then completed
    items.sort(
        key=lambda x: (x.open_issues, x.critical_open_issues, x.total_completed_period),
        reverse=True,
    )

    return DeveloperAnalyticsResponse(
        items=items,
        total=len(items),
        total_assigned_open=total_assigned_open,
        total_critical_open=total_critical_open,
        total_unassigned_open=total_unassigned_open,
        total_unassigned_critical=total_unassigned_critical,
        total_resolved_period=total_resolved_period,
        total_closed_period=total_closed_period,
        team_avg_resolution_time_hours=team_avg_res_time,
        preset=preset,
        project_id=project_id,
    )


# --------------------------------------------------------------------------- #
# H. Export Issues CSV                                                         #
# --------------------------------------------------------------------------- #

async def export_issues_csv(
    db: AsyncSession,
    current_user: User,
    project_id: int | None = None,
    status_filter: IssueStatus | None = None,
    severity_filter: Severity | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> Response:
    """Generate and return an RFC 4180 compliant CSV export of filtered issues."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be greater than end_date.",
        )

    query = (
        select(Issue)
        .options(
            selectinload(Issue.project),
            selectinload(Issue.reporter),
            selectinload(Issue.assignee),
        )
        .order_by(Issue.id)
    )

    if current_user.role == UserRole.USER:
        # Users see only their own reported issues
        query = query.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        # Testers see only assigned issues
        query = query.where(Issue.assignee_id == current_user.id)

    if project_id is not None:
        query = query.where(Issue.project_id == project_id)
    if status_filter is not None:
        query = query.where(Issue.status == status_filter)
    if severity_filter is not None:
        query = query.where(Issue.severity == severity_filter)
    if start_date is not None:
        query = query.where(Issue.created_at >= start_date)
    if end_date is not None:
        query = query.where(Issue.created_at <= end_date)

    result = await db.execute(query)
    issues = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Header row based on actual Issue model columns
    writer.writerow([
        "id",
        "issue_key",
        "title",
        "status",
        "severity",
        "priority",
        "project",
        "reporter",
        "assignee",
        "created_at",
        "resolved_at",
    ])

    for issue in issues:
        proj_str = issue.project.name if issue.project else ""
        reporter_str = issue.reporter.full_name if issue.reporter else ""
        assignee_str = issue.assignee.full_name if issue.assignee else ""
        created_str = issue.created_at.isoformat() if issue.created_at else ""
        resolved_str = issue.resolved_at.isoformat() if issue.resolved_at else ""

        writer.writerow([
            issue.id,
            issue.issue_key,
            issue.title,
            issue.status.value if hasattr(issue.status, "value") else str(issue.status),
            issue.severity.value if hasattr(issue.severity, "value") else str(issue.severity),
            issue.priority.value if hasattr(issue.priority, "value") else str(issue.priority),
            proj_str,
            reporter_str,
            assignee_str,
            created_str,
            resolved_str,
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="issues_export.csv"',
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


# --------------------------------------------------------------------------- #
# I. Quality Metrics â€” Milestone 2                                             #
# --------------------------------------------------------------------------- #

async def get_quality_metrics(
    db: AsyncSession,
    current_user: User,
    project_id: int | None = None,
) -> "QualityMetricsResponse":  # noqa: F821 â€” imported below to avoid circular
    """
    Compute Fix Rate, MTTR, Defect Leakage Rate, and Backlog Health Score.

    Definitions
    -----------
    fix_rate:
        (resolved + closed) / total * 100.  Measures what fraction of all
        known issues have been resolved.

    mttr_hours:
        Average epoch-seconds between created_at and resolved_at for all
        issues that have a resolved_at timestamp, converted to hours.
        Returns None when no issues have been resolved yet.

    defect_leakage_rate:
        Percentage of CRITICAL/BLOCKER issues that were ever reopened.
        Proxy: count of issues in REOPENED status with severity in
        (CRITICAL, BLOCKER) / total critical+blocker issues * 100.

    backlog_health_score:
        Composite score 0â€“100 where 100 = perfectly healthy backlog.
        Formula: 100 âˆ’ (critical_open_weight + age_weight)
          critical_open_weight = min(40, open_critical * 4)
          age_weight           = min(40, avg_age_days * 0.5)
        The remaining 20 pts are deducted if fix_rate < 50 (scale 0â€“20).
    """
    from app.schemas.analytics import QualityMetricsResponse

    # Base query scope
    base_q = select(Issue)
    if current_user.role == UserRole.USER:
        base_q = base_q.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        base_q = base_q.where(Issue.assignee_id == current_user.id)
    if project_id is not None:
        base_q = base_q.where(Issue.project_id == project_id)

    # â”€â”€ Total / resolved / closed counts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    counts_result = await db.execute(
        base_q.with_only_columns(
            func.count().label("total"),
            func.count(case((Issue.status == IssueStatus.RESOLVED, 1))).label("resolved"),
            func.count(case((Issue.status == IssueStatus.CLOSED, 1))).label("closed"),
            func.count(
                case((
                    Issue.status.in_([IssueStatus.REPORTED, IssueStatus.TRIAGED,
                                      IssueStatus.ASSIGNED, IssueStatus.REOPENED,
                                      IssueStatus.IN_DEVELOPMENT, IssueStatus.IN_REVIEW,
                                      IssueStatus.IN_TESTING]),
                    1,
                ))
            ).label("open"),
            func.count(
                case((
                    Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]),
                    1,
                ))
            ).label("total_critical"),
            func.count(
                case((
                    and_(
                        Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]),
                        Issue.status.in_([
                            IssueStatus.REPORTED, IssueStatus.TRIAGED,
                            IssueStatus.ASSIGNED, IssueStatus.REOPENED,
                            IssueStatus.IN_DEVELOPMENT, IssueStatus.IN_REVIEW,
                            IssueStatus.IN_TESTING,
                        ]),
                    ),
                    1,
                ))
            ).label("open_critical"),
            func.count(
                case((
                    and_(
                        Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER]),
                        Issue.status == IssueStatus.REOPENED,
                    ),
                    1,
                ))
            ).label("reopened_critical"),
        )
    )
    row = counts_result.one()

    total: int = row.total or 0
    resolved: int = row.resolved or 0
    closed: int = row.closed or 0
    open_cnt: int = row.open or 0
    total_critical: int = row.total_critical or 0
    open_critical: int = row.open_critical or 0
    reopened_critical: int = row.reopened_critical or 0

    # ── Fix Rate ──────────────────────────────────────────────────────────────
    fix_rate = round((resolved + closed) / total * 100, 2) if total > 0 else 0.0

    # ── MTTR ──────────────────────────────────────────────────────────────────
    mttr_result = await db.execute(
        base_q.with_only_columns(
            func.avg(
                case((
                    Issue.resolved_at.isnot(None),
                    func.extract("epoch", Issue.resolved_at - Issue.created_at) / 3600.0,
                ))
            ).label("avg_hours")
        ).where(Issue.resolved_at.isnot(None))
    )
    mttr_row = mttr_result.one()
    mttr_hours: float | None = None
    if mttr_row.avg_hours is not None:
        mttr_hours = round(float(mttr_row.avg_hours), 2)

    # ── Defect Leakage Rate ───────────────────────────────────────────────────
    defect_leakage_rate = (
        round(reopened_critical / total_critical * 100, 2)
        if total_critical > 0 else 0.0
    )

    # ── Average Age of Open Issues ────────────────────────────────────────────
    age_result = await db.execute(
        base_q.with_only_columns(
            func.avg(
                func.extract("epoch", func.now() - Issue.created_at) / 86400.0
            ).label("avg_days")
        ).where(
            Issue.status.in_([
                IssueStatus.REPORTED, IssueStatus.TRIAGED, IssueStatus.ASSIGNED,
                IssueStatus.REOPENED, IssueStatus.IN_DEVELOPMENT,
                IssueStatus.IN_REVIEW, IssueStatus.IN_TESTING,
            ])
        )
    )
    age_row = age_result.one()
    avg_age_open_days: float = round(float(age_row.avg_days), 2) if age_row.avg_days else 0.0

    # ── Backlog Health Score ──────────────────────────────────────────────────
    if total == 0:
        backlog_health_score = 100.0
    else:
        critical_weight = min(40.0, open_critical * 4.0)
        age_weight = min(40.0, avg_age_open_days * 0.5)
        fix_rate_penalty = max(0.0, (50.0 - fix_rate) / 50.0 * 20.0) if fix_rate < 50 else 0.0
        backlog_health_score = round(max(0.0, 100.0 - critical_weight - age_weight - fix_rate_penalty), 2)

    return QualityMetricsResponse(
        fix_rate=fix_rate,
        mttr_hours=mttr_hours,
        defect_leakage_rate=defect_leakage_rate,
        backlog_health_score=backlog_health_score,
        open_critical_count=open_critical,
        avg_age_open_days=avg_age_open_days,
        total_issues=total,
    )


# --------------------------------------------------------------------------- #
# J. Defect Trends & Quality History — Feature 01                             #
# --------------------------------------------------------------------------- #

async def get_defect_trends_history(
    db: AsyncSession,
    current_user: User,
    preset: str = "30d",
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    project_id: int | None = None,
    include_test: bool = False,
) -> "DefectTrendsHistoryResponse":  # noqa: F821
    """
    Compute time-series defect trends, status distributions, and period-over-period
    comparisons using aggregated PostgreSQL queries.
    """
    from app.schemas.analytics import (
        DefectTrendPoint,
        DefectStatusTrend,
        PeriodComparison,
        DefectTrendsHistoryResponse,
    )

    preset_clean = preset.strip().lower() if preset else "30d"
    now_utc = datetime.now(timezone.utc)

    if preset_clean == "7d":
        end_dt = now_utc
        start_dt = end_dt - timedelta(days=7)
    elif preset_clean == "90d":
        end_dt = now_utc
        start_dt = end_dt - timedelta(days=90)
    elif preset_clean == "custom":
        if not start_date or not end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both start_date and end_date are required for custom date range.",
            )
        start_dt = start_date if start_date.tzinfo else start_date.replace(tzinfo=timezone.utc)
        end_dt = end_date if end_date.tzinfo else end_date.replace(tzinfo=timezone.utc)
        if start_dt > end_dt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date cannot be greater than end_date.",
            )
    else:  # default to 30d
        preset_clean = "30d"
        end_dt = now_utc
        start_dt = end_dt - timedelta(days=30)

    duration = end_dt - start_dt
    prev_end_dt = start_dt
    prev_start_dt = start_dt - duration

    # Base query with project join
    base_q = select(Issue).join(Project, Issue.project_id == Project.id)
    if not include_test:
        base_q = base_q.where(Project.is_test == False)  # noqa: E712

    if current_user.role == UserRole.USER:
        base_q = base_q.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        base_q = base_q.where(Issue.assignee_id == current_user.id)

    if project_id is not None:
        base_q = base_q.where(Issue.project_id == project_id)

    open_statuses = [
        IssueStatus.REPORTED, IssueStatus.TRIAGED,
        IssueStatus.ASSIGNED, IssueStatus.IN_DEVELOPMENT,
        IssueStatus.IN_REVIEW, IssueStatus.IN_TESTING,
    ]

    # 1. Aggregated summary and comparison query
    q_summary = base_q.with_only_columns(
        # Current period events
        func.count(case((and_(Issue.created_at >= start_dt, Issue.created_at <= end_dt), 1))).label("curr_reported"),
        func.count(case((and_(Issue.resolved_at.isnot(None), Issue.resolved_at >= start_dt, Issue.resolved_at <= end_dt), 1))).label("curr_resolved"),
        func.count(case((and_(Issue.status == IssueStatus.CLOSED, Issue.resolved_at.isnot(None), Issue.resolved_at >= start_dt, Issue.resolved_at <= end_dt), 1))).label("curr_closed"),
        # Previous period events
        func.count(case((and_(Issue.created_at >= prev_start_dt, Issue.created_at < start_dt), 1))).label("prev_reported"),
        func.count(case((and_(Issue.resolved_at.isnot(None), Issue.resolved_at >= prev_start_dt, Issue.resolved_at < start_dt), 1))).label("prev_resolved"),
        func.count(case((and_(Issue.status == IssueStatus.CLOSED, Issue.resolved_at.isnot(None), Issue.resolved_at >= prev_start_dt, Issue.resolved_at < start_dt), 1))).label("prev_closed"),
        # Backlog snapshots
        func.count(case((and_(Issue.created_at < start_dt, or_(Issue.resolved_at.is_(None), Issue.resolved_at >= start_dt)), 1))).label("opening_backlog"),
        func.count(case((and_(Issue.created_at <= end_dt, or_(Issue.resolved_at.is_(None), Issue.resolved_at > end_dt)), 1))).label("closing_backlog"),
        func.count(case((and_(Issue.created_at < prev_start_dt, or_(Issue.resolved_at.is_(None), Issue.resolved_at >= prev_start_dt)), 1))).label("prev_opening_backlog"),
        # Status distribution of defects created in current period
        func.count(case((and_(Issue.created_at >= start_dt, Issue.created_at <= end_dt, Issue.status.in_(open_statuses)), 1))).label("status_open"),
        func.count(case((and_(Issue.created_at >= start_dt, Issue.created_at <= end_dt, Issue.status == IssueStatus.RESOLVED), 1))).label("status_resolved"),
        func.count(case((and_(Issue.created_at >= start_dt, Issue.created_at <= end_dt, Issue.status == IssueStatus.CLOSED), 1))).label("status_closed"),
        func.count(case((and_(Issue.created_at >= start_dt, Issue.created_at <= end_dt, Issue.status == IssueStatus.REOPENED), 1))).label("status_reopened"),
    )

    summary_res = await db.execute(q_summary)
    row = summary_res.one()

    curr_rep = row.curr_reported or 0
    curr_res = row.curr_resolved or 0
    curr_closed = row.curr_closed or 0
    opening_b = row.opening_backlog or 0
    closing_b = row.closing_backlog or 0
    curr_net = closing_b - opening_b

    prev_rep = row.prev_reported or 0
    prev_res = row.prev_resolved or 0
    prev_closed = row.prev_closed or 0
    prev_opening_b = row.prev_opening_backlog or 0
    prev_closing_b = opening_b
    prev_net = prev_closing_b - prev_opening_b

    rep_pct_change = round((curr_rep - prev_rep) / prev_rep * 100.0, 1) if prev_rep > 0 else None
    res_pct_change = round((curr_res - prev_res) / prev_res * 100.0, 1) if prev_res > 0 else None
    closed_pct_change = round((curr_closed - prev_closed) / prev_closed * 100.0, 1) if prev_closed > 0 else None
    net_pct_change = round((curr_net - prev_net) / abs(prev_net) * 100.0, 1) if prev_net != 0 else None

    # 2. Timeline series query (daily aggregation)
    q_daily_rep = (
        base_q.with_only_columns(
            func.date_trunc("day", Issue.created_at).label("day"),
            func.count().label("cnt"),
        )
        .where(Issue.created_at >= start_dt, Issue.created_at <= end_dt)
        .group_by("day")
        .order_by("day")
    )
    daily_rep_res = await db.execute(q_daily_rep)
    rep_map: dict[str, int] = {
        r.day.strftime("%Y-%m-%d"): r.cnt for r in daily_rep_res.all() if r.day
    }

    q_daily_res = (
        base_q.with_only_columns(
            func.date_trunc("day", Issue.resolved_at).label("day"),
            func.count().label("cnt"),
        )
        .where(Issue.resolved_at.isnot(None), Issue.resolved_at >= start_dt, Issue.resolved_at <= end_dt)
        .group_by("day")
        .order_by("day")
    )
    daily_res_res = await db.execute(q_daily_res)
    res_map: dict[str, int] = {
        r.day.strftime("%Y-%m-%d"): r.cnt for r in daily_res_res.all() if r.day
    }

    q_daily_closed = (
        base_q.with_only_columns(
            func.date_trunc("day", Issue.resolved_at).label("day"),
            func.count().label("cnt"),
        )
        .where(
            Issue.status == IssueStatus.CLOSED,
            Issue.resolved_at.isnot(None),
            Issue.resolved_at >= start_dt,
            Issue.resolved_at <= end_dt,
        )
        .group_by("day")
        .order_by("day")
    )
    daily_closed_res = await db.execute(q_daily_closed)
    closed_map: dict[str, int] = {
        r.day.strftime("%Y-%m-%d"): r.cnt for r in daily_closed_res.all() if r.day
    }

    # Generate complete day-by-day sequence
    timeline: list[DefectTrendPoint] = []
    curr_date = start_dt.date()
    end_date_d = end_dt.date()
    cum_net = 0

    while curr_date <= end_date_d:
        d_str = curr_date.strftime("%Y-%m-%d")
        d_rep = rep_map.get(d_str, 0)
        d_res = res_map.get(d_str, 0)
        d_closed = closed_map.get(d_str, 0)
        d_net = d_rep - d_res
        cum_net += d_net

        timeline.append(
            DefectTrendPoint(
                date=d_str,
                reported_count=d_rep,
                resolved_count=d_res,
                closed_count=d_closed,
                net_change=d_net,
                cumulative_net=cum_net,
            )
        )
        curr_date += timedelta(days=1)

    status_trend = DefectStatusTrend(
        open=row.status_open or 0,
        resolved=row.status_resolved or 0,
        closed=row.status_closed or 0,
        reopened=row.status_reopened or 0,
        total=curr_rep,
    )

    comparison = PeriodComparison(
        current_reported=curr_rep,
        previous_reported=prev_rep,
        reported_pct_change=rep_pct_change,
        current_resolved=curr_res,
        previous_resolved=prev_res,
        resolved_pct_change=res_pct_change,
        current_closed=curr_closed,
        previous_closed=prev_closed,
        closed_pct_change=closed_pct_change,
        opening_backlog=opening_b,
        closing_backlog=closing_b,
        prev_opening_backlog=prev_opening_b,
        prev_closing_backlog=prev_closing_b,
        current_net_backlog=curr_net,
        previous_net_backlog=prev_net,
        net_backlog_pct_change=net_pct_change,
        start_date=start_dt.isoformat(),
        end_date=end_dt.isoformat(),
        prev_start_date=prev_start_dt.isoformat(),
        prev_end_date=prev_end_dt.isoformat(),
    )

    return DefectTrendsHistoryResponse(
        range_preset=preset_clean,
        start_date=start_dt.isoformat(),
        end_date=end_dt.isoformat(),
        opening_backlog=opening_b,
        closing_backlog=closing_b,
        total_reported=curr_rep,
        total_resolved=curr_res,
        total_closed=curr_closed,
        net_backlog_change=curr_net,
        comparison=comparison,
        timeline=timeline,
        status_trend=status_trend,
    )


# --------------------------------------------------------------------------- #
# J. Backlog Aging Distribution & Risk Analysis — Feature 03                  #
# --------------------------------------------------------------------------- #

async def get_backlog_aging_distribution(
    db: AsyncSession,
    current_user: User,
    project_id: int | None = None,
    severity: Severity | None = None,
    is_assigned: bool | None = None,
    include_test: bool = False,
) -> BacklogAgingDistributionResponse:
    """Compute precise non-overlapping backlog aging distribution and operational risk metrics.

    Age boundaries (UTC):
      - Under 24 hours: created_at >= now - 24 hours
      - 1–3 days: now - 72 hours <= created_at < now - 24 hours
      - 3–7 days: now - 7 days <= created_at < now - 72 hours
      - Over 7 days: created_at < now - 7 days

    All calculations apply RBAC visibility rules, exclude test fixture projects by default,
    and execute via a single-pass SQL aggregation query with zero in-memory row iteration.
    """
    now_utc = datetime.now(timezone.utc)
    cutoff_24h = now_utc - timedelta(hours=24)
    cutoff_72h = now_utc - timedelta(hours=72)
    cutoff_7d = now_utc - timedelta(days=7)

    base_q = select(Issue).join(Project, Issue.project_id == Project.id).where(
        Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.CLOSED])
    )

    if not include_test:
        base_q = base_q.where(Project.is_test == False)  # noqa: E712

    if current_user.role == UserRole.USER:
        base_q = base_q.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        base_q = base_q.where(Issue.assignee_id == current_user.id)

    if project_id is not None:
        base_q = base_q.where(Issue.project_id == project_id)
    if severity is not None:
        base_q = base_q.where(Issue.severity == severity)
    if is_assigned is True:
        base_q = base_q.where(Issue.assignee_id.isnot(None))
    elif is_assigned is False:
        base_q = base_q.where(Issue.assignee_id.is_(None))

    crit_blocker_cond = Issue.severity.in_([Severity.CRITICAL, Severity.BLOCKER])
    unassigned_cond = Issue.assignee_id.is_(None)

    agg_stmt = base_q.with_only_columns(
        func.count().label("total_unresolved"),
        func.count(case((crit_blocker_cond, 1))).label("critical_blocker_unresolved"),
        func.count(case((unassigned_cond, 1))).label("unassigned_unresolved"),
        func.count(case((Issue.created_at < cutoff_7d, 1))).label("issues_older_than_7d"),
        func.count(case((and_(crit_blocker_cond, Issue.created_at < cutoff_24h), 1))).label(
            "critical_blocker_older_than_24h"
        ),
        # Bucket 1: under 24h
        func.count(case((Issue.created_at >= cutoff_24h, 1))).label("u24_total"),
        func.count(case((and_(Issue.created_at >= cutoff_24h, crit_blocker_cond), 1))).label(
            "u24_crit"
        ),
        func.count(case((and_(Issue.created_at >= cutoff_24h, unassigned_cond), 1))).label(
            "u24_unassigned"
        ),
        # Bucket 2: 1 to 3 days (24h to 72h)
        func.count(
            case((and_(Issue.created_at < cutoff_24h, Issue.created_at >= cutoff_72h), 1))
        ).label("d1_3_total"),
        func.count(
            case((
                and_(
                    Issue.created_at < cutoff_24h,
                    Issue.created_at >= cutoff_72h,
                    crit_blocker_cond,
                ),
                1,
            ))
        ).label("d1_3_crit"),
        func.count(
            case((
                and_(
                    Issue.created_at < cutoff_24h,
                    Issue.created_at >= cutoff_72h,
                    unassigned_cond,
                ),
                1,
            ))
        ).label("d1_3_unassigned"),
        # Bucket 3: 3 to 7 days (72h to 7d)
        func.count(
            case((and_(Issue.created_at < cutoff_72h, Issue.created_at >= cutoff_7d), 1))
        ).label("d3_7_total"),
        func.count(
            case((
                and_(
                    Issue.created_at < cutoff_72h,
                    Issue.created_at >= cutoff_7d,
                    crit_blocker_cond,
                ),
                1,
            ))
        ).label("d3_7_crit"),
        func.count(
            case((
                and_(
                    Issue.created_at < cutoff_72h,
                    Issue.created_at >= cutoff_7d,
                    unassigned_cond,
                ),
                1,
            ))
        ).label("d3_7_unassigned"),
        # Bucket 4: over 7 days
        func.count(case((Issue.created_at < cutoff_7d, 1))).label("over_7d_total"),
        func.count(case((and_(Issue.created_at < cutoff_7d, crit_blocker_cond), 1))).label(
            "over_7d_crit"
        ),
        func.count(case((and_(Issue.created_at < cutoff_7d, unassigned_cond), 1))).label(
            "over_7d_unassigned"
        ),
    )

    agg_res = await db.execute(agg_stmt)
    agg_row = agg_res.one()

    total_unres = agg_row.total_unresolved or 0

    # Oldest unresolved defect lookup (single indexed LIMIT 1 query)
    oldest_stmt = (
        base_q.with_only_columns(
            Issue.id,
            Issue.issue_key,
            Issue.title,
            Issue.created_at,
            Issue.severity,
            Issue.status,
            Project.id.label("project_id"),
            Project.name.label("project_name"),
            Project.project_key.label("project_key"),
            User.full_name.label("assignee_name"),
        )
        .outerjoin(User, Issue.assignee_id == User.id)
        .order_by(Issue.created_at.asc())
        .limit(1)
    )
    oldest_res = await db.execute(oldest_stmt)
    oldest_row = oldest_res.first()

    oldest_item: OldestUnresolvedBacklogIssue | None = None
    if oldest_row:
        c_dt = oldest_row.created_at
        if c_dt.tzinfo is None:
            c_dt = c_dt.replace(tzinfo=timezone.utc)
        age_days = round(max(0.0, (now_utc - c_dt).total_seconds() / 86400.0), 1)
        oldest_item = OldestUnresolvedBacklogIssue(
            id=oldest_row.id,
            issue_key=oldest_row.issue_key,
            title=oldest_row.title,
            project_id=oldest_row.project_id,
            project_name=oldest_row.project_name,
            project_key=oldest_row.project_key,
            severity=oldest_row.severity,
            status=oldest_row.status,
            created_at=oldest_row.created_at,
            age_days=age_days,
            assignee_name=oldest_row.assignee_name,
        )

    summary = BacklogRiskSummary(
        total_unresolved=total_unres,
        critical_blocker_unresolved=agg_row.critical_blocker_unresolved or 0,
        unassigned_unresolved=agg_row.unassigned_unresolved or 0,
        issues_older_than_7d=agg_row.issues_older_than_7d or 0,
        critical_blocker_older_than_24h=agg_row.critical_blocker_older_than_24h or 0,
        oldest_unresolved=oldest_item,
    )

    u24_total = agg_row.u24_total or 0
    d1_3_total = agg_row.d1_3_total or 0
    d3_7_total = agg_row.d3_7_total or 0
    over_7d_total = agg_row.over_7d_total or 0

    buckets = [
        BacklogAgingBucketItem(
            bucket_key="under_24h",
            label="Under 24 hours",
            boundary_desc="< 24 hours",
            total_issues=u24_total,
            critical_blocker_count=agg_row.u24_crit or 0,
            unassigned_count=agg_row.u24_unassigned or 0,
            percentage=round(u24_total / total_unres * 100.0, 1) if total_unres > 0 else 0.0,
        ),
        BacklogAgingBucketItem(
            bucket_key="days_1_to_3",
            label="1–3 days",
            boundary_desc="24 hours to 72 hours",
            total_issues=d1_3_total,
            critical_blocker_count=agg_row.d1_3_crit or 0,
            unassigned_count=agg_row.d1_3_unassigned or 0,
            percentage=round(d1_3_total / total_unres * 100.0, 1) if total_unres > 0 else 0.0,
        ),
        BacklogAgingBucketItem(
            bucket_key="days_3_to_7",
            label="3–7 days",
            boundary_desc="72 hours to 7 days",
            total_issues=d3_7_total,
            critical_blocker_count=agg_row.d3_7_crit or 0,
            unassigned_count=agg_row.d3_7_unassigned or 0,
            percentage=round(d3_7_total / total_unres * 100.0, 1) if total_unres > 0 else 0.0,
        ),
        BacklogAgingBucketItem(
            bucket_key="over_7d",
            label="More than 7 days",
            boundary_desc="> 7 days (168+ hours in backlog)",
            total_issues=over_7d_total,
            critical_blocker_count=agg_row.over_7d_crit or 0,
            unassigned_count=agg_row.over_7d_unassigned or 0,
            percentage=round(over_7d_total / total_unres * 100.0, 1) if total_unres > 0 else 0.0,
        ),
    ]

    return BacklogAgingDistributionResponse(summary=summary, buckets=buckets)


async def get_backlog_risk_issues(
    db: AsyncSession,
    current_user: User,
    project_id: int | None = None,
    severity: Severity | None = None,
    is_assigned: bool | None = None,
    age_bucket: str | None = None,
    sort_by: str = "risk_score",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 10,
    include_test: bool = False,
) -> BacklogRiskIssuesResponse:
    """Return paginated, ranked list of highest-risk unresolved backlog issues.

    Risk score formula (0–100 scale, transparent prioritization aid):
      - Severity Base (0–40): BLOCKER=40, CRITICAL=30, MAJOR=20, MINOR=10
      - Age Points (0–40): min(40, round(age_days * 2.5, 1))
      - Assignment Factor (0–20): unassigned=+20, assigned=0
    Risk level classification:
      - CRITICAL (>= 70)
      - HIGH (50–69.9)
      - MEDIUM (30–49.9)
      - LOW (< 30)
    """
    page = max(1, page)
    page_size = max(1, min(page_size, 100))

    now_utc = datetime.now(timezone.utc)
    cutoff_24h = now_utc - timedelta(hours=24)
    cutoff_72h = now_utc - timedelta(hours=72)
    cutoff_7d = now_utc - timedelta(days=7)

    query = (
        select(
            Issue.id,
            Issue.issue_key,
            Issue.title,
            Issue.severity,
            Issue.priority,
            Issue.status,
            Issue.created_at,
            Issue.assignee_id,
            Project.id.label("project_id"),
            Project.name.label("project_name"),
            Project.project_key.label("project_key"),
            User.full_name.label("assignee_name"),
        )
        .join(Project, Issue.project_id == Project.id)
        .outerjoin(User, Issue.assignee_id == User.id)
        .where(Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.CLOSED]))
    )

    if not include_test:
        query = query.where(Project.is_test == False)  # noqa: E712

    if current_user.role == UserRole.USER:
        query = query.where(Issue.reporter_id == current_user.id)
    elif current_user.role == UserRole.DEVELOPER:
        query = query.where(Issue.assignee_id == current_user.id)

    if project_id is not None:
        query = query.where(Issue.project_id == project_id)
    if severity is not None:
        query = query.where(Issue.severity == severity)
    if is_assigned is True:
        query = query.where(Issue.assignee_id.isnot(None))
    elif is_assigned is False:
        query = query.where(Issue.assignee_id.is_(None))

    if age_bucket == "under_24h":
        query = query.where(Issue.created_at >= cutoff_24h)
    elif age_bucket == "days_1_to_3":
        query = query.where(and_(Issue.created_at < cutoff_24h, Issue.created_at >= cutoff_72h))
    elif age_bucket == "days_3_to_7":
        query = query.where(and_(Issue.created_at < cutoff_72h, Issue.created_at >= cutoff_7d))
    elif age_bucket == "over_7d":
        query = query.where(Issue.created_at < cutoff_7d)

    # Count total matching rows via SQL aggregation
    count_query = select(func.count()).select_from(query.subquery())
    total_count = (await db.execute(count_query)).scalar_one()

    # Risk score expression in SQL for server-side sorting
    sev_expr = case(
        (Issue.severity == Severity.BLOCKER, 40.0),
        (Issue.severity == Severity.CRITICAL, 30.0),
        (Issue.severity == Severity.MAJOR, 20.0),
        else_=10.0,
    )
    age_pts_expr = func.least(40.0, (func.extract("epoch", func.now() - Issue.created_at) / 86400.0) * 2.5)
    unassigned_pts_expr = case((Issue.assignee_id.is_(None), 20.0), else_=0.0)
    risk_score_expr = sev_expr + age_pts_expr + unassigned_pts_expr

    if sort_by == "risk_score":
        order_col = risk_score_expr.desc() if sort_dir == "desc" else risk_score_expr.asc()
        query = query.order_by(order_col, Issue.created_at.asc())
    elif sort_by == "age":
        order_col = Issue.created_at.asc() if sort_dir == "desc" else Issue.created_at.desc()
        query = query.order_by(order_col)
    elif sort_by == "severity":
        order_col = sev_expr.desc() if sort_dir == "desc" else sev_expr.asc()
        query = query.order_by(order_col, Issue.created_at.asc())
    else:
        query = query.order_by(risk_score_expr.desc(), Issue.created_at.asc())

    query = query.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).all()

    items: list[BacklogRiskIssueItem] = []
    for r in rows:
        c_dt = r.created_at
        if c_dt.tzinfo is None:
            c_dt = c_dt.replace(tzinfo=timezone.utc)
        age_secs = max(0.0, (now_utc - c_dt).total_seconds())
        age_hours = round(age_secs / 3600.0, 1)
        age_days = round(age_secs / 86400.0, 1)

        if c_dt >= cutoff_24h:
            bucket_key = "under_24h"
        elif c_dt >= cutoff_72h:
            bucket_key = "days_1_to_3"
        elif c_dt >= cutoff_7d:
            bucket_key = "days_3_to_7"
        else:
            bucket_key = "over_7d"

        s_pts = (
            40.0
            if r.severity == Severity.BLOCKER
            else 30.0
            if r.severity == Severity.CRITICAL
            else 20.0
            if r.severity == Severity.MAJOR
            else 10.0
        )
        a_pts = min(40.0, round(age_days * 2.5, 1))
        u_pts = 20.0 if r.assignee_id is None else 0.0
        score = round(s_pts + a_pts + u_pts, 1)

        level = (
            "CRITICAL"
            if score >= 70.0
            else "HIGH"
            if score >= 50.0
            else "MEDIUM"
            if score >= 30.0
            else "LOW"
        )

        items.append(
            BacklogRiskIssueItem(
                id=r.id,
                issue_key=r.issue_key,
                title=r.title,
                project_id=r.project_id,
                project_name=r.project_name,
                project_key=r.project_key,
                severity=r.severity,
                priority=r.priority,
                status=r.status,
                assignee_id=r.assignee_id,
                assignee_name=r.assignee_name,
                created_at=r.created_at,
                age_hours=age_hours,
                age_days=age_days,
                age_bucket=bucket_key,
                risk_score=score,
                risk_level=level,
            )
        )

    total_pages = max(1, (total_count + page_size - 1) // page_size) if total_count > 0 else 1

    return BacklogRiskIssuesResponse(
        items=items,
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )





