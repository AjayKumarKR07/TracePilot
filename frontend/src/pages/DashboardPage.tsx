import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  ArrowRight,
  BarChart3,
  Bell,
  Bug,
  CheckCheck,
  CheckCircle2,
  CircleAlert,
  Clock,
  Eye,
  FileDown,
  HeartPulse,
  History,
  MessageSquare,
  PieChart,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { analyticsApi } from '../api/analytics';
import { getApiErrorMessage } from '../api/client';
import { issuesApi } from '../api/issues';
import { notificationsApi } from '../api/notifications';
import { projectsApi } from '../api/projects';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import type {
  IssueStatusDistributionResponse,
  PriorityDistributionResponse,
  ProjectAnalyticsResponse,
  SeverityDistributionResponse,
} from '../types/analytics';
import type { AuditLogItem } from '../types/audit';
import type { Issue, IssueStatus, Priority, Severity } from '../types/issue';
import type { NotificationItem } from '../types/notification';
import type { Project } from '../types/project';
import { formatDate, formatRelativeTime } from '../utils/formatters';
import { generateAnalyticsPdfReport } from '../utils/pdfGenerator';
import { AIChatbot } from '../components/ai/AIChatbot';

// ─────────────────────────────────────────────────────────────────────────────
// Active open statuses (excluding RESOLVED and CLOSED)
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVE_OPEN_STATUSES: IssueStatus[] = [
  'REPORTED',
  'TRIAGED',
  'ASSIGNED',
  'IN_DEVELOPMENT',
  'IN_REVIEW',
  'IN_TESTING',
  'REOPENED',
];

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card Component
// ─────────────────────────────────────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconClass: string;
  valueColor?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  iconClass,
  valueColor,
  subtitle,
  badge,
  badgeColor,
  onClick,
}) => (
  <div
    className="metric-card"
    onClick={onClick}
    style={onClick ? { cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' } : undefined}
  >
    <div className="metric-info" style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
        <span className="metric-label">{label}</span>
        {badge && (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.12rem 0.45rem',
              borderRadius: '999px',
              backgroundColor: badgeColor || 'rgba(99,102,241,0.2)',
              color: badgeColor ? '#fff' : '#818cf8',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <span className="metric-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
      {subtitle && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
          {subtitle}
        </span>
      )}
    </div>
    <div className={`metric-icon-box ${iconClass}`}>{icon}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { notifications: liveNotifications } = useNotifications();

  // ── Real Data State from PostgreSQL ──
  const [userIssues, setUserIssues] = useState<Issue[]>([]);
  const [totalIssueCount, setTotalIssueCount] = useState<number>(0);
  const [statusDist, setStatusDist] = useState<IssueStatusDistributionResponse | null>(null);
  const [severityDist, setSeverityDist] = useState<SeverityDistributionResponse | null>(null);
  const [priorityDist, setPriorityDist] = useState<PriorityDistributionResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectAnalytics, setProjectAnalytics] = useState<ProjectAnalyticsResponse[]>([]);

  // ── UI / Loading State ──
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState<boolean>(false);

  // ── Reopen Modal State ──
  const [reopenModalIssue, setReopenModalIssue] = useState<Issue | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');

  // ── Filter & Search State for My Recent Issues ──
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'ALL'>('ALL');

  // ── Timeline State (Feature 2) ──
  const [selectedTimelineIssueId, setSelectedTimelineIssueId] = useState<number | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<AuditLogItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // ── Activity Feed State (Feature 4) ──
  const [activityFeed, setActivityFeed] = useState<NotificationItem[]>([]);
  const [activityLoading, setActivityLoading] = useState<boolean>(false);

  // Project map for instant lookups
  const projectMap = useMemo(() => {
    const map = new Map<number, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  // ─────────────────────────────────────────────────────────────────
  // Data Loading (Live PostgreSQL Data)
  // ─────────────────────────────────────────────────────────────────
  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [issuesRes, distRes, sevRes, priRes, projsList, projAnalyticsRes] = await Promise.all([
        issuesApi.list({ page_size: 100 }),
        analyticsApi.getStatusDistribution().catch(() => null),
        analyticsApi.getSeverityDistribution().catch(() => null),
        analyticsApi.getPriorityDistribution().catch(() => null),
        projectsApi.list({ page_size: 100 }).catch(() => ({ items: [], total: 0 })),
        analyticsApi.getAllProjectsAnalytics().catch(() => ({ items: [], total: 0 })),
      ]);

      setUserIssues(issuesRes.items || []);
      setTotalIssueCount(issuesRes.total || 0);
      setStatusDist(distRes);
      setSeverityDist(sevRes);
      setPriorityDist(priRes);
      setProjects(projsList.items || []);
      setProjectAnalytics(projAnalyticsRes.items || []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Load activity feed (notifications) once on mount
  useEffect(() => {
    setActivityLoading(true);
    notificationsApi
      .list({ page_size: 20 })
      .then((res) => setActivityFeed(res.items || []))
      .catch(() => setActivityFeed([]))
      .finally(() => setActivityLoading(false));
  }, []);

  // Load timeline when selected issue changes
  useEffect(() => {
    if (selectedTimelineIssueId === null) return;
    setTimelineLoading(true);
    setTimelineError(null);
    issuesApi
      .getActivity(selectedTimelineIssueId)
      .then((events) => setTimelineEvents(events))
      .catch((err) => setTimelineError(getApiErrorMessage(err)))
      .finally(() => setTimelineLoading(false));
  }, [selectedTimelineIssueId]);

  // Auto-select the most recent issue for timeline on first load
  useEffect(() => {
    if (userIssues.length > 0 && selectedTimelineIssueId === null) {
      const sorted = [...userIssues].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setSelectedTimelineIssueId(sorted[0].id);
    }
  }, [userIssues, selectedTimelineIssueId]);

  // Real-Time auto-refresh on WebSocket notifications without polling
  const lastNotificationIdRef = useRef<number | null>(null);
  const latestNotificationId = liveNotifications[0]?.id;
  useEffect(() => {
    if (latestNotificationId) {
      if (lastNotificationIdRef.current !== null && lastNotificationIdRef.current !== latestNotificationId) {
        loadDashboardData(true);
      }
      lastNotificationIdRef.current = latestNotificationId;
    }
  }, [latestNotificationId, loadDashboardData]);

  // Realtime window listeners
  useEffect(() => {
    const handleRealtime = () => {
      loadDashboardData(true);
    };
    window.addEventListener('app:realtime_notification', handleRealtime);
    window.addEventListener('app:ws_reconnected', handleRealtime);
    return () => {
      window.removeEventListener('app:realtime_notification', handleRealtime);
      window.removeEventListener('app:ws_reconnected', handleRealtime);
    };
  }, [loadDashboardData]);

  // ─────────────────────────────────────────────────────────────────
  // Status Counts & Core Metrics (Calculated from real backend data)
  // ─────────────────────────────────────────────────────────────────
  const awaitingReviewCount = statusDist
    ? (statusDist.REPORTED || 0) + (statusDist.TRIAGED || 0)
    : userIssues.filter((i) => i.status === 'REPORTED' || i.status === 'TRIAGED').length;

  const assignedToTesterCount = statusDist
    ? statusDist.ASSIGNED || 0
    : userIssues.filter((i) => i.status === 'ASSIGNED').length;

  const inProgressCount = statusDist
    ? (statusDist.IN_DEVELOPMENT || 0) +
      (statusDist.IN_REVIEW || 0) +
      (statusDist.IN_TESTING || 0)
    : userIssues.filter(
        (i) =>
          i.status === 'IN_DEVELOPMENT' ||
          i.status === 'IN_REVIEW' ||
          i.status === 'IN_TESTING'
      ).length;

  const resolvedCount = statusDist
    ? statusDist.RESOLVED || 0
    : userIssues.filter((i) => i.status === 'RESOLVED').length;

  const closedCount = statusDist
    ? statusDist.CLOSED || 0
    : userIssues.filter((i) => i.status === 'CLOSED').length;

  const reopenedCount = statusDist
    ? statusDist.REOPENED || 0
    : userIssues.filter((i) => i.status === 'REOPENED').length;

  // Open Issues: Calculated strictly from actual active statuses returned by backend, excluding RESOLVED and CLOSED
  const openIssuesCount = useMemo(() => {
    if (statusDist) {
      return (
        (statusDist.REPORTED || 0) +
        (statusDist.TRIAGED || 0) +
        (statusDist.ASSIGNED || 0) +
        (statusDist.IN_DEVELOPMENT || 0) +
        (statusDist.IN_REVIEW || 0) +
        (statusDist.IN_TESTING || 0) +
        (statusDist.REOPENED || 0)
      );
    }
    return userIssues.filter((i) => ACTIVE_OPEN_STATUSES.includes(i.status)).length;
  }, [statusDist, userIssues]);

  // Resolution Rate = ((resolved + closed) / total) * 100
  const resolutionRate =
    totalIssueCount > 0
      ? Math.round(((resolvedCount + closedCount) / totalIssueCount) * 100)
      : 0;

  // ─────────────────────────────────────────────────────────────────
  // Action Required Issues (Resolved awaiting confirmation or Reopened)
  // ─────────────────────────────────────────────────────────────────
  const actionRequiredIssues = useMemo(() => {
    return userIssues.filter((iss) => iss.status === 'RESOLVED' || iss.status === 'REOPENED');
  }, [userIssues]);

  // ─────────────────────────────────────────────────────────────────
  // Quick Actions: Confirm Resolution & Reopen
  // ─────────────────────────────────────────────────────────────────
  const handleConfirmClose = async (issueId: number) => {
    setIsActionSubmitting(true);
    setActionErrorMsg(null);
    try {
      await issuesApi.close(issueId);
      setActionSuccessMsg('Issue verified and closed successfully!');
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadDashboardData(true);
    } catch (err: unknown) {
      setActionErrorMsg('Failed to confirm resolution: ' + getApiErrorMessage(err));
      setTimeout(() => setActionErrorMsg(null), 5000);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenModalIssue) return;
    if (!reopenReason.trim()) {
      setActionErrorMsg('A reason is required to reopen the defect.');
      return;
    }
    setIsActionSubmitting(true);
    setActionErrorMsg(null);
    try {
      await issuesApi.reopen(reopenModalIssue.id, { reason: reopenReason.trim() });
      const key = reopenModalIssue.issue_key;
      setReopenModalIssue(null);
      setReopenReason('');
      setActionSuccessMsg(`Issue ${key} has been reopened for renewed testing.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadDashboardData(true);
    } catch (err: unknown) {
      setActionErrorMsg('Failed to reopen issue: ' + getApiErrorMessage(err));
      setTimeout(() => setActionErrorMsg(null), 5000);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Filtered Recent Issues
  // ─────────────────────────────────────────────────────────────────
  const filteredIssues = useMemo(() => {
    return userIssues.filter((issue) => {
      // Status filter
      if (statusFilter !== 'ALL' && issue.status !== statusFilter) return false;
      // Severity filter
      if (severityFilter !== 'ALL' && issue.severity !== severityFilter) return false;
      // Priority filter
      if (priorityFilter !== 'ALL' && issue.priority !== priorityFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchKey = issue.issue_key.toLowerCase().includes(q);
        const matchTitle = issue.title.toLowerCase().includes(q);
        const matchProj = (projectMap.get(issue.project_id)?.name || '').toLowerCase().includes(q);
        return matchKey || matchTitle || matchProj;
      }
      return true;
    });
  }, [userIssues, statusFilter, severityFilter, priorityFilter, searchQuery, projectMap]);

  // Recent issues sorted by creation/update descending
  const recentIssuesList = useMemo(() => {
    return [...filteredIssues].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filteredIssues]);

  // ─────────────────────────────────────────────────────────────────
  // Personal Issue Aging (User-Specific Open Issues in 5 Buckets)
  // ─────────────────────────────────────────────────────────────────
  const agingStats = useMemo(() => {
    const openList = userIssues.filter((i) => ACTIVE_OPEN_STATUSES.includes(i.status));
    const now = Date.now();
    const buckets = {
      today: 0,
      days1to3: 0,
      days4to7: 0,
      days8to14: 0,
      days15plus: 0,
    };

    openList.forEach((iss) => {
      const created = new Date(iss.created_at).getTime();
      const ageHours = (now - created) / (1000 * 60 * 60);

      if (ageHours < 24) buckets.today++;
      else if (ageHours < 72) buckets.days1to3++;
      else if (ageHours < 168) buckets.days4to7++;
      else if (ageHours < 336) buckets.days8to14++;
      else buckets.days15plus++;
    });

    const totalOpen = openList.length;
    return {
      totalOpen,
      buckets: [
        { label: 'Today (<24h)', count: buckets.today, pct: totalOpen ? Math.round((buckets.today / totalOpen) * 100) : 0, color: '#34d399' },
        { label: '1–3 Days', count: buckets.days1to3, pct: totalOpen ? Math.round((buckets.days1to3 / totalOpen) * 100) : 0, color: '#818cf8' },
        { label: '4–7 Days', count: buckets.days4to7, pct: totalOpen ? Math.round((buckets.days4to7 / totalOpen) * 100) : 0, color: '#fbbf24' },
        { label: '8–14 Days', count: buckets.days8to14, pct: totalOpen ? Math.round((buckets.days8to14 / totalOpen) * 100) : 0, color: '#fb923c' },
        { label: '15+ Days', count: buckets.days15plus, pct: totalOpen ? Math.round((buckets.days15plus / totalOpen) * 100) : 0, color: '#f87171' },
      ],
    };
  }, [userIssues]);

  // ─────────────────────────────────────────────────────────────────
  // Issue Health Categories (Feature 1)
  // ─────────────────────────────────────────────────────────────────
  const issueHealthCategories = useMemo(() => {
    const now = Date.now();
    const critical: Issue[] = [];
    const attention: Issue[] = [];
    const healthy: Issue[] = [];

    userIssues.forEach((issue) => {
      const isOpen = ACTIVE_OPEN_STATUSES.includes(issue.status);
      const ageMs = now - new Date(issue.updated_at || issue.created_at).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const isCriticalSeverity = issue.severity === 'CRITICAL' || issue.severity === 'BLOCKER';
      const isUrgentPriority = issue.priority === 'URGENT';
      const isReopened = issue.status === 'REOPENED';

      if (!isOpen && issue.status !== 'REOPENED') {
        // Resolved / Closed — healthy
        healthy.push(issue);
        return;
      }

      // CRITICAL: blocker/critical severity open, OR reopened, OR stuck >14 days
      if (
        (isOpen && isCriticalSeverity) ||
        isReopened ||
        (isOpen && ageDays > 14)
      ) {
        critical.push(issue);
        return;
      }

      // ATTENTION: urgent priority open, OR stuck >7 days
      if ((isOpen && isUrgentPriority) || (isOpen && ageDays > 7)) {
        attention.push(issue);
        return;
      }

      // HEALTHY: open but progressing normally
      healthy.push(issue);
    });

    const total = userIssues.length;
    let overallStatus: 'HEALTHY' | 'ATTENTION NEEDED' | 'CRITICAL' = 'HEALTHY';
    let overallColor = '#34d399';
    if (critical.length > 0) {
      overallStatus = 'CRITICAL';
      overallColor = '#ef4444';
    } else if (attention.length > 0) {
      overallStatus = 'ATTENTION NEEDED';
      overallColor = '#f59e0b';
    }

    return { critical, attention, healthy, total, overallStatus, overallColor };
  }, [userIssues]);

  // ─────────────────────────────────────────────────────────────────
  // Average Resolution Time (Feature 3)
  // ─────────────────────────────────────────────────────────────────
  const avgResolutionDays = useMemo(() => {
    const resolved = userIssues.filter(
      (i) => (i.status === 'RESOLVED' || i.status === 'CLOSED') && i.updated_at && i.created_at
    );
    if (resolved.length === 0) return null;
    const totalMs = resolved.reduce((sum, i) => {
      return sum + (new Date(i.updated_at).getTime() - new Date(i.created_at).getTime());
    }, 0);
    const avgMs = totalMs / resolved.length;
    return Math.round(avgMs / (1000 * 60 * 60 * 24));
  }, [userIssues]);

  // ─────────────────────────────────────────────────────────────────
  // Personal Issue Health Score (User-Specific Metric)
  // ─────────────────────────────────────────────────────────────────
  const healthScoreInfo = useMemo(() => {
    if (totalIssueCount === 0) {
      return {
        score: 100,
        status: 'Optimal',
        color: '#34d399',
        reasons: ['No reported defects currently open.', 'All defect workflows in healthy state.'],
      };
    }

    let score = 100;
    const reasons: string[] = [];

    // -15 for each open critical/blocker issue reported by this user
    const openCritical = userIssues.filter(
      (i) => ACTIVE_OPEN_STATUSES.includes(i.status) && (i.severity === 'CRITICAL' || i.severity === 'BLOCKER')
    ).length;
    if (openCritical > 0) {
      score -= openCritical * 15;
      reasons.push(`${openCritical} open Critical/Blocker defect${openCritical > 1 ? 's' : ''} (-${openCritical * 15})`);
    }

    // -10 for each open urgent issue reported by this user
    const openUrgent = userIssues.filter(
      (i) => ACTIVE_OPEN_STATUSES.includes(i.status) && i.priority === 'URGENT'
    ).length;
    if (openUrgent > 0) {
      score -= openUrgent * 10;
      reasons.push(`${openUrgent} open Urgent priority defect${openUrgent > 1 ? 's' : ''} (-${openUrgent * 10})`);
    }

    // -5 for each issue older than 7 days
    const agingCount = (agingStats.buckets[3]?.count || 0) + (agingStats.buckets[4]?.count || 0);
    if (agingCount > 0) {
      score -= agingCount * 5;
      reasons.push(`${agingCount} defect${agingCount > 1 ? 's' : ''} open >7 days (-${agingCount * 5})`);
    }

    // +10 if resolution rate is 75% or higher
    if (resolutionRate >= 75) {
      score += 10;
      reasons.push(`High resolution rate (${resolutionRate}%) (+10)`);
    }

    const clampedScore = Math.max(0, Math.min(100, score));
    let statusLabel = 'Optimal';
    let statusColor = '#34d399';

    if (clampedScore < 50) {
      statusLabel = 'Needs Attention';
      statusColor = '#ef4444';
    } else if (clampedScore < 75) {
      statusLabel = 'Moderate';
      statusColor = '#f59e0b';
    } else if (clampedScore < 90) {
      statusLabel = 'Good';
      statusColor = '#6366f1';
    }

    if (reasons.length === 0) {
      reasons.push(`${resolvedCount + closedCount} of ${totalIssueCount} defects resolved (${resolutionRate}%)`);
    }

    return {
      score: clampedScore,
      status: statusLabel,
      color: statusColor,
      reasons,
    };
  }, [totalIssueCount, userIssues, agingStats, resolutionRate, resolvedCount, closedCount]);

  // Export PDF Handler
  const handleExportPdf = () => {
    generateAnalyticsPdfReport({
      user,
      statusDist,
      severityDist,
      priorityDist,
      projectAnalytics,
    });
  };

  // ─────────────────────────────────────────────────────────────────
  // Loading & Error States
  // ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: '3.5rem 0', display: 'flex', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading your personal dashboard..." />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => loadDashboardData()} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2.5rem' }}>
      {/* ── Toast Alerts ── */}
      {actionSuccessMsg && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', padding: 0 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{actionErrorMsg}</span>
          </div>
          <button
            onClick={() => setActionErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── TOP HEADER / WELCOME AREA ── */}
      <div
        className="card"
        style={{
          background:
            'linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(168, 85, 247, 0.08) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                marginBottom: '0.4rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                className="badge"
                style={{
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  fontWeight: '600',
                  fontSize: '0.75rem',
                }}
              >
                <Sparkles size={13} /> USER PORTAL
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {user?.email}
              </span>
            </div>

            <h1
              style={{
                fontSize: '1.65rem',
                fontWeight: '700',
                color: '#fff',
                margin: '0 0 0.35rem 0',
              }}
            >
              Welcome back, {user?.full_name}!
            </h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              Track your reported defects and respond to verification requests.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => loadDashboardData(true)}
              className="btn btn-secondary btn-sm"
              disabled={isRefreshing}
              title="Refresh Dashboard"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="btn btn-secondary btn-sm"
              disabled={userIssues.length === 0}
              title="Download Personal PDF Report"
            >
              <FileDown size={14} />
              <span>Export PDF</span>
            </button>

            <Link to="/create-issue" className="btn btn-primary btn-sm">
              <PlusCircle size={15} />
              <span>Create New Issue</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 1. ACTION REQUIRED SECTION (Top priority) ── */}
      {actionRequiredIssues.length > 0 ? (
        <section
          className="card"
          style={{
            border: '1px solid rgba(245, 158, 11, 0.4)',
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            padding: '1.25rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="#f59e0b" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Action Required ({actionRequiredIssues.length})
              </h2>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Defects waiting for your verification &amp; confirmation
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {actionRequiredIssues.map((issue) => (
              <div
                key={issue.id}
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <Link
                      to={`/issues/${issue.id}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700',
                        color: 'var(--primary)',
                        fontSize: '0.85rem',
                        textDecoration: 'none',
                      }}
                    >
                      {issue.issue_key}
                    </Link>
                    <StatusBadge status={issue.status} />
                  </div>

                  <h3
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      margin: '0 0 0.35rem 0',
                    }}
                  >
                    {issue.title}
                  </h3>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.35 }}>
                    {issue.status === 'RESOLVED'
                      ? 'The tester marked this defect resolved. Please verify the fix in your environment.'
                      : 'This defect was reopened and is awaiting renewed inspection.'}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    paddingTop: '0.55rem',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  {issue.status === 'RESOLVED' && (
                    <>
                      <button
                        onClick={() => handleConfirmClose(issue.id)}
                        disabled={isActionSubmitting}
                        className="btn btn-primary btn-sm"
                        style={{
                          backgroundColor: '#10b981',
                          borderColor: '#10b981',
                          flex: 1,
                          justifyContent: 'center',
                          fontSize: '0.78rem',
                        }}
                        title="Confirm fix is working and close defect"
                      >
                        <CheckCircle2 size={13} />
                        <span>Confirm Resolution</span>
                      </button>

                      <button
                        onClick={() => setReopenModalIssue(issue)}
                        disabled={isActionSubmitting}
                        className="btn btn-outline-danger btn-sm"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem' }}
                        title="Reopen defect if problem still persists"
                      >
                        <RotateCcw size={13} />
                        <span>Reopen Issue</span>
                      </button>
                    </>
                  )}

                  <Link
                    to={`/issues/${issue.id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'center', fontSize: '0.78rem' }}
                  >
                    <Eye size={13} />
                    <span>View Details</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section
          className="card"
          style={{
            border: '1px solid rgba(16, 185, 129, 0.25)',
            backgroundColor: 'rgba(16, 185, 129, 0.04)',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <CheckCircle2 size={20} color="#34d399" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#34d399', display: 'block' }}>
              You&apos;re all caught up!
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              None of your reported defects currently require your confirmation or follow-up.
            </span>
          </div>
        </section>
      )}

      {/* ── 2. LIVE KPI CARDS (Clean labels without numbers) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <MetricCard
          label="My Submitted Issues"
          value={totalIssueCount}
          icon={<Bug size={20} />}
          iconClass="metric-icon-purple"
          subtitle="Total defects reported by you"
          onClick={() => {
            const el = document.getElementById('my-recent-issues');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <MetricCard
          label="Open Issues"
          value={openIssuesCount}
          icon={<AlertCircle size={20} />}
          iconClass="metric-icon-amber"
          valueColor={openIssuesCount > 0 ? '#fbbf24' : undefined}
          subtitle="Active under investigation"
          badge={openIssuesCount > 0 ? 'Active' : undefined}
          badgeColor="#f59e0b"
          onClick={() => {
            setStatusFilter('ALL');
            const el = document.getElementById('my-recent-issues');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <MetricCard
          label="In Progress"
          value={inProgressCount}
          icon={<Activity size={20} />}
          iconClass="metric-icon-indigo"
          subtitle="Development &amp; QA testing"
          onClick={() => {
            setStatusFilter('IN_PROGRESS' as IssueStatus);
            const el = document.getElementById('my-recent-issues');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <MetricCard
          label="Resolved"
          value={resolvedCount}
          icon={<CheckCircle2 size={20} />}
          iconClass="metric-icon-emerald"
          valueColor={resolvedCount > 0 ? '#34d399' : undefined}
          subtitle="Awaiting your confirmation"
          badge={resolvedCount > 0 ? 'Needs You' : undefined}
          badgeColor="#10b981"
          onClick={() => {
            setStatusFilter('RESOLVED');
            const el = document.getElementById('my-recent-issues');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <MetricCard
          label="Resolution Rate"
          value={`${resolutionRate}%`}
          icon={<CheckCheck size={20} />}
          iconClass="metric-icon-cyan"
          valueColor={resolutionRate >= 75 ? '#34d399' : '#818cf8'}
          subtitle={`${resolvedCount + closedCount} of ${totalIssueCount} resolved`}
        />
      </div>

      {/* ── 3. MY RECENT ISSUES (Table with Search & Filter) ── */}
      <section
        id="my-recent-issues"
        className="card"
        style={{
          border: '1px solid rgba(99, 102, 241, 0.3)',
          padding: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Bug size={18} style={{ color: '#818cf8' }} />
            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              My Recent Issues
            </h2>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
              }}
            >
              {filteredIssues.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to="/create-issue" className="btn btn-primary btn-sm">
              <PlusCircle size={14} />
              <span>Create New Issue</span>
            </Link>

            <Link
              to="/issues"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#a5b4fc' }}
            >
              <span>View All My Issues</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Search & Dropdown Filter Controls */}
        <div
          style={{
            display: 'flex',
            gap: '0.65rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: '1rem',
            padding: '0.65rem',
            backgroundColor: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1', minWidth: '180px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.65rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search by key or title…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '2rem',
                paddingRight: '0.75rem',
                paddingTop: '0.35rem',
                paddingBottom: '0.35rem',
                fontSize: '0.82rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-muted)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IssueStatus | 'ALL')}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              minWidth: '130px',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="REPORTED">Reported</option>
            <option value="TRIAGED">Triaged</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_DEVELOPMENT">In Development</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="IN_TESTING">In Testing</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="REOPENED">Reopened</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as Severity | 'ALL')}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              minWidth: '120px',
            }}
          >
            <option value="ALL">All Severities</option>
            <option value="BLOCKER">Blocker</option>
            <option value="CRITICAL">Critical</option>
            <option value="MAJOR">Major</option>
            <option value="MINOR">Minor</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | 'ALL')}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              minWidth: '120px',
            }}
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {(searchQuery || statusFilter !== 'ALL' || severityFilter !== 'ALL' || priorityFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setSeverityFilter('ALL');
                setPriorityFilter('ALL');
              }}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem' }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* High-density Recent Issues Table */}
        {recentIssuesList.length === 0 ? (
          <div
            style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: '8px',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <Bug size={32} style={{ opacity: 0.35, marginBottom: '0.5rem', color: '#818cf8' }} />
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              {searchQuery || statusFilter !== 'ALL' || severityFilter !== 'ALL' || priorityFilter !== 'ALL'
                ? 'No defects match your active search and filter criteria.'
                : 'You have not submitted any defects yet.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Issue Key', 'Title', 'Project', 'Severity', 'Priority', 'Status', 'Last Updated', 'Action'].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: 'left',
                          padding: '0.5rem 0.75rem',
                          color: 'var(--text-muted)',
                          fontWeight: '600',
                          fontSize: '0.74rem',
                          borderBottom: '1px solid var(--border-subtle)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recentIssuesList.slice(0, 8).map((issue) => {
                  const isResolved = issue.status === 'RESOLVED';
                  const project = projectMap.get(issue.project_id);

                  return (
                    <tr
                      key={issue.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: isResolved ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                          'var(--bg-surface-hover)')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                          isResolved ? 'rgba(16, 185, 129, 0.03)' : 'transparent')
                      }
                    >
                      {/* Issue Key */}
                      <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/issues/${issue.id}`}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: '700',
                            color: 'var(--primary)',
                            fontSize: '0.82rem',
                            textDecoration: 'none',
                          }}
                        >
                          {issue.issue_key}
                        </Link>
                      </td>

                      {/* Title */}
                      <td
                        style={{
                          padding: '0.6rem 0.75rem',
                          maxWidth: '260px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Link
                          to={`/issues/${issue.id}`}
                          style={{
                            color: 'var(--text-primary)',
                            fontWeight: isResolved ? '600' : '500',
                            textDecoration: 'none',
                          }}
                          title={issue.title}
                        >
                          {issue.title}
                        </Link>
                      </td>

                      {/* Project */}
                      <td
                        style={{
                          padding: '0.6rem 0.75rem',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-secondary)',
                          fontSize: '0.78rem',
                        }}
                      >
                        {project?.name || project?.project_key || `Project #${issue.project_id}`}
                      </td>

                      {/* Severity */}
                      <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <SeverityBadge severity={issue.severity} />
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <PriorityBadge priority={issue.priority} />
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <StatusBadge status={issue.status} />
                      </td>

                      {/* Last Updated */}
                      <td
                        style={{
                          padding: '0.6rem 0.75rem',
                          color: 'var(--text-muted)',
                          fontSize: '0.76rem',
                          whiteSpace: 'nowrap',
                        }}
                        title={formatDate(issue.updated_at || issue.created_at)}
                      >
                        {formatRelativeTime(issue.updated_at || issue.created_at)}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {isResolved && (
                            <>
                              <button
                                onClick={() => handleConfirmClose(issue.id)}
                                disabled={isActionSubmitting}
                                className="btn btn-primary btn-sm"
                                style={{
                                  backgroundColor: '#10b981',
                                  borderColor: '#10b981',
                                  fontSize: '0.72rem',
                                  padding: '0.2rem 0.5rem',
                                }}
                                title="Confirm resolution"
                              >
                                <CheckCircle2 size={11} />
                                <span>Confirm</span>
                              </button>

                              <button
                                onClick={() => setReopenModalIssue(issue)}
                                disabled={isActionSubmitting}
                                className="btn btn-outline-danger btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                title="Reopen issue"
                              >
                                <RotateCcw size={11} />
                                <span>Reopen</span>
                              </button>
                            </>
                          )}

                          <Link
                            to={`/issues/${issue.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="View full issue details"
                          >
                            <Eye size={12} />
                            <span>View Issue</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {recentIssuesList.length > 8 && (
              <div
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <Link
                  to="/issues"
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--primary)',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <span>View all {recentIssuesList.length} issues in My Issues</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 4. MY ISSUE STATUS (Workflow Guide + 6-Status Grid) ── */}
      <section className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            My Issue Status
          </h2>
          {/* Visual Workflow Guide */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>Submitted</span>
            <span>→</span>
            <span style={{ color: '#818cf8', fontWeight: 600 }}>Review</span>
            <span>→</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Testing</span>
            <span>→</span>
            <span style={{ color: '#34d399', fontWeight: 600 }}>Resolved</span>
            <span>→</span>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>Closed</span>
          </div>
        </div>

        {/* 6-Status Metric Grid with Live Counts */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <div
            className="card"
            style={{ padding: '0.85rem 1rem', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => {
              setStatusFilter('REPORTED');
              document.getElementById('my-recent-issues')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Awaiting Review
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: '700', color: '#fbbf24' }}>
              {awaitingReviewCount}
            </span>
          </div>

          <div
            className="card"
            style={{ padding: '0.85rem 1rem', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => {
              setStatusFilter('ASSIGNED');
              document.getElementById('my-recent-issues')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Assigned to Tester
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: '700', color: '#818cf8' }}>
              {assignedToTesterCount}
            </span>
          </div>

          <div
            className="card"
            style={{ padding: '0.85rem 1rem', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => {
              setStatusFilter('IN_PROGRESS' as IssueStatus);
              document.getElementById('my-recent-issues')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              In Progress
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: '700', color: '#38bdf8' }}>
              {inProgressCount}
            </span>
          </div>

          <div
            className="card"
            style={{ padding: '0.85rem 1rem', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => {
              setStatusFilter('RESOLVED');
              document.getElementById('my-recent-issues')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Resolved
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: '700', color: '#34d399' }}>
              {resolvedCount}
            </span>
          </div>

          <div
            className="card"
            style={{ padding: '0.85rem 1rem', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => {
              setStatusFilter('CLOSED');
              document.getElementById('my-recent-issues')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Closed
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: '700', color: '#94a3b8' }}>
              {closedCount}
            </span>
          </div>

          <div
            className="card"
            style={{ padding: '0.85rem 1rem', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => {
              setStatusFilter('REOPENED');
              document.getElementById('my-recent-issues')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Reopened
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: '700', color: '#f87171' }}>
              {reopenedCount}
            </span>
          </div>
        </div>
      </section>

      {/* ── 5. PERSONAL ANALYTICS (Health Score, Aging, Distribution) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Personal Issue Health Score */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HeartPulse size={18} color={healthScoreInfo.color} />
                <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  🩺 My Issue Health Score
                </span>
              </div>
              <span
                className="badge"
                style={{ backgroundColor: `${healthScoreInfo.color}22`, color: healthScoreInfo.color, fontWeight: '700' }}
              >
                {healthScoreInfo.status}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: '800', color: healthScoreInfo.color, lineHeight: 1 }}>
                {healthScoreInfo.score}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: '600' }}>/ 100</span>
            </div>

            <div style={{ height: '8px', backgroundColor: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
              <div
                style={{
                  height: '100%',
                  width: `${healthScoreInfo.score}%`,
                  backgroundColor: healthScoreInfo.color,
                  borderRadius: '4px',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {healthScoreInfo.reasons.map((r, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.785rem', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: healthScoreInfo.color }} />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', margin: '1rem 0 0 0', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
            Personal defect health score based on your active defects and resolution progress.
          </p>
        </div>

        {/* Open Issue Aging Analysis */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="#818cf8" />
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                ⏳ Open Issue Aging
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {agingStats.totalOpen} Active Issues
            </span>
          </div>

          {agingStats.totalOpen === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <CheckCircle2 size={26} color="#34d399" style={{ margin: '0 auto 0.5rem' }} />
              <span>Zero open defects currently aging.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {agingStats.buckets.map((b) => (
                <div key={b.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.785rem', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{b.label}</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {b.count} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({b.pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${b.pct}%`, backgroundColor: b.color, borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Personal Distribution Overview */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <PieChart size={18} color="#818cf8" />
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Personal Distributions
              </span>
            </div>

            {totalIssueCount === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '1.5rem 0', textAlign: 'center' }}>
                No defect distributions recorded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Severity Breakdown */}
                <div>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                    Severity Distribution
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', textAlign: 'center' }}>
                    <div style={{ padding: '0.35rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      <span style={{ fontSize: '0.65rem', color: '#f87171', display: 'block' }}>BLOCKER</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f87171' }}>{severityDist?.BLOCKER || 0}</span>
                    </div>
                    <div style={{ padding: '0.35rem', backgroundColor: 'rgba(249, 115, 22, 0.1)', borderRadius: '4px', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                      <span style={{ fontSize: '0.65rem', color: '#fb923c', display: 'block' }}>CRITICAL</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fb923c' }}>{severityDist?.CRITICAL || 0}</span>
                    </div>
                    <div style={{ padding: '0.35rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                      <span style={{ fontSize: '0.65rem', color: '#facc15', display: 'block' }}>MAJOR</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#facc15' }}>{severityDist?.MAJOR || 0}</span>
                    </div>
                    <div style={{ padding: '0.35rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      <span style={{ fontSize: '0.65rem', color: '#60a5fa', display: 'block' }}>MINOR</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#60a5fa' }}>{severityDist?.MINOR || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Priority Breakdown */}
                <div>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                    Priority Distribution
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', textAlign: 'center' }}>
                    <div style={{ padding: '0.35rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      <span style={{ fontSize: '0.65rem', color: '#f87171', display: 'block' }}>URGENT</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f87171' }}>{priorityDist?.URGENT || 0}</span>
                    </div>
                    <div style={{ padding: '0.35rem', backgroundColor: 'rgba(249, 115, 22, 0.1)', borderRadius: '4px', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                      <span style={{ fontSize: '0.65rem', color: '#fb923c', display: 'block' }}>HIGH</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fb923c' }}>{priorityDist?.HIGH || 0}</span>
                    </div>
                    <div style={{ padding: '0.35rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                      <span style={{ fontSize: '0.65rem', color: '#facc15', display: 'block' }}>MEDIUM</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#facc15' }}>{priorityDist?.MEDIUM || 0}</span>
                    </div>
                    <div style={{ padding: '0.35rem', backgroundColor: 'rgba(148, 163, 184, 0.1)', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>LOW</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#94a3b8' }}>{priorityDist?.LOW || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── NEW FEATURE SECTIONS (2-column responsive grid)           ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* ── FEATURE 1: ISSUE HEALTH ── */}
        <section className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color={issueHealthCategories.overallColor} />
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Issue Health
              </span>
            </div>
            {totalIssueCount > 0 && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  backgroundColor: `${issueHealthCategories.overallColor}22`,
                  color: issueHealthCategories.overallColor,
                  border: `1px solid ${issueHealthCategories.overallColor}44`,
                }}
              >
                {issueHealthCategories.overallStatus}
              </span>
            )}
          </div>

          {totalIssueCount === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <ShieldCheck size={28} style={{ opacity: 0.3, marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
              No issue health data yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {[
                {
                  label: 'Healthy',
                  count: issueHealthCategories.healthy.length,
                  color: '#34d399',
                  icon: <CheckCircle2 size={15} />,
                  description: 'Resolved, closed, or progressing normally',
                  statusFilter: undefined as IssueStatus | undefined,
                },
                {
                  label: 'Attention Needed',
                  count: issueHealthCategories.attention.length,
                  color: '#f59e0b',
                  icon: <CircleAlert size={15} />,
                  description: 'Urgent priority or open >7 days',
                  statusFilter: undefined as IssueStatus | undefined,
                },
                {
                  label: 'Critical',
                  count: issueHealthCategories.critical.length,
                  color: '#ef4444',
                  icon: <AlertOctagon size={15} />,
                  description: 'Blocker/critical severity, reopened, or stuck >14 days',
                  statusFilter: 'REOPENED' as IssueStatus,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: `${row.color}11`,
                    border: `1px solid ${row.color}33`,
                    cursor: row.count > 0 ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (row.count > 0) {
                      if (row.statusFilter) setStatusFilter(row.statusFilter);
                      document.getElementById('my-recent-issues')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: row.color }}>{row.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {row.label}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.description}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '1.25rem', fontWeight: '800', color: row.color }}>
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── FEATURE 3: PERSONAL INSIGHTS ── */}
        <section className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <BarChart3 size={18} color="#818cf8" />
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              My Issue Insights
            </span>
          </div>

          {totalIssueCount === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <BarChart3 size={28} style={{ opacity: 0.3, marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
              Your issue insights will appear here after you report issues.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Key Metrics Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {[
                  { label: 'Total', value: totalIssueCount, color: '#818cf8' },
                  { label: 'Open', value: openIssuesCount, color: '#fbbf24' },
                  { label: 'Resolved', value: resolvedCount + closedCount, color: '#34d399' },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      textAlign: 'center',
                      padding: '0.5rem',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Resolution Rate Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.775rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <TrendingUp size={12} /> Resolution Rate
                  </span>
                  <span style={{ fontWeight: '700', color: resolutionRate >= 75 ? '#34d399' : '#818cf8' }}>{resolutionRate}%</span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${resolutionRate}%`, backgroundColor: resolutionRate >= 75 ? '#34d399' : '#818cf8', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
              </div>

              {/* Avg Resolution Time */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={13} /> Avg Resolution Time
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {avgResolutionDays === null ? '—' : `${avgResolutionDays}d`}
                </span>
              </div>

              {/* Critical Issues Count */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: issueHealthCategories.critical.length > 0 ? 'rgba(239,68,68,0.06)' : 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${issueHealthCategories.critical.length > 0 ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
                }}
              >
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlertOctagon size={13} /> Critical / Blocker Open
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: issueHealthCategories.critical.length > 0 ? '#ef4444' : '#34d399' }}>
                  {issueHealthCategories.critical.length}
                </span>
              </div>

              {/* Status Distribution mini-bars */}
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Status Breakdown</div>
                {([
                  { label: 'Reported', value: (statusDist?.REPORTED || 0) + (statusDist?.TRIAGED || 0), color: '#fbbf24' },
                  { label: 'In Progress', value: (statusDist?.IN_DEVELOPMENT || 0) + (statusDist?.IN_REVIEW || 0) + (statusDist?.IN_TESTING || 0) + (statusDist?.ASSIGNED || 0), color: '#38bdf8' },
                  { label: 'Resolved/Closed', value: (statusDist?.RESOLVED || 0) + (statusDist?.CLOSED || 0), color: '#34d399' },
                  { label: 'Reopened', value: statusDist?.REOPENED || 0, color: '#f87171' },
                ] as { label: string; value: number; color: string }[]).filter((r) => r.value > 0).map((row) => (
                  <div key={row.label} style={{ marginBottom: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.1rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.value}</span>
                    </div>
                    <div style={{ height: '4px', backgroundColor: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${totalIssueCount > 0 ? Math.round((row.value / totalIssueCount) * 100) : 0}%`, backgroundColor: row.color, borderRadius: '2px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── 2nd Row: Timeline + Activity Feed ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* ── FEATURE 2: MY ISSUE TIMELINE ── */}
        <section className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <History size={18} color="#818cf8" />
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              My Issue Timeline
            </span>
          </div>

          {userIssues.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <History size={28} style={{ opacity: 0.3, marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
              Report an issue to start tracking its lifecycle.
            </div>
          ) : (
            <>
              {/* Issue Selector */}
              <select
                value={selectedTimelineIssueId ?? ''}
                onChange={(e) => setSelectedTimelineIssueId(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.82rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  marginBottom: '1rem',
                }}
              >
                {[...userIssues]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 30)
                  .map((iss) => (
                    <option key={iss.id} value={iss.id}>
                      {iss.issue_key} — {iss.title.slice(0, 40)}{iss.title.length > 40 ? '…' : ''}
                    </option>
                  ))}
              </select>

              {/* Selected issue header */}
              {selectedTimelineIssueId && (() => {
                const iss = userIssues.find((i) => i.id === selectedTimelineIssueId);
                if (!iss) return null;
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Link
                      to={`/issues/${iss.id}`}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}
                    >
                      {iss.issue_key}
                    </Link>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {iss.title}
                    </span>
                    <StatusBadge status={iss.status} />
                  </div>
                );
              })()}

              {/* Timeline events */}
              {timelineLoading ? (
                <div style={{ padding: '1.5rem 0', display: 'flex', justifyContent: 'center' }}>
                  <LoadingSpinner message="Loading timeline…" />
                </div>
              ) : timelineError ? (
                <p style={{ fontSize: '0.82rem', color: '#f87171', textAlign: 'center' }}>{timelineError}</p>
              ) : timelineEvents.length === 0 ? (
                <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No activity recorded yet for this issue.
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                  {/* Vertical line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '0.45rem',
                      top: '0.5rem',
                      bottom: '0.5rem',
                      width: '2px',
                      backgroundColor: 'var(--border-subtle)',
                    }}
                  />
                  {timelineEvents.map((evt, idx) => {
                    const isLast = idx === timelineEvents.length - 1;
                    let dotColor = '#818cf8';
                    if (evt.action === 'ISSUE_RESOLVED') dotColor = '#34d399';
                    else if (evt.action === 'ISSUE_REOPENED') dotColor = '#f87171';
                    else if (evt.action === 'ISSUE_CREATED') dotColor = '#818cf8';
                    else if (evt.action === 'ISSUE_ASSIGNED') dotColor = '#38bdf8';
                    else if (evt.action === 'ISSUE_STATUS_CHANGED') dotColor = '#fbbf24';
                    return (
                      <div key={evt.id} style={{ position: 'relative', marginBottom: isLast ? 0 : '0.85rem' }}>
                        {/* Dot */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '-1.12rem',
                            top: '0.25rem',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: dotColor,
                            border: '2px solid var(--bg-surface)',
                            zIndex: 1,
                          }}
                        />
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                          {evt.description}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          {evt.actor ? `${evt.actor.full_name} · ` : ''}{formatRelativeTime(evt.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── FEATURE 4: RECENT ACTIVITY FEED ── */}
        <section className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="#818cf8" />
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Recent Activity
              </span>
            </div>
            {activityFeed.filter((n) => !n.is_read).length > 0 && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(239,68,68,0.15)',
                  color: '#f87171',
                }}
              >
                {activityFeed.filter((n) => !n.is_read).length} unread
              </span>
            )}
          </div>

          {activityLoading ? (
            <div style={{ padding: '1.5rem 0', display: 'flex', justifyContent: 'center' }}>
              <LoadingSpinner message="Loading activity…" />
            </div>
          ) : activityFeed.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Bell size={28} style={{ opacity: 0.3, marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
              No recent activity.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {activityFeed.slice(0, 12).map((notif, idx) => {
                let icon = <Bell size={14} />;
                let dotColor = '#818cf8';
                if (notif.notification_type === 'ISSUE_STATUS_CHANGED') { icon = <Activity size={14} />; dotColor = '#fbbf24'; }
                else if (notif.notification_type === 'ISSUE_RESOLVED') { icon = <CheckCircle2 size={14} />; dotColor = '#34d399'; }
                else if (notif.notification_type === 'ISSUE_REOPENED') { icon = <RotateCcw size={14} />; dotColor = '#f87171'; }
                else if (notif.notification_type === 'ISSUE_COMMENTED') { icon = <MessageSquare size={14} />; dotColor = '#38bdf8'; }
                else if (notif.notification_type === 'ISSUE_ASSIGNED') { icon = <Activity size={14} />; dotColor = '#818cf8'; }
                else if (notif.notification_type === 'ATTACHMENT_ADDED') { icon = <FileDown size={14} />; dotColor = '#a78bfa'; }
                else if (notif.notification_type === 'ISSUE_REPORTED') { icon = <Bug size={14} />; dotColor = '#818cf8'; }

                return (
                  <div
                    key={notif.id}
                    style={{
                      display: 'flex',
                      gap: '0.65rem',
                      padding: '0.6rem 0',
                      borderBottom: idx < Math.min(activityFeed.length, 12) - 1 ? '1px solid var(--border-subtle)' : 'none',
                      opacity: notif.is_read ? 0.7 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: `${dotColor}22`,
                        border: `1px solid ${dotColor}44`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: dotColor,
                      }}
                    >
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: notif.is_read ? 400 : 600,
                          color: 'var(--text-primary)',
                          lineHeight: 1.35,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={notif.message}
                      >
                        {notif.entity_key && (
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)', marginRight: '0.3rem', fontSize: '0.75rem' }}>
                            {notif.entity_key}
                          </span>
                        )}
                        {notif.title}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                        {formatRelativeTime(notif.created_at)}
                        {!notif.is_read && (
                          <span style={{ marginLeft: '0.4rem', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#818cf8', display: 'inline-block', verticalAlign: 'middle' }} />
                        )}
                      </div>
                    </div>
                    {notif.entity_id && notif.entity_type === 'ISSUE' && (
                      <Link
                        to={`/issues/${notif.entity_id}`}
                        style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        title="View issue"
                      >
                        <Eye size={13} />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── AI ASSISTANT ── */}
      <AIChatbot
        contextIssueId={recentIssuesList[0]?.id}
        contextIssueKey={recentIssuesList[0]?.issue_key}
      />

      {/* ── Reopen Issue Modal ── */}
      {reopenModalIssue && (
        <Modal
          isOpen={true}
          onClose={() => setReopenModalIssue(null)}
          title={`Reopen Defect: ${reopenModalIssue.issue_key}`}
        >
          <form onSubmit={handleReopenSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                You are reopening <strong>{reopenModalIssue.title}</strong>. Please describe why the resolution was
                incomplete or what error still persists <span style={{ color: '#ef4444' }}>*</span>:
              </p>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Error still occurs when clicking submit on mobile view..."
                rows={4}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  fontSize: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setReopenModalIssue(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isActionSubmitting}
                className="btn btn-danger btn-sm"
              >
                <RotateCcw size={14} />
                <span>{isActionSubmitting ? 'Reopening…' : 'Reopen Defect'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
