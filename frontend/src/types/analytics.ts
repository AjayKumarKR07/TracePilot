import type { Severity, IssueStatus } from './issue';

export interface SystemAnalyticsResponse {
  total_users: number;
  active_users: number;
  inactive_users: number;
  total_projects: number;
  active_projects: number;
  total_issues: number;
  open_issues: number;
  in_progress_issues: number;
  resolved_issues: number;
  closed_issues: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
}

export interface IssueStatusDistributionResponse {
  REPORTED: number;
  TRIAGED: number;
  ASSIGNED: number;
  IN_DEVELOPMENT: number;
  IN_REVIEW: number;
  IN_TESTING: number;
  RESOLVED: number;
  CLOSED: number;
  REOPENED: number;
}

export interface SeverityDistributionResponse {
  MINOR: number;
  MAJOR: number;
  CRITICAL: number;
  BLOCKER: number;
  total?: number;
  critical_blocker_total?: number;
  critical_blocker_pct?: number;
}

export interface PriorityDistributionResponse {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  URGENT: number;
}

export interface IssueTrendItem {
  date: string;
  created_count: number;
  resolved_count: number;
}

export interface IssueTrendResponse {
  interval: string;
  items: IssueTrendItem[];
  total_created: number;
  total_resolved: number;
}

export interface ProjectAnalyticsResponse {
  project_id: number;
  project_name: string;
  project_key: string;
  total_issues: number;
  open_issues: number;
  in_progress_issues: number;
  resolved_issues: number;
  closed_issues: number;
  critical_issues: number;
  resolution_rate: number;
  critical_blocker_open_issues?: number;
  resolved_closed_issues?: number;
  fix_rate?: number;
  avg_resolution_time_hours?: number | null;
  unassigned_issues?: number;
}

export interface ProjectAnalyticsListResponse {
  items: ProjectAnalyticsResponse[];
  total: number;
}

export interface DeveloperAnalyticsItem {
  developer_id: number;
  developer_name: string;
  developer_email: string;
  tester_id?: number;
  tester_name?: string;
  tester_email?: string;
  assigned_issues: number;
  resolved_issues: number;
  open_issues: number;
  critical_open_issues?: number;
  closed_issues?: number;
  reopened_issues?: number;
  total_completed_period?: number;
  workload_share_pct?: number;
  resolution_rate: number;
  average_resolution_time_hours: number | null;
}

export interface DeveloperAnalyticsResponse {
  items: DeveloperAnalyticsItem[];
  total: number;
  total_assigned_open?: number;
  total_critical_open?: number;
  total_unassigned_open?: number;
  total_unassigned_critical?: number;
  total_resolved_period?: number;
  total_closed_period?: number;
  team_avg_resolution_time_hours?: number | null;
  preset?: string | null;
  project_id?: number | null;
}

export interface AnalyticsReportDataResponse {
  system_overview: SystemAnalyticsResponse;
  status_distribution: IssueStatusDistributionResponse;
  severity_distribution: SeverityDistributionResponse;
  priority_distribution: PriorityDistributionResponse;
  trends: IssueTrendResponse;
  project_analytics: ProjectAnalyticsResponse[];
  developer_performance: DeveloperAnalyticsItem[];
  generated_at: string;
}

// -------------------------------------------------------------------------- //
// Quality Metrics — Milestone 2
// -------------------------------------------------------------------------- //

export interface QualityMetricsResponse {
  fix_rate: number;
  mttr_hours: number | null;
  defect_leakage_rate: number;
  backlog_health_score: number;
  open_critical_count: number;
  avg_age_open_days: number;
  total_issues?: number;
}

// -------------------------------------------------------------------------- //
// Smart Features — Milestone 3 (Mentor formula)
// -------------------------------------------------------------------------- //

// Priority Calculator — mentor formula: severity_weight × category_urgency_weight
export interface PriorityCalcRequest {
  severity: string;   // CRITICAL | MAJOR | MINOR | TRIVIAL
  category: string;   // Security | Database | API | Backend | UI | Colors | Typo
}

export interface PriorityCalcResponse {
  priority_score: number;
  priority: string;
  severity_weight: number;
  category_urgency_weight: number;
  explanation: string;
  // Legacy fields for backward compat
  recommended_priority: string;
  score: number;
  reasoning: string[];
  confidence: string;
}

// Developer Matcher — mentor spec
export interface DeveloperSuggestion {
  tester_id?: number;
  tester_name?: string;
  developer_id: number;
  developer_name: string;
  email: string;
  role: string;
  match_percentage: number;
  matched_skills: string[];
  active_task_count: number;
  explanation: string;
  // Legacy fields
  user_id: number;
  full_name: string;
  open_issues: number;
  resolved_issues: number;
  resolution_rate: number;
  average_resolution_time_hours: number | null;
  match_score: number;
  reasons: string[];
}

export interface DeveloperMatchResponse {
  issue_id: number;
  issue_key: string;
  suggestions: DeveloperSuggestion[];
}

// Plotly chart data
export interface PlotlyChartsData {
  defect_trends: {
    dates: string[];
    created: number[];
    resolved: number[];
  };
  severity_distribution: Record<string, number>;
  workflow_pipeline: Record<string, number>;
}

// -------------------------------------------------------------------------- //
// Defect Trends & Quality History — Feature 01
// -------------------------------------------------------------------------- //

export interface DefectTrendPoint {
  date: string;
  reported_count: number;
  resolved_count: number;
  closed_count: number;
  net_change: number;
  cumulative_net: number;
}

export interface PeriodComparison {
  current_reported: number;
  previous_reported: number;
  reported_pct_change: number | null;

  current_resolved: number;
  previous_resolved: number;
  resolved_pct_change: number | null;

  current_closed: number;
  previous_closed: number;
  closed_pct_change: number | null;

  opening_backlog: number;
  closing_backlog: number;
  prev_opening_backlog: number;
  prev_closing_backlog: number;

  current_net_backlog: number;
  previous_net_backlog: number;
  net_backlog_pct_change: number | null;

  start_date: string;
  end_date: string;
  prev_start_date: string;
  prev_end_date: string;
}

export interface DefectStatusTrend {
  open: number;
  resolved: number;
  closed: number;
  reopened: number;
  total: number;
}

export interface DefectTrendsHistoryResponse {
  range_preset: string;
  start_date: string;
  end_date: string;
  opening_backlog: number;
  closing_backlog: number;
  total_reported: number;
  total_resolved: number;
  total_closed: number;
  net_backlog_change: number;
  comparison: PeriodComparison;
  timeline: DefectTrendPoint[];
  status_trend: DefectStatusTrend;
}

// -------------------------------------------------------------------------- //
// Backlog Aging & Risk Analysis — Feature 03
// -------------------------------------------------------------------------- //

export interface OldestUnresolvedBacklogIssue {
  id: number;
  issue_key: string;
  title: string;
  project_id: number;
  project_name: string;
  project_key: string;
  severity: Severity;
  status: IssueStatus;
  created_at: string;
  age_days: number;
  assignee_name?: string | null;
}

export interface BacklogAgingBucketItem {
  bucket_key: 'under_24h' | 'days_1_to_3' | 'days_3_to_7' | 'over_7d';
  label: string;
  boundary_desc: string;
  total_issues: number;
  critical_blocker_count: number;
  unassigned_count: number;
  percentage: number;
}

export interface BacklogRiskSummary {
  total_unresolved: number;
  critical_blocker_unresolved: number;
  unassigned_unresolved: number;
  issues_older_than_7d: number;
  critical_blocker_older_than_24h: number;
  oldest_unresolved?: OldestUnresolvedBacklogIssue | null;
}

export interface BacklogAgingDistributionResponse {
  summary: BacklogRiskSummary;
  buckets: BacklogAgingBucketItem[];
}

export interface BacklogRiskIssueItem {
  id: number;
  issue_key: string;
  title: string;
  project_id: number;
  project_name: string;
  project_key: string;
  severity: Severity;
  priority: string;
  status: IssueStatus;
  assignee_id?: number | null;
  assignee_name?: string | null;
  created_at: string;
  age_hours: number;
  age_days: number;
  age_bucket: 'under_24h' | 'days_1_to_3' | 'days_3_to_7' | 'over_7d';
  risk_score: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface BacklogRiskIssuesResponse {
  items: BacklogRiskIssueItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface BacklogRiskFilters {
  projectId?: number | null;
  severity?: Severity | null;
  isAssigned?: boolean | null;
  ageBucket?: 'under_24h' | 'days_1_to_3' | 'days_3_to_7' | 'over_7d' | null;
  sortBy?: 'risk_score' | 'age' | 'severity';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  includeTest?: boolean;
}


