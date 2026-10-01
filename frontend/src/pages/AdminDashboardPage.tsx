import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  Bug,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FolderGit2,
  HeartPulse,
  Layers,
  LayoutDashboard,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Shield,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  Users,
  Sparkles,
} from 'lucide-react';

import { adminApi } from '../api/admin';
import { analyticsApi } from '../api/analytics';
import { auditApi } from '../api/audit';
import { issuesApi } from '../api/issues';
import { usersApi } from '../api/users';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { SprintService } from '../services/SprintService';
import { AdminActionCenter } from '../components/dashboard/AdminActionCenter';
import { AdminSystemHealth } from '../components/dashboard/AdminSystemHealth';
import { AdminPerformanceSummary } from '../components/dashboard/AdminPerformanceSummary';
import { AdminDefectTrend } from '../components/dashboard/AdminDefectTrend';
import { AdminIssueDistribution } from '../components/dashboard/AdminIssueDistribution';
import { AdminSprintHealth } from '../components/dashboard/AdminSprintHealth';
import { AdminApprovalCenter } from '../components/dashboard/AdminApprovalCenter';
import { AdminProjectHealth } from '../components/dashboard/AdminProjectHealth';
import { AdminTeamWorkload } from '../components/dashboard/AdminTeamWorkload';
import { AdminRecentActivity } from '../components/dashboard/AdminRecentActivity';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import type { AdminDashboardResponse, InactiveAssigneeItem } from '../types/admin';
import type { DeveloperAnalyticsItem, QualityMetricsResponse } from '../types/analytics';
import type { AuditLogItem } from '../types/audit';
import type { Issue } from '../types/issue';
import type { Sprint } from '../types/Sprint';
import type { UserDetail } from '../types/user';
import { formatDate, formatRelativeTime } from '../utils/formatters';

// ─────────────────────────────────────────────────────────────────────────────
// Bar Row Helper
// ─────────────────────────────────────────────────────────────────────────────

interface BarRowProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

const BarRow: React.FC<BarRowProps> = ({ label, count, total, color }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: '0.65rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
          {count.toLocaleString()}
          <span style={{ color: 'var(--text-muted)', fontWeight: '400', marginLeft: '0.3rem' }}>
            ({pct}%)
          </span>
        </span>
      </div>
      <div style={{ height: '6px', borderRadius: '4px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: '4px', transition: 'width 0.6s' }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card
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
              padding: '0.1rem 0.45rem',
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
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
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

export const AdminDashboardPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { wsStatus, unreadCount, notifications: liveNotifications } = useNotifications();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [stats, setStats] = useState<AdminDashboardResponse | null>(null);
  const [workloads, setWorkloads] = useState<DeveloperAnalyticsItem[]>([]);
  const [inactiveAssignees, setInactiveAssignees] = useState<InactiveAssigneeItem[]>([]);
  const [unassignedQueue, setUnassignedQueue] = useState<Issue[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetricsResponse | null>(null);

  // Sprints state
  const [awaitingApproval, setAwaitingApproval] = useState<Sprint[]>([]);
  const [activeSprints, setActiveSprints] = useState<Sprint[]>([]);

  // Modals state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [testers, setTesters] = useState<UserDetail[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sprint approval actions
  const [requestChangesSprintId, setRequestChangesSprintId] = useState<number | null>(null);
  const [requestChangesComment, setRequestChangesComment] = useState('');
  const [sprintActionLoading, setSprintActionLoading] = useState<number | null>(null);

  const fetchData = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [
        dashboardStats,
        qualityData,
        workloadList,
        inactiveList,
        unassignedList,
        logsList,
        pendingSprints,
        activeSprintsList,
      ] = await Promise.all([
        adminApi.getDashboard(),
        analyticsApi.getQualityMetrics().catch(() => null),
        analyticsApi.getDeveloperPerformance().catch(() => ({ items: [] })),
        adminApi.getInactiveAssignees().catch(() => ({ items: [] })),
        issuesApi.list({ unassigned: true, page_size: 10 }).catch(() => ({ items: [] })),
        auditApi.list({ page_size: 15 }).catch(() => ({ items: [] })),
        SprintService.getAwaitingApprovalSprints().catch(() => []),
        SprintService.getActiveSprints().catch(() => []),
      ]);

      setStats(dashboardStats);
      setQualityMetrics(qualityData);
      setWorkloads(workloadList.items || []);
      setInactiveAssignees(inactiveList.items || []);
      setUnassignedQueue(unassignedList.items || []);
      setAuditLogs(logsList.items || []);
      setAwaitingApproval(pendingSprints || []);
      setActiveSprints(activeSprintsList || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time WebSocket refresh
  const isInitialMount = useRef(true);
  const latestNotificationId = liveNotifications[0]?.id;

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (latestNotificationId) {
      fetchData(true);
    }
  }, [latestNotificationId, fetchData]);

  // Refetch current server state when WebSocket reconnects
  useEffect(() => {
    if (wsStatus === 'connected') {
      fetchData(true);
    }
  }, [wsStatus, fetchData]);

  // Also listen for broadcasted app-level realtime events
  useEffect(() => {
    const handleRealtime = () => {
      fetchData(true);
    };
    window.addEventListener('app:realtime_notification', handleRealtime);
    window.addEventListener('app:ws_reconnected', handleRealtime);
    return () => {
      window.removeEventListener('app:realtime_notification', handleRealtime);
      window.removeEventListener('app:ws_reconnected', handleRealtime);
    };
  }, [fetchData]);

  // Handle Assign modal
  const openAssignModal = async (issueId: number) => {
    setSelectedIssueId(issueId);
    setAssignModalOpen(true);
    try {
      const res = await usersApi.list({ role: 'DEVELOPER', is_active: true, page_size: 100 });
      setTesters(res.items);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssign = async (testerId: number) => {
    if (!selectedIssueId) return;
    setAssigning(true);
    try {
      await issuesApi.assign(selectedIssueId, { tester_id: testerId });
      setToastMessage({ type: 'success', text: 'Issue assigned successfully' });
      setAssignModalOpen(false);
      fetchData(true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to assign tester' });
    } finally {
      setAssigning(false);
    }
  };

  const handleApproveSprint = async (sprintId: number) => {
    setSprintActionLoading(sprintId);
    try {
      await SprintService.approveSprint(sprintId);
      setToastMessage({ type: 'success', text: 'Sprint approved and marked COMPLETED!' });
      fetchData(true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to approve sprint' });
    } finally {
      setSprintActionLoading(null);
    }
  };

  const handleRequestChanges = async () => {
    if (!requestChangesSprintId) return;
    setSprintActionLoading(requestChangesSprintId);
    try {
      await SprintService.requestChanges(requestChangesSprintId, requestChangesComment || null);
      setToastMessage({ type: 'success', text: 'Changes requested. Tester will be notified.' });
      setRequestChangesSprintId(null);
      setRequestChangesComment('');
      fetchData(true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to request changes' });
    } finally {
      setSprintActionLoading(null);
    }
  };

  // Health Score Calculation
  const healthScore = useMemo(() => {
    if (!stats) return 100;
    let score = 100;
    score -= stats.severity.blocker * 10;
    score -= Math.min(25, Math.floor(stats.severity.critical / 100));

    const totalIssues = stats.issues.total;
    const resolvedClosed = stats.issues.resolved + stats.issues.closed;
    const resRate = totalIssues > 0 ? (resolvedClosed / totalIssues) * 100 : 0;
    const reopenRate = totalIssues > 0 ? (stats.issues.reopened / totalIssues) * 100 : 0;

    if (reopenRate > 10) score -= 5;
    if (resRate >= 75) score += 5;

    return Math.max(0, Math.min(100, score));
  }, [stats]);

  if (isLoading && !stats) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <LoadingSpinner message="Loading Admin Dashboard..." />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="page-container">
        <ErrorMessage message={error} onRetry={() => fetchData()} />
      </div>
    );
  }

  if (!stats) return null;


  // Recently completed sprints (last 10) — used by AdminApprovalCenter
  const recentlyCompleted = activeSprints
    .filter((s) => s.status === 'COMPLETED')
    .slice(0, 10);

    const resolutionRate = stats.issues.total > 0
    ? Math.round(((stats.issues.resolved + stats.issues.closed) / stats.issues.total) * 100)
    : 0;

  const totalPipelineSprints =
    (stats.sprints?.planned || 0) +
    (stats.sprints?.active || 0) +
    (stats.sprints?.in_progress || 0) +
    (stats.sprints?.ready_for_approval || 0) +
    (stats.sprints?.completed || 0);

  const getInitials = (name?: string) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="page-container" style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 1. HEADER SECTION                                                     */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <header
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '1.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
              }}
            >
              <LayoutDashboard size={22} />
            </div>
            <div>
              <h1 className="page-title" style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800 }}>
                Admin Dashboard
              </h1>
              <p className="page-subtitle" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Manage projects, defects, sprints, testers and approvals
              </p>
            </div>
          </div>
        </div>

        {/* Header Right: Live WS, Notifications, Admin Profile, Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          {/* WebSocket Live Indicator */}
          <div
            title={`WebSocket status: ${wsStatus}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '999px',
              backgroundColor: wsStatus === 'connected' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${wsStatus === 'connected' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: wsStatus === 'connected' ? '#10b981' : '#f59e0b',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: wsStatus === 'connected' ? '#10b981' : '#f59e0b',
                boxShadow: wsStatus === 'connected' ? '0 0 8px #10b981' : 'none',
              }}
            />
            <span>{wsStatus === 'connected' ? 'WebSocket Live' : wsStatus}</span>
          </div>


          {/* Notification Count Badge */}
          <Link
            to="/notifications"
            title="Notifications"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  borderRadius: '999px',
                  padding: '0.1rem 0.35rem',
                  minWidth: '18px',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(239,68,68,0.4)',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          {/* Admin Profile Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
            >
              {getInitials(currentUser?.full_name)}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentUser?.full_name || 'System Admin'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.68rem', color: '#f97316', fontWeight: 700 }}>ADMIN</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>• {currentUser?.email}</span>
              </div>
            </div>
          </div>

          {/* Refresh button */}
          <button
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 2. QUICK ACTIONS BAR                                                  */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '1.75rem',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.5rem' }}>
          Quick Actions:
        </span>
        <Link to="/projects" className="btn btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <PlusCircle size={15} /> Create Project
        </Link>
        <Link to="/admin/sprints" className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Layers size={15} /> Sprints &amp; Planning
        </Link>
        <Link to="/issues" className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Bug size={15} /> Issues &amp; Defects
        </Link>
        <Link to="/projects" className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <FolderGit2 size={15} /> Manage Projects
        </Link>
        <Link
          to="/admin/sprint-approvals"
          className="btn btn-secondary"
          style={{
            padding: '0.4rem 0.9rem',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderColor: awaitingApproval.length > 0 ? 'rgba(99,102,241,0.5)' : undefined,
            color: awaitingApproval.length > 0 ? '#818cf8' : undefined,
          }}
        >
          <ClipboardCheck size={15} />
          Review Approvals
          {awaitingApproval.length > 0 && (
            <span style={{ background: '#6366f1', color: '#fff', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 700 }}>
              {awaitingApproval.length}
            </span>
          )}
        </Link>
        <Link to="/analytics" className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
          <BarChart3 size={15} /> View Analytics
        </Link>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 3. KPI SECTION (8 Real Metrics)                                       */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <MetricCard
          label="Total Projects"
          value={stats.projects.total}
          icon={<FolderGit2 size={22} />}
          iconClass="icon-purple"
          subtitle={`${stats.projects.active} Active • ${stats.projects.inactive} Inactive`}
        />
        <MetricCard
          label="Total Issues"
          value={stats.issues.total.toLocaleString()}
          icon={<Bug size={22} />}
          iconClass="icon-blue"
          subtitle="Includes Kaggle ISEC dataset"
        />
        <MetricCard
          label="Open Issues"
          value={stats.issues.unresolved.toLocaleString()}
          icon={<AlertCircle size={22} />}
          iconClass="icon-orange"
          valueColor="var(--color-warning)"
          subtitle={`${resolutionRate}% Resolution Rate`}
        />
        <MetricCard
          label="Critical & Blocker"
          value={(stats.severity.critical + stats.severity.blocker).toLocaleString()}
          icon={<AlertTriangle size={22} />}
          iconClass="icon-red"
          valueColor="#ef4444"
          subtitle={`${stats.severity.blocker} Blocker • ${stats.severity.critical.toLocaleString()} Critical`}
        />
        <MetricCard
          label="Active Sprints"
          value={(stats.sprints?.active || 0) + (stats.sprints?.in_progress || 0)}
          icon={<PlayCircle size={22} />}
          iconClass="icon-green"
          subtitle={`${stats.sprints?.in_progress || 0} In Progress • ${stats.sprints?.active || 0} Active`}
        />
        <MetricCard
          label="Awaiting Approval"
          value={stats.sprints?.ready_for_approval || awaitingApproval.length}
          icon={<ClipboardCheck size={22} />}
          iconClass="icon-blue"
          valueColor={awaitingApproval.length > 0 ? '#818cf8' : undefined}
          badge={awaitingApproval.length > 0 ? 'ACTION NEEDED' : undefined}
          badgeColor="#6366f1"
          subtitle={awaitingApproval.length > 0 ? 'Admin Review Pending' : 'All Sprints Reviewed'}
        />
        <MetricCard
          label="Completed Sprints"
          value={stats.sprints?.completed || 0}
          icon={<CheckCircle2 size={22} />}
          iconClass="icon-green"
          subtitle={`${stats.sprints?.archived || 0} Archived`}
        />
        <MetricCard
          label="Backlog Issues"
          value={(stats.backlog?.total || 0).toLocaleString()}
          icon={<Layers size={22} />}
          iconClass="icon-cyan"
          subtitle={`${(stats.backlog?.unassigned || 0).toLocaleString()} Unassigned`}
        />
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 4. MAIN "TRACEPILOT PROCESS" SECTION (Visual Centerpiece)            */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <section
        className="card"
        style={{
          marginBottom: '2.5rem',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          className="card-header"
          style={{
            borderBottom: '1px solid var(--border-subtle)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'rgba(99,102,241,0.2)',
                  color: '#818cf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUp size={16} />
              </div>
              <h2 className="card-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                TracePilot Complete Process Lifecycle
              </h2>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              End-to-end defect workflow from submission, backlog management, sprint testing, to admin review and closure.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(14,165,233,0.15)', color: '#38bdf8', fontWeight: 600 }}>USER / IMPORT</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600 }}>ADMIN PLAN & REVIEW</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontWeight: 600 }}>DEVELOPER EXECUTION</span>
          </div>
        </div>

        <div className="card-body" style={{ padding: '1.75rem 1.5rem' }}>
          {/* Workflow Diagram Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              position: 'relative',
            }}
          >
            {/* Step 1 */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(14,165,233,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  STEP 1
                </span>
                <Users size={15} style={{ color: '#38bdf8' }} />
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                User / Dataset
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.3 }}>
                Bugs reported by users or imported from Kaggle ISEC dataset.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>
                10,000+ Real Bugs
              </div>
            </div>

            {/* Step 2 */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  STEP 2
                </span>
                <Bug size={15} style={{ color: '#f59e0b' }} />
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                Bug / Defect
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.3 }}>
                Severity & Smart Priority calculated via mentor formula.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
                {stats.issues.total.toLocaleString()} Total Logged
              </div>
            </div>

            {/* Step 3 */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#06b6d4', background: 'rgba(6,182,212,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  STEP 3
                </span>
                <Layers size={15} style={{ color: '#06b6d4' }} />
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                Backlog Queue
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.3 }}>
                Unassigned bugs waiting to be scheduled into sprints.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: '#06b6d4', fontWeight: 600 }}>
                {(stats.backlog?.total || 0).toLocaleString()} Backlog Items
              </div>
            </div>

            {/* Step 4 */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#818cf8', background: 'rgba(99,102,241,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  STEP 4 [ADMIN]
                </span>
                <PlusCircle size={15} style={{ color: '#818cf8' }} />
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                Create Sprint
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.3 }}>
                Admin plans sprint duration, goals, and working capacity.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: '#818cf8', fontWeight: 600 }}>
                Status: PLANNED ({stats.sprints?.planned || 0})
              </div>
            </div>

            {/* Step 5 */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#818cf8', background: 'rgba(99,102,241,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  STEP 5 [ADMIN]
                </span>
                <Bug size={15} style={{ color: '#818cf8' }} />
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                Add Bugs to Sprint
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.3 }}>
                Selects existing backlog issues to include in sprint scope.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: '#818cf8', fontWeight: 600 }}>
                Sprint Backlog Defined
              </div>
            </div>

            {/* Step 6 */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#818cf8', background: 'rgba(99,102,241,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  STEP 6 [ADMIN]
                </span>
                <UserCheck size={15} style={{ color: '#818cf8' }} />
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                Assign Tester & Start
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.3 }}>
                Assigns designated QA tester. Moves sprint to ACTIVE.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                Status: ACTIVE ({stats.sprints?.active || 0})
              </div>
            </div>

            {/* Step 7 */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#34d399', background: 'rgba(16,185,129,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  STEP 7 [DEVELOPER]
                </span>
                <PlayCircle size={15} style={{ color: '#34d399' }} />
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                Tester Begins Work
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.3 }}>
                Tester clicks "Begin Work". Moves sprint to IN_PROGRESS.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
                Status: IN_PROGRESS ({stats.sprints?.in_progress || 0})
              </div>
            </div>

            {/* Step 8 */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#34d399', background: 'rgba(16,185,129,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  STEP 8 [DEVELOPER]
                </span>
                <Activity size={15} style={{ color: '#34d399' }} />
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                Work on Issues
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.3 }}>
                Tester investigates defects, updates status, and verifies fixes.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
                Test Execution Active
              </div>
            </div>

            {/* Step 9 */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid rgba(99,102,241,0.4)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#818cf8', background: 'rgba(99,102,241,0.25)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  STEP 9 [DEVELOPER]
                </span>
                <ClipboardCheck size={15} style={{ color: '#818cf8' }} />
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                Submit for Approval
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.3 }}>
                Tester submits sprint once testing scope is satisfied.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: '#818cf8', fontWeight: 600 }}>
                READY_FOR_APPROVAL ({stats.sprints?.ready_for_approval || 0})
              </div>
            </div>
          </div>

          {/* Decision Split: Admin Review */}
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <Shield size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Step 10: Admin Review Gateway & Final Decision
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {/* Branch A: Approve */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--success-subtle)',
                  border: '1px solid var(--success)',
                  borderLeft: '4px solid var(--success)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                  <strong style={{ color: 'var(--success)', fontSize: '0.9rem' }}>Decision 1: APPROVE SPRINT</strong>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                  Admin verifies test completion and approves. Sprint transitions to <strong>COMPLETED</strong>.
                </p>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>
                  Result: COMPLETED ({stats.sprints?.completed || 0} sprints completed to date)
                </div>
              </div>

              {/* Branch B: Request Changes */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--warning-subtle)',
                  border: '1px solid var(--warning)',
                  borderLeft: '4px solid var(--warning)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <RotateCcw size={18} style={{ color: 'var(--warning)' }} />
                  <strong style={{ color: 'var(--warning)', fontSize: '0.9rem' }}>Decision 2: REQUEST CHANGES</strong>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                  Admin specifies feedback in comment modal. Sprint returns to <strong>IN_PROGRESS</strong> for tester rework.
                </p>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>
                  Result: Returns to IN_PROGRESS → Tester fixes → Resubmit for Admin review
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 5. SPRINT STATUS PIPELINE                                             */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: '2.5rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} style={{ color: 'var(--primary)' }} />
              Sprint Status Pipeline
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Real-time sprint distribution across lifecycle phases
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Total: <strong>{totalPipelineSprints}</strong> Sprints
            </span>
            <Link to="/admin/sprints" className="btn btn-secondary btn-sm" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={14} /> Sprints &amp; Planning
            </Link>
          </div>
        </div>

        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
            {/* Planned */}
            <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>PLANNED</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {totalPipelineSprints > 0 ? Math.round(((stats.sprints?.planned || 0) / totalPipelineSprints) * 100) : 0}%
                </span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                {stats.sprints?.planned || 0}
              </div>
              <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalPipelineSprints > 0 ? ((stats.sprints?.planned || 0) / totalPipelineSprints) * 100 : 0}%`, backgroundColor: '#64748b' }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'block' }}>
                Awaiting tester assignment
              </span>
            </div>

            {/* Active */}
            <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>ACTIVE</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {totalPipelineSprints > 0 ? Math.round(((stats.sprints?.active || 0) / totalPipelineSprints) * 100) : 0}%
                </span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#3b82f6', marginBottom: '0.4rem' }}>
                {stats.sprints?.active || 0}
              </div>
              <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalPipelineSprints > 0 ? ((stats.sprints?.active || 0) / totalPipelineSprints) * 100 : 0}%`, backgroundColor: '#3b82f6' }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'block' }}>
                Assigned; pending tester kickoff
              </span>
            </div>

            {/* In Progress */}
            <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>IN_PROGRESS</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {totalPipelineSprints > 0 ? Math.round(((stats.sprints?.in_progress || 0) / totalPipelineSprints) * 100) : 0}%
                </span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', marginBottom: '0.4rem' }}>
                {stats.sprints?.in_progress || 0}
              </div>
              <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalPipelineSprints > 0 ? ((stats.sprints?.in_progress || 0) / totalPipelineSprints) * 100 : 0}%`, backgroundColor: '#f59e0b' }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'block' }}>
                Tester actively verifying defects
              </span>
            </div>

            {/* Ready For Approval - Highlighted */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: awaitingApproval.length > 0 ? 'rgba(99,102,241,0.12)' : 'var(--bg-surface-elevated)',
                border: awaitingApproval.length > 0 ? '2px solid #818cf8' : '1px solid var(--border-subtle)',
                boxShadow: awaitingApproval.length > 0 ? '0 0 16px rgba(99,102,241,0.25)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#818cf8' }}>
                  READY_FOR_APPROVAL
                </span>
                {awaitingApproval.length > 0 && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fff', background: '#6366f1', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                    ACTION REQUIRED
                  </span>
                )}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#818cf8', marginBottom: '0.4rem' }}>
                {stats.sprints?.ready_for_approval || awaitingApproval.length}
              </div>
              <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalPipelineSprints > 0 ? ((stats.sprints?.ready_for_approval || 0) / totalPipelineSprints) * 100 : 0}%`, backgroundColor: '#818cf8' }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: awaitingApproval.length > 0 ? '#818cf8' : 'var(--text-muted)', fontWeight: awaitingApproval.length > 0 ? 600 : 400, marginTop: '0.4rem', display: 'block' }}>
                {awaitingApproval.length > 0 ? 'Admin decision required!' : 'All submissions resolved'}
              </span>
            </div>

            {/* Completed */}
            <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>COMPLETED</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {totalPipelineSprints > 0 ? Math.round(((stats.sprints?.completed || 0) / totalPipelineSprints) * 100) : 0}%
                </span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginBottom: '0.4rem' }}>
                {stats.sprints?.completed || 0}
              </div>
              <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalPipelineSprints > 0 ? ((stats.sprints?.completed || 0) / totalPipelineSprints) * 100 : 0}%`, backgroundColor: '#10b981' }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'block' }}>
                Approved and finalized
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 6. ROLE RESPONSIBILITY CARD                                           */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}
      >
        {/* Admin Card */}
        <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid rgba(99,102,241,0.25)', borderTop: '4px solid #6366f1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Shield size={18} style={{ color: '#818cf8' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>ADMIN</h3>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>• <strong>Manage:</strong> Oversee projects, members & permissions</div>
            <div>• <strong>Plan:</strong> Create sprint milestones & capacity</div>
            <div>• <strong>Assign:</strong> Designate dedicated QA testers to sprints</div>
            <div>• <strong>Monitor:</strong> Live velocity, burndown & defect health</div>
            <div>• <strong>Review & Decide:</strong> Approve sprint or request rework</div>
          </div>
        </div>

        {/* Tester Card */}
        <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid rgba(16,185,129,0.25)', borderTop: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <UserCheck size={18} style={{ color: '#34d399' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>DEVELOPER</h3>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>• <strong>Begin Work:</strong> Kick off assigned ACTIVE sprints</div>
            <div>• <strong>Work Issues:</strong> Validate fixes, retest, and update statuses</div>
            <div>• <strong>Submit:</strong> Request admin approval upon testing completion</div>
            <div>• <strong>Rework:</strong> Address admin feedback when changes requested</div>
          </div>
        </div>

        {/* User Card */}
        <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid rgba(14,165,233,0.25)', borderTop: '4px solid #0ea5e9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Users size={18} style={{ color: '#38bdf8' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>USER</h3>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>• <strong>Report:</strong> Submit defect tickets with reproducible steps</div>
            <div>• <strong>Track:</strong> Follow defect lifecycle from triage to resolution</div>
            <div>• <strong>Verify:</strong> Confirm resolution in production environments</div>
          </div>
        </div>

        {/* System Card */}
        <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderTop: '4px solid #64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Activity size={18} style={{ color: '#94a3b8' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>SYSTEM</h3>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>• <strong>WebSockets:</strong> Instant notifications and real-time updates</div>
            <div>• <strong>Audit Logs:</strong> Immutable tracking for all entity operations</div>
            <div>• <strong>Smart Priority:</strong> Automated Severity × Urgency score</div>
            <div>• <strong>PostgreSQL:</strong> ACIDS transactional persistence with 10k Kaggle bugs</div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 7. SPRINTS AWAITING APPROVAL (High-Priority Action Section)           */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <section
        id="approvals-section"
        className="card"
        style={{
          marginBottom: '2.5rem',
          border: awaitingApproval.length > 0 ? '2px solid rgba(99,102,241,0.5)' : '1px solid var(--border-subtle)',
          boxShadow: awaitingApproval.length > 0 ? '0 8px 24px -4px rgba(99,102,241,0.2)' : 'none',
        }}
      >
        <div
          className="card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: awaitingApproval.length > 0 ? 'rgba(99,102,241,0.06)' : undefined,
          }}
        >
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: awaitingApproval.length > 0 ? '#818cf8' : undefined }}>
              <ClipboardCheck size={20} />
              Sprints Awaiting Admin Approval
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: awaitingApproval.length > 0 ? '#6366f1' : 'rgba(99,102,241,0.2)',
                  color: '#fff',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '12px',
                  marginLeft: '0.4rem',
                }}
              >
                {awaitingApproval.length}
              </span>
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Sprints submitted by testers requiring Admin review to complete or request changes
            </p>
          </div>
          <Link
            to="/admin/sprint-approvals"
            className="btn btn-primary btn-sm"
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ClipboardCheck size={14} /> Open Sprint Approvals
          </Link>
        </div>

        <div className="card-body">
          {awaitingApproval.length === 0 ? (
            <div className="empty-state" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'rgba(16,185,129,0.1)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                }}
              >
                <CheckCircle2 size={26} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                All Submitted Sprints Reviewed
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto' }}>
                There are no sprints currently waiting in <code>READY_FOR_APPROVAL</code> status. Sprints submitted by testers will automatically appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {awaitingApproval.map((sprint) => {
                const totalIssues = sprint.total_issues ?? 0;
                const completedIssues = sprint.completed_issues ?? 0;
                const pct = sprint.progress_percentage ?? (totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0);

                return (
                  <div
                    key={sprint.id}
                    style={{
                      padding: '1.25rem',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      background: 'var(--bg-surface-elevated)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {sprint.name}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                            READY_FOR_APPROVAL
                          </span>
                          {sprint.project_name && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Project: <strong style={{ color: 'var(--text-secondary)' }}>{sprint.project_name}</strong>
                            </span>
                          )}
                        </div>

                        {sprint.goal && (
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                            {sprint.goal}
                          </p>
                        )}

                        <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>
                            Assigned Tester: <strong style={{ color: '#34d399' }}>{sprint.assigned_tester_name || '—'}</strong>
                          </span>
                          <span>
                            Start: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(sprint.start_date)}</strong>
                          </span>
                          <span>
                            End: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(sprint.end_date)}</strong>
                          </span>
                          {sprint.submitted_at && (
                            <span>
                              Submitted: <strong style={{ color: 'var(--text-primary)' }}>{formatRelativeTime(sprint.submitted_at)}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.6rem', flexShrink: 0 }}>
                        <Link
                          to={`/projects/${sprint.project_id}/sprints`}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                        >
                          <ExternalLink size={14} /> View Sprint
                        </Link>
                        <button
                          className="btn btn-success btn-sm"
                          disabled={sprintActionLoading === sprint.id}
                          onClick={() => handleApproveSprint(sprint.id)}
                          style={{ fontSize: '0.8rem', padding: '0.45rem 0.95rem', fontWeight: 600 }}
                          title="Approve Sprint → Transitions to COMPLETED"
                        >
                          <ThumbsUp size={14} /> Approve Sprint
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={sprintActionLoading === sprint.id}
                          onClick={() => {
                            setRequestChangesSprintId(sprint.id);
                            setRequestChangesComment('');
                          }}
                          style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                          title="Request changes → Returns to IN_PROGRESS"
                        >
                          <RotateCcw size={14} /> Request Changes
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Issue Completion Progress: <strong>{completedIssues} / {totalIssues}</strong> issues completed
                        </span>
                        <span style={{ fontWeight: 700, color: pct >= 80 ? '#10b981' : '#f59e0b' }}>
                          {pct}%
                        </span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '4px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: pct >= 80 ? '#10b981' : '#f59e0b',
                            borderRadius: '4px',
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 8. ACTIVE SPRINTS SECTION                                             */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: '2.5rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PlayCircle size={18} style={{ color: '#10b981' }} />
              Active &amp; In-Progress Sprints
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Currently running sprints being worked on by assigned testers
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing <strong>{activeSprints.length}</strong> active sprints
            </span>
            <Link to="/admin/sprints" className="btn btn-secondary btn-sm" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={14} /> Sprints &amp; Planning
            </Link>
          </div>
        </div>

        <div className="card-body">
          {activeSprints.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              <PlayCircle size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No active sprints in progress. Start planned sprints from project management.
              </p>
            </div>
          ) : (
            <div className="table-container" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sprint Name</th>
                    <th>Project</th>
                    <th>Assigned Tester</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSprints.slice(0, 10).map((s) => {
                    const totalIssues = s.total_issues ?? 0;
                    const completedIssues = s.completed_issues ?? 0;
                    const pct = s.progress_percentage ?? (totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0);

                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700 }}>{s.name}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {s.project_name || `Project #${s.project_id}`}
                        </td>
                        <td>
                          {s.assigned_tester_name ? (
                            <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>
                              {s.assigned_tester_name}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unassigned</span>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: s.status === 'IN_PROGRESS' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                              color: s.status === 'IN_PROGRESS' ? '#f59e0b' : '#10b981',
                            }}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td style={{ minWidth: '120px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct >= 75 ? '#10b981' : '#3b82f6', borderRadius: '3px' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(s.start_date)}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(s.end_date)}</td>
                        <td>
                          <Link
                            to={`/projects/${s.project_id}/sprints`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            Manage
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 9. BACKLOG & DEFECT OVERVIEW                                          */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: '2.5rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} style={{ color: '#06b6d4' }} />
              Backlog &amp; Defect Repository Overview
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Defects stored in PostgreSQL backlog available for sprint inclusion
            </p>
          </div>
          <Link to="/issues" className="btn btn-secondary btn-sm" style={{ fontSize: '0.8rem' }}>
            <ExternalLink size={14} /> Open Backlog
          </Link>
        </div>

        <div className="card-body">
          {/* Kaggle ISEC Banner */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(6,182,212,0.08)',
              border: '1px solid rgba(6,182,212,0.25)',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Sparkles size={20} style={{ color: '#06b6d4' }} />
              <div>
                <strong style={{ color: '#22d3ee', fontSize: '0.88rem' }}>
                  Kaggle ISEC Real Defect Dataset Active
                </strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {stats.backlog?.kaggle_count ? stats.backlog.kaggle_count.toLocaleString() : '10,000'} Mozilla Bugzilla defect records imported and indexed in PostgreSQL as backlog items.
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '999px', background: 'rgba(6,182,212,0.2)', color: '#22d3ee' }}>
              PROJECT KEY: ISEC
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Backlog Issues</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {(stats.backlog?.total || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block' }}>
                sprint_id IS NULL
              </span>
            </div>

            <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unassigned Bugs</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.25rem' }}>
                {(stats.backlog?.unassigned || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block' }}>
                assignee_id IS NULL
              </span>
            </div>

            <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Critical / Blocker Backlog</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>
                {(stats.backlog?.critical || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block' }}>
                CRITICAL / BLOCKER severity
              </span>
            </div>

            <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>High / Urgent Backlog</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f97316', marginTop: '0.25rem' }}>
                {(stats.backlog?.high_priority || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block' }}>
                Smart Priority HIGH / URGENT
              </span>
            </div>

            <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Resolved in Backlog</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                {(stats.backlog?.resolved || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block' }}>
                Status: RESOLVED
              </span>
            </div>

            <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Closed in Backlog</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#64748b', marginTop: '0.25rem' }}>
                {(stats.backlog?.closed || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block' }}>
                Status: CLOSED
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 10. ANALYTICS WORKSPACE CALLOUT                                       */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          marginBottom: '2.5rem',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(99,102,241,0.2)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChart3 size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Deep Analytics &amp; Reporting Workspace
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Explore MTTR, Fix Rate, Defect Leakage, Plotly interactive charts, and export PDF/CSV audit reports in the dedicated Analytics page.
            </p>
          </div>
        </div>
        <Link
          to="/analytics"
          className="btn btn-primary"
          style={{ fontSize: '0.82rem', padding: '0.5rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
        >
          <BarChart3 size={15} /> Open Analytics Workspace
        </Link>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 11. DUAL COLUMN: QUEUE + WORKLOAD vs HEALTH & AUDIT                   */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', marginTop: '2rem', alignItems: 'start' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Unassigned Issue Queue */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                Unassigned Issue Queue
              </h2>
            </div>
            {unassignedQueue.length === 0 ? (
              <div className="card-body empty-state">
                <CheckCircle2 size={32} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
                <h3>Queue is Empty</h3>
                <p>There are no unassigned issues awaiting action.</p>
              </div>
            ) : (
              <div className="table-container" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Title</th>
                      <th>Priority</th>
                      <th>Severity</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unassignedQueue.map((issue) => (
                      <tr key={issue.id}>
                        <td style={{ fontWeight: '600' }}>{issue.issue_key}</td>
                        <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={issue.title}>
                          {issue.title}
                        </td>
                        <td><PriorityBadge priority={issue.priority} /></td>
                        <td><SeverityBadge severity={issue.severity} /></td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {formatRelativeTime(issue.created_at)}
                        </td>
                        <td>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => openAssignModal(issue.id)}
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Team Workload */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} />
                Team Workload (Testers)
              </h2>
            </div>
            {workloads.length === 0 ? (
              <div className="card-body empty-state">
                <p>No workload data available.</p>
              </div>
            ) : (
              <div className="table-container" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0, maxHeight: '420px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-surface-raised, #182234)' }}>
                    <tr>
                      <th>Name</th>
                      <th>Assigned</th>
                      <th>In Progress</th>
                      <th>Resolved</th>
                      <th>Res. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workloads.map((w) => {
                      const totalActive = w.open_issues;
                      const isHighLoad = totalActive > 10;
                      return (
                        <tr key={w.developer_id} style={{ background: isHighLoad ? 'rgba(239,68,68,0.05)' : undefined }}>
                          <td style={{ fontWeight: '500' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <span>{w.developer_name}</span>
                              {isHighLoad && (
                                <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: '600', padding: '0.1rem 0.3rem', border: '1px solid #ef4444', borderRadius: '4px' }}>
                                  HIGH LOAD
                                </span>
                              )}
                            </div>
                          </td>
                          <td>{w.assigned_issues}</td>
                          <td>{w.open_issues}</td>
                          <td>{w.resolved_issues}</td>
                          <td>
                            <span style={{ fontWeight: '600', color: w.resolution_rate >= 75 ? 'var(--color-success)' : 'inherit' }}>
                              {Math.round(w.resolution_rate)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent Admin Activity Timeline */}
          <section className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: 'var(--primary)' }} />
                Recent System &amp; Admin Activity
              </h2>
              <Link to="/admin" className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>
                View All Logs
              </Link>
            </div>
            {auditLogs.length === 0 ? (
              <div className="card-body empty-state">
                <p>No recent activity found.</p>
              </div>
            ) : (
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      gap: '0.85rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(99,102,241,0.15)',
                        color: '#818cf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Activity size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.84rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{log.actor?.full_name || 'System'}</strong>{' '}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({log.actor?.role || 'SYSTEM'})</span>{' '}
                        <span style={{ color: '#818cf8', fontWeight: 600 }}>{log.action}</span>{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>{log.entity_type}</strong>{' '}
                        {log.entity_key && <code style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{log.entity_key}</code>}
                      </p>
                      {log.description && (
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {log.description}
                        </p>
                      )}
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                        {formatRelativeTime(log.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Health, Alerts, User Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Health Score Card */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderLeft: `4px solid ${healthScore > 80 ? '#22c55e' : healthScore > 50 ? '#f59e0b' : '#ef4444'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HeartPulse size={20} style={{ color: healthScore > 80 ? '#22c55e' : healthScore > 50 ? '#f59e0b' : '#ef4444' }} />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Platform Health
                </h3>
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: healthScore > 80 ? '#22c55e' : healthScore > 50 ? '#f59e0b' : '#ef4444' }}>
                {healthScore} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 100</span>
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
              Calculated dynamically from defect resolution rates, open blockers, and reopen frequencies.
            </p>
          </div>

          {/* System Alerts */}
          <section className="card" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="card-header">
              <h2 className="card-title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} />
                System Alerts
              </h2>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stats.severity.blocker > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.1)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid #ef4444' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: '#ef4444' }}>
                    {stats.severity.blocker} Open Blocker Issues
                  </p>
                </div>
              )}
              {stats.issues.reopened > 0 && (
                <div style={{ background: 'rgba(245,158,11,0.1)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid #f59e0b' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: '#f59e0b' }}>
                    {stats.issues.reopened} Reopened Issues
                  </p>
                </div>
              )}
              {inactiveAssignees.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.1)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid #ef4444' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: '#ef4444' }}>
                    {inactiveAssignees.length} Inactive Users with Assignments
                  </p>
                  <ul style={{ margin: '0.4rem 0 0 1rem', padding: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {inactiveAssignees.slice(0, 3).map((u) => (
                      <li key={u.user_id}>{u.full_name} ({u.assigned_issues_count} issues)</li>
                    ))}
                    {inactiveAssignees.length > 3 && <li>And {inactiveAssignees.length - 3} more...</li>}
                  </ul>
                </div>
              )}
              {stats.severity.blocker === 0 && stats.issues.reopened === 0 && inactiveAssignees.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No critical alerts.</p>
              )}
            </div>
          </section>

          {/* User Breakdown */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} />
                User Breakdown
              </h2>
            </div>
            <div className="card-body">
              <BarRow label="Users" count={stats.users.users} total={stats.users.total} color="#3b82f6" />
              <BarRow label="Testers" count={stats.users.testers} total={stats.users.total} color="#22c55e" />
              <BarRow label="Admins" count={stats.users.admins} total={stats.users.total} color="#f97316" />

              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Active Users</span>
                  <span style={{ fontWeight: 600 }}>{stats.users.active}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Inactive Users</span>
                  <span style={{ fontWeight: 600, color: stats.users.inactive > 0 ? '#ef4444' : 'inherit' }}>
                    {stats.users.inactive}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Issue Severity Distribution */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bug size={18} />
                Issue Health by Severity
              </h2>
            </div>
            <div className="card-body">
              <BarRow label="Blocker" count={stats.severity.blocker} total={stats.issues.total} color="#ef4444" />
              <BarRow label="Critical" count={stats.severity.critical} total={stats.issues.total} color="#f97316" />
              <BarRow label="Major" count={stats.severity.major} total={stats.issues.total} color="#f59e0b" />
              <BarRow label="Minor" count={stats.severity.minor} total={stats.issues.total} color="#3b82f6" />
            </div>
          </section>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 12. MODALS                                                            */}
      {/* ───────────────────────────────────────────────────────────────────── */}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* NEW: ADMIN ACTION CENTER                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AdminActionCenter
        awaitingApproval={awaitingApproval}
        activeSprints={activeSprints}
        criticalCount={stats.severity.critical + stats.severity.blocker}
        reopenedCount={stats.issues.reopened}
        unassignedCount={stats.backlog?.unassigned || 0}
      />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* NEW: SYSTEM HEALTH + PERFORMANCE SUMMARY (2-col row)                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <AdminSystemHealth stats={stats} />
        <AdminPerformanceSummary stats={stats} quality={qualityMetrics} />
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* NEW: DEFECT TREND ANALYTICS                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AdminDefectTrend />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* NEW: ISSUE DISTRIBUTION (full width)                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <AdminIssueDistribution stats={stats} />
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* NEW: SPRINT HEALTH + APPROVAL CENTER (2-col row)                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <AdminSprintHealth sprints={activeSprints} />
        <AdminApprovalCenter awaitingApproval={awaitingApproval} recentlyCompleted={recentlyCompleted} />
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* NEW: PROJECT HEALTH                                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AdminProjectHealth />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* NEW: TEAM WORKLOAD                                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AdminTeamWorkload workloads={workloads} />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* NEW: RECENT SYSTEM ACTIVITY                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AdminRecentActivity auditLogs={auditLogs} />


            {/* Assign Tester Modal */}
      <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Tester to Issue">
        <div style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Select a tester to assign this issue to. Workloads are shown for available testers.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {testers.map((tester) => {
              const wl = workloads.find((w) => w.developer_id === tester.id);
              const activeLoad = wl ? wl.open_issues : 0;
              return (
                <div
                  key={tester.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {tester.full_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Active Load: {activeLoad} issues
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.4rem 1rem' }}
                    disabled={assigning}
                    onClick={() => handleAssign(tester.id)}
                  >
                    Select
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Request Changes Modal */}
      <Modal
        isOpen={requestChangesSprintId !== null}
        onClose={() => {
          setRequestChangesSprintId(null);
          setRequestChangesComment('');
        }}
        title="Request Changes on Sprint"
      >
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          The sprint will be sent back to the assigned tester with status <strong>IN_PROGRESS</strong>.
        </p>
        <div className="form-group">
          <label className="form-label">Feedback / Revision Reason (optional)</label>
          <textarea
            className="form-textarea"
            rows={4}
            value={requestChangesComment}
            onChange={(e) => setRequestChangesComment(e.target.value)}
            placeholder="Describe what tests or defect fixes need further rework..."
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setRequestChangesSprintId(null);
              setRequestChangesComment('');
            }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={sprintActionLoading !== null}
            onClick={handleRequestChanges}
          >
            Send Back to Tester
          </button>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            background: 'var(--bg-surface-elevated)',
            border: `1px solid ${toastMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
            padding: '0.9rem 1.25rem',
            borderRadius: '10px',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            zIndex: 9999,
          }}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          ) : (
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
          )}
          <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {toastMessage.text}
          </span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', marginLeft: '0.5rem' }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

