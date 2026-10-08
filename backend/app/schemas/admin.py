"""
Pydantic schemas for Admin dashboard statistics — Phase 6.

All fields are integer counts derived from pure SQL aggregation queries.
No user secrets or sensitive data are present in these schemas.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class InactiveAssigneeItem(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    assigned_issues_count: int
    
    model_config = ConfigDict(from_attributes=True)


class InactiveAssigneeList(BaseModel):
    items: list[InactiveAssigneeItem]


class UserStats(BaseModel):
    total: int
    active: int
    inactive: int
    admins: int
    developers: int = 0
    testers: int
    users: int          # USER role (issue reporters)
    verified: int
    unverified: int


class ProjectStats(BaseModel):
    total: int
    active: int
    inactive: int


class IssueStatusStats(BaseModel):
    total: int
    reported: int
    triaged: int
    assigned: int
    in_development: int
    in_review: int
    in_testing: int
    resolved: int
    closed: int
    reopened: int
    unresolved: int  # total - resolved - closed


class IssueSeverityStats(BaseModel):
    minor: int
    major: int
    critical: int
    blocker: int


class IssuePriorityStats(BaseModel):
    low: int
    medium: int
    high: int
    urgent: int


class RecentActivity(BaseModel):
    """Issues created or resolved in the last 7 days."""
    recently_created: int
    recently_resolved: int


class NotificationStats(BaseModel):
    """Notification metrics."""
    total: int
    unread: int


class ContentStats(BaseModel):
    """System content and activity metrics."""
    total_comments: int
    total_attachments: int
    total_notifications: int
    unread_notifications: int


class SprintStats(BaseModel):
    """System sprint metrics."""
    total: int
    planned: int
    active: int
    in_progress: int
    ready_for_approval: int
    completed: int
    archived: int


class BacklogStats(BaseModel):
    """Defect backlog metrics."""
    total: int
    unassigned: int
    critical: int
    high_priority: int
    resolved: int
    closed: int
    kaggle_count: int


class DashboardResponse(BaseModel):
    """Complete admin dashboard statistics snapshot.

    All values are real-time SQL aggregations — no stale cache.
    """
    users: UserStats
    projects: ProjectStats
    issues: IssueStatusStats
    severity: IssueSeverityStats
    priority: IssuePriorityStats
    recent: RecentActivity
    notifications: NotificationStats
    content: ContentStats
    sprints: SprintStats
    backlog: BacklogStats


class OldestUnresolvedIssue(BaseModel):
    """Details of the single oldest unresolved defect in the system."""
    id: int
    issue_key: str
    title: str
    created_at: datetime
    age_days: float
    severity: str
    priority: str
    status: str

    model_config = ConfigDict(from_attributes=True)


class IssueAgingResponse(BaseModel):
    """System-wide issue aging operational metrics for Admin.

    All age buckets and attention counts are derived from real created_at / updated_at
    timestamps on active unresolved issues.
    """
    total_unresolved: int
    under_24h: int
    hours_24_to_72: int
    days_3_to_7: int
    over_7d: int
    oldest_unresolved: Optional[OldestUnresolvedIssue] = None
    critical_blocker_over_24h: int
    unassigned_over_7d: int
    reopened_over_24h: int


class AppHealthInfo(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    debug: bool
    api_prefix: str


class DatabaseHealthInfo(BaseModel):
    status: str
    connected: bool
    driver: str
    database_name: str
    host: str
    port: int
    latency_ms: Optional[float] = None
    pool_size: Optional[int] = None
    checked_at: datetime


class WebSocketHealthInfo(BaseModel):
    status: str
    active_users: int
    total_connections: int
    service: str


class AIHealthInfo(BaseModel):
    status: str
    ai_enabled: bool
    provider: str
    primary_model: str
    fallback_model: Optional[str] = None
    api_key_configured: bool
    model_verified: Optional[bool] = None


class AuthHealthInfo(BaseModel):
    status: str
    jwt_algorithm: str
    token_expire_minutes: int
    secret_configured: bool


class BackgroundServiceItem(BaseModel):
    name: str
    status: str
    description: str


class SystemHealthResponse(BaseModel):
    overall_status: str
    timestamp: datetime
    application: AppHealthInfo
    database: DatabaseHealthInfo
    websocket: WebSocketHealthInfo
    ai: AIHealthInfo
    auth: AuthHealthInfo
    background_services: list[BackgroundServiceItem]

