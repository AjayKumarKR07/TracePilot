"""
Pydantic schemas for Analytics, Reporting & Dashboards — Phase 9.

All metrics are calculated via PostgreSQL aggregations.
No sensitive data (passwords, tokens, OTPs) is exposed.
"""

from pydantic import BaseModel, ConfigDict


# --------------------------------------------------------------------------- #
# System Overview Schema (Admin only)                                          #
# --------------------------------------------------------------------------- #

class SystemAnalyticsResponse(BaseModel):
    """Global system metrics across users, projects, issues, and severities."""

    total_users: int
    active_users: int
    inactive_users: int
    total_projects: int
    active_projects: int
    total_issues: int
    open_issues: int
    in_progress_issues: int
    resolved_issues: int
    closed_issues: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Distribution Schemas                                                         #
# --------------------------------------------------------------------------- #

class IssueStatusDistributionResponse(BaseModel):
    """Issue counts keyed by IssueStatus enum values."""

    REPORTED: int = 0
    TRIAGED: int = 0
    ASSIGNED: int = 0
    IN_DEVELOPMENT: int = 0
    IN_REVIEW: int = 0
    IN_TESTING: int = 0
    RESOLVED: int = 0
    CLOSED: int = 0
    REOPENED: int = 0

    model_config = ConfigDict(from_attributes=True)


class SeverityDistributionResponse(BaseModel):
    """Issue counts keyed by Severity enum values."""

    MINOR: int = 0
    MAJOR: int = 0
    CRITICAL: int = 0
    BLOCKER: int = 0

    model_config = ConfigDict(from_attributes=True)


class PriorityDistributionResponse(BaseModel):
    """Issue counts keyed by Priority enum values."""

    LOW: int = 0
    MEDIUM: int = 0
    HIGH: int = 0
    URGENT: int = 0

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Trends Schemas                                                               #
# --------------------------------------------------------------------------- #

class IssueTrendItem(BaseModel):
    """Aggregated issue creation and resolution count for a specific date period."""

    date: str
    created_count: int
    resolved_count: int

    model_config = ConfigDict(from_attributes=True)


class IssueTrendResponse(BaseModel):
    """Time-series defect creation and resolution trends."""

    interval: str
    items: list[IssueTrendItem]
    total_created: int
    total_resolved: int

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Project Analytics Schemas                                                    #
# --------------------------------------------------------------------------- #

class ProjectAnalyticsResponse(BaseModel):
    """Aggregated issue metrics and resolution rate for a single project."""

    project_id: int
    project_name: str
    project_key: str
    total_issues: int
    open_issues: int
    in_progress_issues: int
    resolved_issues: int
    closed_issues: int
    critical_issues: int
    resolution_rate: float

    model_config = ConfigDict(from_attributes=True)


class ProjectAnalyticsListResponse(BaseModel):
    """List of project analytics items visible to the requester."""

    items: list[ProjectAnalyticsResponse]
    total: int

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Developer Performance Schemas (Admin only)                                   #
# --------------------------------------------------------------------------- #

class DeveloperAnalyticsItem(BaseModel):
    """Performance metrics for an individual tester (legacy schema name preserved for client compatibility)."""

    developer_id: int
    developer_name: str
    developer_email: str
    assigned_issues: int
    resolved_issues: int
    open_issues: int
    resolution_rate: float
    average_resolution_time_hours: float | None = None

    model_config = ConfigDict(from_attributes=True)


class DeveloperAnalyticsResponse(BaseModel):
    """Aggregated performance metrics across all developers in the system."""

    items: list[DeveloperAnalyticsItem]
    total: int

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Downloadable Report Schema (Admin only)                                      #
# --------------------------------------------------------------------------- #

class AnalyticsReportDataResponse(BaseModel):
    """Aggregated data for generating the downloadable analytics report."""

    system_overview: SystemAnalyticsResponse
    status_distribution: IssueStatusDistributionResponse
    severity_distribution: SeverityDistributionResponse
    priority_distribution: PriorityDistributionResponse
    trends: IssueTrendResponse
    project_analytics: list[ProjectAnalyticsResponse]
    developer_performance: list[DeveloperAnalyticsItem]
    generated_at: str

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Quality Metrics Schema (Milestone 2)                                         #
# --------------------------------------------------------------------------- #

class QualityMetricsResponse(BaseModel):
    """
    Computed quality KPIs for the system or a project.

    - fix_rate:             % of issues that have been resolved or closed
    - mttr_hours:           Mean Time To Resolve (hours); None if no resolved issues
    - defect_leakage_rate:  % of critical/blocker issues that were reopened after resolution
    - backlog_health_score: Composite score 0–100 (100 = healthy, 0 = critical backlog)
    - open_critical_count:  Number of CRITICAL or BLOCKER issues still open
    - avg_age_open_days:    Average age of currently open issues in days
    """

    fix_rate: float
    mttr_hours: float | None = None
    defect_leakage_rate: float
    backlog_health_score: float
    open_critical_count: int
    avg_age_open_days: float
    total_issues: int = 0

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Defect Trends & Quality History Schemas (Feature 01)                        #
# --------------------------------------------------------------------------- #

class DefectTrendPoint(BaseModel):
    """Daily data point for defect history time-series."""

    date: str
    reported_count: int = 0
    resolved_count: int = 0
    closed_count: int = 0
    net_change: int = 0
    cumulative_net: int = 0

    model_config = ConfigDict(from_attributes=True)


class PeriodComparison(BaseModel):
    """Comparison of current period against immediately preceding period of equal duration."""

    current_reported: int = 0
    previous_reported: int = 0
    reported_pct_change: float | None = None

    current_resolved: int = 0
    previous_resolved: int = 0
    resolved_pct_change: float | None = None

    current_closed: int = 0
    previous_closed: int = 0
    closed_pct_change: float | None = None

    opening_backlog: int = 0
    closing_backlog: int = 0
    prev_opening_backlog: int = 0
    prev_closing_backlog: int = 0

    current_net_backlog: int = 0
    previous_net_backlog: int = 0
    net_backlog_pct_change: float | None = None

    start_date: str
    end_date: str
    prev_start_date: str
    prev_end_date: str

    model_config = ConfigDict(from_attributes=True)


class DefectStatusTrend(BaseModel):
    """Status distribution breakdown for issues reported in the selected period."""

    open: int = 0
    resolved: int = 0
    closed: int = 0
    reopened: int = 0
    total: int = 0

    model_config = ConfigDict(from_attributes=True)


class DefectTrendsHistoryResponse(BaseModel):
    """Comprehensive defect trends and historical quality metrics response."""

    range_preset: str
    start_date: str
    end_date: str
    opening_backlog: int = 0
    closing_backlog: int = 0
    total_reported: int = 0
    total_resolved: int = 0
    total_closed: int = 0
    net_backlog_change: int = 0
    comparison: PeriodComparison
    timeline: list[DefectTrendPoint]
    status_trend: DefectStatusTrend

    model_config = ConfigDict(from_attributes=True)

