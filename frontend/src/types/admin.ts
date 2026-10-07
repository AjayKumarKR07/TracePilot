export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  developers?: number;
  testers: number;
  users: number;
  verified: number;
  unverified: number;
}

export interface InactiveAssigneeItem {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  assigned_issues_count: number;
}

export interface InactiveAssigneeList {
  items: InactiveAssigneeItem[];
}

export interface ProjectStats {
  total: number;
  active: number;
  inactive: number;
}

export interface IssueStatusStats {
  total: number;
  reported: number;
  triaged: number;
  assigned: number;
  in_development: number;
  in_review: number;
  in_testing: number;
  resolved: number;
  closed: number;
  reopened: number;
  unresolved: number;
}

export interface IssueSeverityStats {
  minor: number;
  major: number;
  critical: number;
  blocker: number;
}

export interface IssuePriorityStats {
  low: number;
  medium: number;
  high: number;
  urgent: number;
}

export interface RecentActivity {
  recently_created: number;
  recently_resolved: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
}

export interface ContentStats {
  total_comments: number;
  total_attachments: number;
  total_notifications: number;
  unread_notifications: number;
}

export interface SprintStats {
  total: number;
  planned: number;
  active: number;
  in_progress: number;
  ready_for_approval: number;
  completed: number;
  archived: number;
}

export interface BacklogStats {
  total: number;
  unassigned: number;
  critical: number;
  high_priority: number;
  resolved: number;
  closed: number;
  kaggle_count: number;
}

export interface AdminDashboardResponse {
  users: UserStats;
  projects: ProjectStats;
  issues: IssueStatusStats;
  severity: IssueSeverityStats;
  priority: IssuePriorityStats;
  recent: RecentActivity;
  notifications: NotificationStats;
  content: ContentStats;
  sprints: SprintStats;
  backlog: BacklogStats;
}

export interface OldestUnresolvedIssue {
  id: number;
  issue_key: string;
  title: string;
  created_at: string;
  age_days: number;
  severity: string;
  priority: string;
  status: string;
}

export interface IssueAgingResponse {
  total_unresolved: number;
  under_24h: number;
  hours_24_to_72: number;
  days_3_to_7: number;
  over_7d: number;
  oldest_unresolved: OldestUnresolvedIssue | null;
  critical_blocker_over_24h: number;
  unassigned_over_7d: number;
  reopened_over_24h: number;
}

