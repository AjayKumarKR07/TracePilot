import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bug,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Code2,
  ExternalLink,
  Eye,
  Filter,
  Layers,
  Play,
  RefreshCw,
  Search,
  ThumbsUp,
  X,
} from 'lucide-react';
import { analyticsApi } from '../api/analytics';
import { getApiErrorMessage } from '../api/client';
import { issuesApi } from '../api/issues';
import { projectsApi } from '../api/projects';
import { SprintService } from '../services/SprintService';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { DeveloperActionCenter } from '../components/dashboard/DeveloperActionCenter';
import { DeveloperWorkHealth } from '../components/dashboard/DeveloperWorkHealth';
import { DeveloperSprintHealth } from '../components/dashboard/DeveloperSprintHealth';
import { DeveloperTestingQueue } from '../components/dashboard/DeveloperTestingQueue';
import { DeveloperWorkloadCard } from '../components/dashboard/DeveloperWorkloadCard';
import { RecentIssueActivity } from '../components/dashboard/RecentIssueActivity';
import { UserIssueTrend } from '../components/dashboard/UserIssueTrend';
import { UserResolutionPerformance } from '../components/dashboard/UserResolutionPerformance';
import { UserIssueDistribution } from '../components/dashboard/UserIssueDistribution';
import { UserSlaTracker } from '../components/dashboard/UserSlaTracker';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationNavigate } from '../hooks/useNotificationNavigate';
import type { IssueStatusDistributionResponse } from '../types/analytics';
import type { Issue, IssueStatus, Priority, Severity } from '../types/issue';
import type { Project } from '../types/project';
import type { Sprint } from '../types/Sprint';
import { formatDate, formatRelativeTime } from '../utils/formatters';
import { AIChatbot } from '../components/ai/AIChatbot';

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEVELOPER_VALID_TRANSITIONS: Record<string, string[]> = {
  REPORTED: ['IN_DEVELOPMENT'],
  TRIAGED: ['IN_DEVELOPMENT'],
  ASSIGNED: ['IN_DEVELOPMENT'],
  IN_DEVELOPMENT: ['IN_REVIEW'],
  IN_REVIEW: ['IN_TESTING', 'IN_DEVELOPMENT'],
  REOPENED: ['IN_DEVELOPMENT'],
};

function getWorkflowLabel(status: string): string {
  switch (status) {
    case 'REPORTED':
    case 'TRIAGED':
    case 'ASSIGNED':
      return 'Start Investigation';
    case 'IN_DEVELOPMENT':
      return 'Move to Review';
    case 'IN_REVIEW':
      return 'Begin In-Testing';
    case 'REOPENED':
      return 'Resume Investigation';
    default:
      return 'Advance Status';
  }
}

function getNextStatus(current: string): string | null {
  const transitions = DEVELOPER_VALID_TRANSITIONS[current];
  if (!transitions || transitions.length === 0) return null;
  if (current === 'IN_REVIEW') return 'IN_TESTING';
  return transitions[0];
}

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
// Filter types
// ─────────────────────────────────────────────────────────────────────────────

type SprintFilterTab = 'ALL' | 'IN_PROGRESS' | 'READY_FOR_APPROVAL' | 'ACTIVE' | 'COMPLETED';
type IssueFilterTab = 'ALL' | 'REQUIRES_TESTING' | 'IN_PROGRESS' | 'RESOLVED';
type DateRange = '7' | '30' | '90' | 'all';
type SortOption = 'newest' | 'oldest' | 'updated' | 'priority' | 'severity';

const PRIORITY_WEIGHT: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_WEIGHT: Record<string, number> = { BLOCKER: 0, CRITICAL: 1, MAJOR: 2, MINOR: 3 };

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export const DeveloperDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { wsStatus, notifications: liveNotifications } = useNotifications();
  const { handleNotificationClick } = useNotificationNavigate();

  // ── Data state ──
  const [issues, setIssues] = useState<Issue[]>([]);
  const [totalIssuesCount, setTotalIssuesCount] = useState(0);
  const [statusDist, setStatusDist] = useState<IssueStatusDistributionResponse | null>(null);
  const [assignedSprints, setAssignedSprints] = useState<Sprint[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<number, Project>>({});

  // ── UI / Loading state ──
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<number | null>(null);
  const [sprintSubmitting, setSprintSubmitting] = useState<number | null>(null);

  // ── Sprints section filters ──
  const [sprintTab, setSprintTab] = useState<SprintFilterTab>('ALL');

  // ── Issues section filters & search (advanced) ──
  const [issueTab, setIssueTab] = useState<IssueFilterTab>('ALL');
  const [issueSearch, setIssueSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<IssueStatus | ''>('');
  const [filterSeverity, setFilterSeverity] = useState<Severity | ''>('');
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('');
  const [filterProject, setFilterProject] = useState<number | ''>('');
  const [filterDateRange, setFilterDateRange] = useState<DateRange>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // Data loading (100% live backend data)
  // ─────────────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [issuesRes, statusRes, sprintsRes, projectsRes] = await Promise.all([
        issuesApi.list({ page_size: 100 }),
        analyticsApi.getStatusDistribution().catch(() => null),
        SprintService.getAssignedSprints().catch(() => []),
        projectsApi.list({ page_size: 100 }).catch(() => ({ items: [], total: 0 })),
      ]);

      setIssues(issuesRes.items || []);
      setTotalIssuesCount(issuesRes.total || 0);
      setStatusDist(statusRes);
      setAssignedSprints(sprintsRes || []);

      const pMap: Record<number, Project> = {};
      if (projectsRes?.items) {
        projectsRes.items.forEach((p) => { pMap[p.id] = p; });
      }
      setProjectsMap(pMap);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time WebSocket refresh
  const isInitialMount = useRef(true);
  const latestNotifId = liveNotifications[0]?.id;

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    if (latestNotifId) { loadData(true); }
  }, [latestNotifId, loadData]);

  useEffect(() => {
    if (wsStatus === 'connected') { loadData(true); }
  }, [wsStatus, loadData]);

  useEffect(() => {
    const handleRealtime = () => { loadData(true); };
    window.addEventListener('app:realtime_notification', handleRealtime);
    window.addEventListener('app:ws_reconnected', handleRealtime);
    return () => {
      window.removeEventListener('app:realtime_notification', handleRealtime);
      window.removeEventListener('app:ws_reconnected', handleRealtime);
    };
  }, [loadData]);

  // ─────────────────────────────────────────────────────────────────────────────
  // KPI Metrics (Calculated from real backend data)
  // ─────────────────────────────────────────────────────────────────────────────

  const myAssignedSprintsCount = assignedSprints.length;
  const sprintsInProgressCount = assignedSprints.filter((s) => s.status === 'IN_PROGRESS').length;
  const awaitingApprovalCount = assignedSprints.filter((s) => s.status === 'READY_FOR_APPROVAL').length;
  const activeSprintsCount = assignedSprints.filter((s) => s.status === 'ACTIVE').length;
  const completedSprintsCount = assignedSprints.filter((s) => s.status === 'COMPLETED').length;

  const myAssignedIssuesCount = totalIssuesCount || issues.length;
  const issuesRequiringTestingCount = statusDist
    ? (statusDist.IN_TESTING || 0) + (statusDist.IN_REVIEW || 0)
    : issues.filter((i) => i.status === 'IN_TESTING' || i.status === 'IN_REVIEW').length;
  const inProgressIssuesCount = statusDist
    ? statusDist.IN_DEVELOPMENT || 0
    : issues.filter((i) => i.status === 'IN_DEVELOPMENT').length;
  const resolvedIssuesCount = statusDist
    ? (statusDist.RESOLVED || 0) + (statusDist.CLOSED || 0)
    : issues.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length;

  // ─────────────────────────────────────────────────────────────────────────────
  // Filtered Sprints List
  // ─────────────────────────────────────────────────────────────────────────────

  const filteredSprints = useMemo(() => {
    switch (sprintTab) {
      case 'IN_PROGRESS': return assignedSprints.filter((s) => s.status === 'IN_PROGRESS');
      case 'READY_FOR_APPROVAL': return assignedSprints.filter((s) => s.status === 'READY_FOR_APPROVAL');
      case 'ACTIVE': return assignedSprints.filter((s) => s.status === 'ACTIVE');
      case 'COMPLETED': return assignedSprints.filter((s) => s.status === 'COMPLETED');
      default: return assignedSprints;
    }
  }, [assignedSprints, sprintTab]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Advanced Filtered Issues List
  // ─────────────────────────────────────────────────────────────────────────────

  const hasActiveFilters = useMemo(
    () =>
      !!issueSearch.trim() ||
      !!filterStatus ||
      !!filterSeverity ||
      !!filterPriority ||
      filterProject !== '' ||
      filterDateRange !== 'all' ||
      sortOption !== 'newest' ||
      issueTab !== 'ALL',
    [issueSearch, filterStatus, filterSeverity, filterPriority, filterProject, filterDateRange, sortOption, issueTab]
  );

  const filteredIssues = useMemo(() => {
    let list = [...issues];

    // Tab filter
    if (issueTab === 'REQUIRES_TESTING') {
      list = list.filter((i) => i.status === 'IN_TESTING' || i.status === 'IN_REVIEW');
    } else if (issueTab === 'IN_PROGRESS') {
      list = list.filter((i) => i.status === 'IN_DEVELOPMENT');
    } else if (issueTab === 'RESOLVED') {
      list = list.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED');
    }

    // Search
    if (issueSearch.trim()) {
      const q = issueSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.issue_key.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          (projectsMap[i.project_id]?.name || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterStatus) {
      list = list.filter((i) => i.status === filterStatus);
    }

    // Severity filter
    if (filterSeverity) {
      list = list.filter((i) => i.severity === filterSeverity);
    }

    // Priority filter
    if (filterPriority) {
      list = list.filter((i) => i.priority === filterPriority);
    }

    // Project filter
    if (filterProject !== '') {
      list = list.filter((i) => i.project_id === filterProject);
    }

    // Date range filter (by created_at)
    if (filterDateRange !== 'all') {
      const days = parseInt(filterDateRange, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffMs = cutoff.getTime();
      list = list.filter((i) => new Date(i.created_at).getTime() >= cutoffMs);
    }

    // Sort
    list.sort((a, b) => {
      switch (sortOption) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'priority':
          return (PRIORITY_WEIGHT[a.priority] ?? 4) - (PRIORITY_WEIGHT[b.priority] ?? 4);
        case 'severity':
          return (SEVERITY_WEIGHT[a.severity] ?? 4) - (SEVERITY_WEIGHT[b.severity] ?? 4);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return list;
  }, [issues, issueTab, issueSearch, filterStatus, filterSeverity, filterPriority, filterProject, filterDateRange, sortOption, projectsMap]);

  // Clear all advanced filters
  const clearFilters = useCallback(() => {
    setIssueSearch('');
    setFilterStatus('');
    setFilterSeverity('');
    setFilterPriority('');
    setFilterProject('');
    setFilterDateRange('all');
    setSortOption('newest');
    setIssueTab('ALL');
  }, []);

  // Project options for filter dropdown
  const projectOptions = useMemo(
    () => Object.values(projectsMap).sort((a, b) => a.name.localeCompare(b.name)),
    [projectsMap]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Sprint Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const handleBeginWork = async (sprintId: number) => {
    setSprintSubmitting(sprintId);
    setActionError(null);
    try {
      await SprintService.beginWork(sprintId);
      setActionSuccess('Sprint is now In Progress! You can begin active development.');
      setTimeout(() => setActionSuccess(null), 5000);
      await loadData(true);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err));
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setSprintSubmitting(null);
    }
  };

  const handleSubmitSprintForApproval = async (sprintId: number) => {
    setSprintSubmitting(sprintId);
    setActionError(null);
    try {
      await SprintService.submitForApproval(sprintId);
      setActionSuccess('Sprint submitted for Admin approval! Status updated to Awaiting Approval.');
      setTimeout(() => setActionSuccess(null), 5000);
      await loadData(true);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err));
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setSprintSubmitting(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Issue Workflow Quick Action
  // ─────────────────────────────────────────────────────────────────────────────

  const handleAdvanceStatus = async (issue: Issue) => {
    const next = getNextStatus(issue.status);
    if (!next) return;
    setTransitioning(issue.id);
    setActionError(null);
    try {
      await issuesApi.updateStatus(issue.id, { status: next as IssueStatus });
      setActionSuccess(`${issue.issue_key} updated to ${next.replace(/_/g, ' ')}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadData(true);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err));
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setTransitioning(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // AI context — pick most relevant issue (urgent/high priority active)
  // ─────────────────────────────────────────────────────────────────────────────

  const aiContextIssue = useMemo(() => {
    return (
      issues.find((i) => i.status === 'REOPENED') ||
      issues.find((i) => i.priority === 'URGENT' && !['RESOLVED', 'CLOSED'].includes(i.status)) ||
      issues.find((i) => i.priority === 'HIGH' && !['RESOLVED', 'CLOSED'].includes(i.status)) ||
      issues[0]
    );
  }, [issues]);

  const aiContextSprint = useMemo(() => {
    return (
      assignedSprints.find((s) => s.status === 'IN_PROGRESS') ||
      assignedSprints.find((s) => s.status === 'ACTIVE')
    );
  }, [assignedSprints]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render Loading & Error States
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ padding: '3.5rem 0', display: 'flex', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading your Developer Workspace..." />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => loadData()} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2.5rem' }}>
      {/* ── Toast Alerts ── */}
      {actionSuccess && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
          }}
        >
          <CheckCircle2 size={16} />
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
          }}
        >
          <AlertCircle size={16} />
          {actionError}
        </div>
      )}

      {/* ── Hero Greeting Card ── */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(99, 102, 241, 0.10) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
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
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  fontWeight: '600',
                  fontSize: '0.75rem',
                }}
              >
                <Code2 size={13} /> DEVELOPER WORKSPACE
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

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              {sprintsInProgressCount > 0
                ? `You have ${sprintsInProgressCount} sprint${sprintsInProgressCount > 1 ? 's' : ''} in progress and ${issuesRequiringTestingCount} issue${issuesRequiringTestingCount === 1 ? '' : 's'} requiring your attention.`
                : awaitingApprovalCount > 0
                ? `You have ${awaitingApprovalCount} sprint${awaitingApprovalCount > 1 ? 's' : ''} submitted and awaiting Admin approval.`
                : activeSprintsCount > 0
                ? `You have ${activeSprintsCount} assigned sprint${activeSprintsCount > 1 ? 's' : ''} ready to begin.`
                : `You have ${myAssignedIssuesCount} assigned issue${myAssignedIssuesCount === 1 ? '' : 's'} across active projects.`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => loadData(true)}
              className="btn btn-secondary btn-sm"
              disabled={isRefreshing}
              title="Refresh Dashboard"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Refreshing\u2026' : 'Refresh'}</span>
            </button>

            <Link to="/developer-sprints" className="btn btn-secondary btn-sm">
              <Layers size={14} />
              <span>My Sprints</span>
            </Link>

            <Link to="/developer-issues" className="btn btn-primary btn-sm">
              <Bug size={14} />
              <span>My Assigned Issues</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <MetricCard
          label="My Assigned Sprints"
          value={myAssignedSprintsCount}
          icon={<Layers size={20} />}
          iconClass="metric-icon-indigo"
          subtitle="Total assigned sprints"
          onClick={() => {
            setSprintTab('ALL');
            document.getElementById('my-sprints-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <MetricCard
          label="Sprints In Progress"
          value={sprintsInProgressCount}
          icon={<Play size={20} />}
          iconClass="metric-icon-amber"
          valueColor={sprintsInProgressCount > 0 ? '#fbbf24' : undefined}
          subtitle="Actively in development"
          badge={sprintsInProgressCount > 0 ? 'Active' : undefined}
          badgeColor="#f59e0b"
          onClick={() => {
            setSprintTab('IN_PROGRESS');
            document.getElementById('my-sprints-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <MetricCard
          label="Awaiting Approval"
          value={awaitingApprovalCount}
          icon={<ClipboardCheck size={20} />}
          iconClass="metric-icon-cyan"
          valueColor={awaitingApprovalCount > 0 ? '#22d3ee' : undefined}
          subtitle="Submitted for Admin review"
          badge={awaitingApprovalCount > 0 ? 'Needs Admin' : undefined}
          badgeColor="#06b6d4"
          onClick={() => {
            setSprintTab('READY_FOR_APPROVAL');
            document.getElementById('my-sprints-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <MetricCard
          label="My Assigned Issues"
          value={myAssignedIssuesCount}
          icon={<Bug size={20} />}
          iconClass="metric-icon-purple"
          subtitle="Total assigned issues"
          onClick={() => {
            setIssueTab('ALL');
            document.getElementById('my-issues-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <MetricCard
          label="In Development"
          value={inProgressIssuesCount}
          icon={<Code2 size={20} />}
          iconClass="metric-icon-indigo"
          valueColor={inProgressIssuesCount > 0 ? '#818cf8' : undefined}
          subtitle="Currently in development"
          onClick={() => {
            setIssueTab('IN_PROGRESS');
            document.getElementById('my-issues-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <MetricCard
          label="Testing / Review"
          value={issuesRequiringTestingCount}
          icon={<Eye size={20} />}
          iconClass="metric-icon-emerald"
          valueColor={issuesRequiringTestingCount > 0 ? '#34d399' : undefined}
          subtitle="IN_TESTING & IN_REVIEW"
          badge={issuesRequiringTestingCount > 0 ? 'Action Required' : undefined}
          badgeColor="#10b981"
          onClick={() => {
            setIssueTab('REQUIRES_TESTING');
            document.getElementById('my-issues-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <MetricCard
          label="Resolved / Closed"
          value={resolvedIssuesCount}
          icon={<CheckCircle2 size={20} />}
          iconClass="metric-icon-emerald"
          valueColor={resolvedIssuesCount > 0 ? '#34d399' : undefined}
          subtitle="Completed issues"
          onClick={() => {
            setIssueTab('RESOLVED');
            document.getElementById('my-issues-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </div>

      {/* ── Developer Action Center ── */}
      <DeveloperActionCenter
        assignedIssues={issues}
        assignedSprints={assignedSprints}
      />

      {/* ── Row: Work Health + Sprint Health ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <DeveloperWorkHealth assignedIssues={issues} />
        <DeveloperSprintHealth assignedSprints={assignedSprints} />
      </div>

      {/* ── Row: Issue Trend + Resolution Performance ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <UserIssueTrend userIssues={issues} />
        <UserResolutionPerformance userIssues={issues} />
      </div>

      {/* ── Row: SLA Tracker + Distribution ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <UserSlaTracker userIssues={issues} />
        <UserIssueDistribution userIssues={issues} />
      </div>

      {/* ── Testing & Review Queue ── */}
      <DeveloperTestingQueue assignedIssues={issues} />

      {/* ── SECTION A: MY SPRINTS ── */}
      <section
        id="my-sprints-section"
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
            <Layers size={18} style={{ color: '#818cf8' }} />
            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              My Sprints
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
              {assignedSprints.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Filter Pills */}
            <div
              style={{
                display: 'flex',
                gap: '0.3rem',
                background: 'var(--bg-surface-elevated)',
                padding: '0.2rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {[
                { id: 'ALL', label: 'All', count: assignedSprints.length },
                { id: 'IN_PROGRESS', label: 'In Progress', count: sprintsInProgressCount },
                { id: 'READY_FOR_APPROVAL', label: 'Awaiting Approval', count: awaitingApprovalCount },
                { id: 'ACTIVE', label: 'Active', count: activeSprintsCount },
                { id: 'COMPLETED', label: 'Completed', count: completedSprintsCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSprintTab(tab.id as SprintFilterTab)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: sprintTab === tab.id ? 700 : 500,
                    borderRadius: '6px',
                    border: 'none',
                    background: sprintTab === tab.id ? 'var(--primary)' : 'transparent',
                    color: sprintTab === tab.id ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
                </button>
              ))}
            </div>

            <Link
              to="/developer-sprints"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#a5b4fc' }}
            >
              <span>Open My Sprints</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Sprint Cards List */}
        {filteredSprints.length === 0 ? (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: '8px',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <Layers size={32} style={{ opacity: 0.35, marginBottom: '0.5rem', color: '#818cf8' }} />
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              {sprintTab === 'ALL'
                ? 'No sprints are currently assigned to you. When an Admin assigns a sprint to you, it will appear here.'
                : `No sprints in status "${sprintTab.replace(/_/g, ' ')}".`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {filteredSprints.map((sprint) => {
              const isAwaiting = sprint.status === 'READY_FOR_APPROVAL';
              const isInProgress = sprint.status === 'IN_PROGRESS';
              const isActive = sprint.status === 'ACTIVE';
              const isCompleted = sprint.status === 'COMPLETED';

              return (
                <div
                  key={sprint.id}
                  style={{
                    padding: '0.85rem 1.15rem',
                    border: isAwaiting
                      ? '1px solid rgba(6, 182, 212, 0.45)'
                      : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    background: isAwaiting
                      ? 'rgba(6, 182, 212, 0.08)'
                      : 'var(--bg-surface-elevated)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Top Row: Name, Goal, Dates, Status, Actions */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                        <Link
                          to={`/developer-sprints?sprintId=${sprint.id}`}
                          style={{
                            fontWeight: 700,
                            fontSize: '0.98rem',
                            color: 'var(--text-primary)',
                            textDecoration: 'none',
                          }}
                          title="View Sprint Details"
                        >
                          {sprint.name}
                        </Link>

                        {/* Status Badges */}
                        {isAwaiting && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.55rem',
                              borderRadius: '999px',
                              backgroundColor: 'rgba(6, 182, 212, 0.18)',
                              color: '#22d3ee',
                              border: '1px solid rgba(6, 182, 212, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <Clock size={12} /> Awaiting Admin Approval
                          </span>
                        )}
                        {isInProgress && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.55rem',
                              borderRadius: '999px',
                              backgroundColor: 'rgba(245, 158, 11, 0.18)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <Play size={12} /> In Progress
                          </span>
                        )}
                        {isActive && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.55rem',
                              borderRadius: '999px',
                              backgroundColor: 'rgba(99, 102, 241, 0.18)',
                              color: '#818cf8',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <ClipboardCheck size={12} /> Ready to Begin
                          </span>
                        )}
                        {isCompleted && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.55rem',
                              borderRadius: '999px',
                              backgroundColor: 'rgba(16, 185, 129, 0.18)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <CheckCircle2 size={12} /> Approved &amp; Completed
                          </span>
                        )}
                      </div>

                      {sprint.goal && (
                        <p
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-secondary)',
                            margin: '0.2rem 0 0 0',
                            maxWidth: '750px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={sprint.goal}
                        >
                          {sprint.goal}
                        </p>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          gap: '0.85rem',
                          fontSize: '0.76rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.35rem',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          <Calendar size={11} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          {formatDate(sprint.start_date)} &rarr; {formatDate(sprint.end_date)}
                        </span>
                        {sprint.project_id && projectsMap[sprint.project_id] && (
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {projectsMap[sprint.project_id]?.name || `Project #${sprint.project_id}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                      {isActive && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={sprintSubmitting === sprint.id}
                          onClick={() => handleBeginWork(sprint.id)}
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                          title="Start working on this sprint"
                        >
                          <Play size={13} />
                          <span>{sprintSubmitting === sprint.id ? 'Starting\u2026' : 'Begin Work'}</span>
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          className="btn btn-success btn-sm"
                          disabled={sprintSubmitting === sprint.id}
                          onClick={() => handleSubmitSprintForApproval(sprint.id)}
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                          title={sprint.review_comment ? 'Resubmit sprint for Admin review' : 'Submit sprint for Admin review'}
                        >
                          <ThumbsUp size={13} />
                          <span>
                            {sprintSubmitting === sprint.id
                              ? 'Submitting\u2026'
                              : sprint.review_comment
                              ? 'Resubmit for Approval'
                              : 'Submit for Approval'}
                          </span>
                        </button>
                      )}

                      {isAwaiting && (
                        <span
                          style={{
                            fontSize: '0.78rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            background: 'rgba(6, 182, 212, 0.12)',
                            border: '1px solid rgba(6, 182, 212, 0.35)',
                            color: '#22d3ee',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontWeight: 600,
                          }}
                        >
                          <Clock size={13} /> In Admin Review
                        </span>
                      )}

                      {isCompleted && (
                        <span
                          style={{
                            fontSize: '0.78rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            color: '#34d399',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontWeight: 600,
                          }}
                        >
                          <CheckCircle2 size={13} /> Approved
                        </span>
                      )}

                      <Link
                        to={`/developer-sprints?sprintId=${sprint.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                        title="View sprint details"
                      >
                        <ExternalLink size={13} />
                        <span>Details</span>
                      </Link>
                    </div>
                  </div>

                  {/* Review Comment Callout */}
                  {sprint.review_comment && isInProgress && (
                    <div
                      style={{
                        marginTop: '0.55rem',
                        padding: '0.55rem 0.85rem',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: '6px',
                        borderLeft: '4px solid #f59e0b',
                        fontSize: '0.82rem',
                      }}
                    >
                      <strong style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <AlertTriangle size={13} /> Admin Feedback &mdash; Changes Requested:
                      </strong>
                      <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)' }}>
                        {sprint.review_comment}
                      </p>
                    </div>
                  )}

                  {/* Approved Callout */}
                  {isCompleted && sprint.approved_at && (
                    <div
                      style={{
                        marginTop: '0.45rem',
                        padding: '0.35rem 0.65rem',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        color: '#34d399',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <CheckCircle2 size={12} /> Approved by Admin {formatRelativeTime(sprint.approved_at)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── SECTION B: MY ASSIGNED ISSUES (Advanced Filters) ── */}
      <section
        id="my-issues-section"
        className="card"
        style={{
          border: '1px solid rgba(167, 139, 250, 0.3)',
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
            marginBottom: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Bug size={18} style={{ color: '#a78bfa' }} />
            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              My Assigned Issues
            </h2>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                background: 'rgba(167, 139, 250, 0.2)',
                color: '#a78bfa',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
              }}
            >
              {myAssignedIssuesCount}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
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
                placeholder="Search issues\u2026"
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
                style={{
                  paddingLeft: '2rem',
                  paddingRight: '0.75rem',
                  paddingTop: '0.35rem',
                  paddingBottom: '0.35rem',
                  fontSize: '0.8rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  width: '175px',
                }}
              />
            </div>

            {/* Quick Filter Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '0.3rem',
                background: 'var(--bg-surface-elevated)',
                padding: '0.2rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {[
                { id: 'ALL', label: 'All', count: issues.length },
                { id: 'REQUIRES_TESTING', label: 'Testing / Review', count: issuesRequiringTestingCount },
                { id: 'IN_PROGRESS', label: 'In Development', count: inProgressIssuesCount },
                { id: 'RESOLVED', label: 'Resolved', count: resolvedIssuesCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setIssueTab(tab.id as IssueFilterTab)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: issueTab === tab.id ? 700 : 500,
                    borderRadius: '6px',
                    border: 'none',
                    background:
                      issueTab === tab.id
                        ? tab.id === 'REQUIRES_TESTING'
                          ? '#10b981'
                          : 'var(--primary)'
                        : 'transparent',
                    color: issueTab === tab.id ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
                </button>
              ))}
            </div>

            {/* Advanced Filters toggle */}
            <button
              onClick={() => setShowAdvancedFilters((p) => !p)}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.78rem',
                padding: '0.3rem 0.65rem',
                background: showAdvancedFilters ? 'rgba(99,102,241,0.15)' : undefined,
                color: showAdvancedFilters ? '#818cf8' : undefined,
              }}
            >
              <Filter size={13} />
              <span>Filters {hasActiveFilters ? '\u25cf' : ''}</span>
              <ChevronDown
                size={12}
                style={{ transform: showAdvancedFilters ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
              />
            </button>

            <Link
              to="/developer-issues"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#c4b5fd' }}
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* ── Advanced Filter Panel ── */}
        {showAdvancedFilters && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.65rem',
              padding: '0.85rem',
              background: 'var(--bg-surface-elevated)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '0.85rem',
              alignItems: 'flex-end',
            }}
          >
            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as IssueStatus | '')}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.78rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  minWidth: '140px',
                }}
              >
                <option value="">All Statuses</option>
                {['REPORTED','TRIAGED','ASSIGNED','IN_DEVELOPMENT','IN_REVIEW','IN_TESTING','REOPENED','RESOLVED','CLOSED'].map(
                  (s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                )}
              </select>
            </div>

            {/* Severity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Severity
              </label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as Severity | '')}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.78rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  minWidth: '120px',
                }}
              >
                <option value="">All Severities</option>
                {['BLOCKER','CRITICAL','MAJOR','MINOR'].map(
                  (s) => <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>

            {/* Priority */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Priority
              </label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as Priority | '')}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.78rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  minWidth: '120px',
                }}
              >
                <option value="">All Priorities</option>
                {['URGENT','HIGH','MEDIUM','LOW'].map(
                  (p) => <option key={p} value={p}>{p}</option>
                )}
              </select>
            </div>

            {/* Project */}
            {projectOptions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Project
                </label>
                <select
                  value={filterProject}
                  onChange={(e) =>
                    setFilterProject(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.78rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    minWidth: '140px',
                  }}
                >
                  <option value="">All Projects</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Created
              </label>
              <select
                value={filterDateRange}
                onChange={(e) => setFilterDateRange(e.target.value as DateRange)}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.78rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  minWidth: '130px',
                }}
              >
                <option value="all">All Time</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Sort By
              </label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.78rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  minWidth: '140px',
                }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="updated">Recently Updated</option>
                <option value="priority">Priority</option>
                <option value="severity">Severity</option>
              </select>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', alignSelf: 'flex-end' }}
                title="Clear all filters"
              >
                <X size={13} />
                <span>Clear</span>
              </button>
            )}
          </div>
        )}

        {/* Result count */}
        <div
          style={{
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredIssues.length}</strong> of{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{issues.length}</strong> assigned issues
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                fontSize: '0.72rem',
                color: 'var(--primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0',
                textDecoration: 'underline',
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Issues Table */}
        {filteredIssues.length === 0 ? (
          <div
            style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: '8px',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <Bug size={32} style={{ opacity: 0.35, marginBottom: '0.5rem', color: '#a78bfa' }} />
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              {issueSearch
                ? `No issues match search query "${issueSearch}".`
                : issueTab === 'REQUIRES_TESTING'
                ? 'No issues are currently waiting for testing or review.'
                : hasActiveFilters
                ? 'No issues match the active filters.'
                : 'No issues are currently assigned to you.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Issue Key', 'Title', 'Project', 'Severity', 'Priority', 'Status', 'Age', 'Action'].map(
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
                {filteredIssues.slice(0, 20).map((issue) => {
                  const requiresTesting = issue.status === 'IN_TESTING' || issue.status === 'IN_REVIEW';
                  const nextStatus = getNextStatus(issue.status);
                  const canAdvance = !!nextStatus;
                  const isTransitioning = transitioning === issue.id;
                  const project = projectsMap[issue.project_id];
                  const ageDays = Math.floor(
                    (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <tr
                      key={issue.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        borderLeft: requiresTesting
                          ? '3px solid #10b981'
                          : issue.status === 'REOPENED'
                          ? '3px solid #f87171'
                          : '3px solid transparent',
                        backgroundColor:
                          requiresTesting
                            ? 'rgba(16, 185, 129, 0.03)'
                            : issue.status === 'REOPENED'
                            ? 'rgba(239,68,68,0.03)'
                            : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                          'var(--bg-surface-hover)')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                          requiresTesting
                            ? 'rgba(16, 185, 129, 0.03)'
                            : issue.status === 'REOPENED'
                            ? 'rgba(239,68,68,0.03)'
                            : 'transparent')
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
                          maxWidth: '240px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Link
                          to={`/issues/${issue.id}`}
                          style={{
                            color: 'var(--text-primary)',
                            fontWeight: requiresTesting ? '600' : '500',
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

                      {/* Age */}
                      <td
                        style={{
                          padding: '0.6rem 0.75rem',
                          color: ageDays > 10 ? '#fbbf24' : 'var(--text-muted)',
                          fontSize: '0.76rem',
                          whiteSpace: 'nowrap',
                          fontWeight: ageDays > 10 ? 600 : 400,
                        }}
                        title={formatDate(issue.created_at)}
                      >
                        {ageDays}d
                      </td>

                      {/* Action */}
                      <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {canAdvance && (
                            <button
                              onClick={() => handleAdvanceStatus(issue)}
                              disabled={isTransitioning}
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                              title={getWorkflowLabel(issue.status)}
                            >
                              <Play size={10} />
                              <span>{isTransitioning ? '\u2026' : getWorkflowLabel(issue.status)}</span>
                            </button>
                          )}

                          <Link
                            to={`/issues/${issue.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.2rem 0.55rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                            title="View full issue details"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredIssues.length > 20 && (
              <div
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <Link
                  to="/developer-issues"
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--primary)',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <span>View all {filteredIssues.length} matching issues</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Row: Recent Activity + Workload ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <RecentIssueActivity userIssues={issues} />
        <DeveloperWorkloadCard assignedIssues={issues} />
      </div>

      {/* ── Live Notifications ── */}
      {liveNotifications.length > 0 && (
        <section className="card" style={{ padding: '1.15rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} color="#34d399" />
              <h3
                style={{
                  fontSize: '0.92rem',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Recent Activity
              </h3>
            </div>
            <Link to="/notifications" style={{ fontSize: '0.78rem', color: 'var(--primary)' }}>
              All Notifications &rarr;
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {liveNotifications.slice(0, 5).map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                role="button"
                tabIndex={0}
                title="Click to navigate to relevant entity"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.55rem 0.85rem',
                  backgroundColor: notif.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                  borderRadius: '6px',
                  border: notif.is_read ? '1px solid transparent' : '1px solid rgba(99, 102, 241, 0.15)',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNotificationClick(notif);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: notif.is_read ? 'var(--border-muted)' : '#818cf8',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: notif.is_read ? '400' : '600',
                        color: 'var(--text-primary)',
                        marginRight: '0.5rem',
                      }}
                    >
                      {notif.title}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {notif.message}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formatRelativeTime(notif.created_at)}
                  </span>
                  <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── AI DEVELOPER ASSISTANT ── */}
      <AIChatbot
        contextIssueId={aiContextIssue?.id}
        contextIssueKey={aiContextIssue?.issue_key}
        contextSprintId={aiContextSprint?.id}
        contextSprintName={aiContextSprint?.name}
      />
    </div>
  );
};
