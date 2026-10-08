/**
 * AdminDashboardPage — Simplified Operational Admin Dashboard.
 *
 * PURPOSE:
 * Operational command center answering: "What requires my attention right now?"
 *
 * LAYOUT:
 * 1. Header (Live status, notifications, admin profile, refresh)
 * 2. Quick Actions (Create Project, Sprints, Issues, Manage Projects, Approvals, Analytics)
 * 3. KPI Summary (Exactly 7 cards: Total Projects, Total Issues, Open Issues, Critical/Blocker, Active Sprints, Awaiting Approval, Unassigned Backlog)
 * 4. Admin Priority Queue (Actionable defect list near top)
 * 5. Issue Aging / Urgent Backlog (Compact key metrics) + Compact Pending Approvals Card (Side-by-side operational row)
 * 6. Compact Real-Time Activity (Latest operational events with "View All Activity" link)
 *
 * NON-OPERATIONAL / DETAILED SECTIONS RELOCATED TO DEDICATED PAGES:
 * - Detailed Sprint Health -> Sprints & Planning (/admin/sprints)
 * - Detailed Sprint Approval Center -> Sprint Approvals (/admin/sprint-approvals)
 * - Detailed Project Health -> Projects (/projects)
 * - Detailed Analytics -> Analytics (/analytics)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Bug,
  ClipboardCheck,
  FolderGit2,
  Layers,
  LayoutDashboard,
  PlayCircle,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';

import { adminApi } from '../api/admin';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { SprintService } from '../services/SprintService';
import { TracePilotWorkflowStepper } from '../components/dashboard/TracePilotWorkflowStepper';
import { AdminPriorityQueue } from '../components/admin/AdminPriorityQueue';
import { AdminIssueAgingMonitor } from '../components/admin/AdminIssueAgingMonitor';
import { AdminRealtimeActivity } from '../components/admin/AdminRealtimeActivity';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import type { AdminDashboardResponse } from '../types/admin';
import type { Sprint } from '../types/Sprint';

// -----------------------------------------------------------------------------
// Metric Card Component
// -----------------------------------------------------------------------------

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
    <div className="metric-info" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span className="metric-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {label}
        </span>
        {badge && (
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '0.12rem 0.4rem',
              borderRadius: '999px',
              backgroundColor: badgeColor || 'var(--primary-color, #6366f1)',
              color: '#fff',
              letterSpacing: '0.03em',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div
        className="metric-value"
        style={{
          fontSize: '1.65rem',
          fontWeight: 800,
          color: valueColor || 'var(--text-primary)',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {subtitle && (
        <span className="metric-subtitle" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
          {subtitle}
        </span>
      )}
    </div>
    <div className={`metric-icon ${iconClass}`} style={{ flexShrink: 0 }}>
      {icon}
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// AdminDashboardPage Main Component
// -----------------------------------------------------------------------------

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { unreadCount, wsStatus, notifications: liveNotifications } = useNotifications();

  // Dashboard Stats
  const [stats, setStats] = useState<AdminDashboardResponse | null>(null);
  const [awaitingApproval, setAwaitingApproval] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Fetch core operational stats
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [dashboardStats, pendingSprints] = await Promise.all([
        adminApi.getDashboard(),
        SprintService.getAwaitingApprovalSprints().catch(() => []),
      ]);

      setStats(dashboardStats);
      setAwaitingApproval(pendingSprints || []);
      setRefreshCounter((c) => c + 1);
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

  // Real-time WebSocket synchronization
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

  useEffect(() => {
    if (wsStatus === 'connected') {
      fetchData(true);
    }
  }, [wsStatus, fetchData]);

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

  // Resolution rate calculation
  const resolutionRate = useMemo(() => {
    if (!stats || stats.issues.total === 0) return 0;
    return Math.round(((stats.issues.resolved + stats.issues.closed) / stats.issues.total) * 100);
  }, [stats]);

  const getInitials = (name?: string) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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

  return (
    <div className="page-container" style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '2.5rem' }}>
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
          marginBottom: '1.5rem',
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
                Operational command center — Defects, priority queue, approvals &amp; live activity
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
          marginBottom: '1.5rem',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginRight: '0.25rem',
          }}
        >
          Quick Actions:
        </span>
        <Link
          to="/projects"
          className="btn btn-primary"
          style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <PlusCircle size={15} /> Create Project
        </Link>
        <Link
          to="/admin/sprints"
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Layers size={15} /> Sprints &amp; Planning
        </Link>
        <Link
          to="/issues"
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Bug size={15} /> Issues &amp; Defects
        </Link>
        <Link
          to="/projects"
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
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
            <span
              style={{
                background: '#6366f1',
                color: '#fff',
                fontSize: '0.7rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '999px',
                fontWeight: 700,
              }}
            >
              {awaitingApproval.length}
            </span>
          )}
        </Link>
        <Link
          to="/analytics"
          className="btn btn-secondary"
          style={{
            padding: '0.4rem 0.9rem',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginLeft: 'auto',
          }}
        >
          <BarChart3 size={15} /> View Analytics
        </Link>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 3. KPI SUMMARY (Exactly 7 Compact Cards)                              */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div
        className="metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        {/* 1. Total Projects */}
        <MetricCard
          label="Total Projects"
          value={stats.projects.total}
          icon={<FolderGit2 size={20} />}
          iconClass="icon-purple"
          subtitle={`${stats.projects.active} Active • ${stats.projects.inactive} Inactive`}
          onClick={() => navigate('/projects')}
        />

        {/* 2. Total Issues */}
        <MetricCard
          label="Total Issues"
          value={stats.issues.total.toLocaleString()}
          icon={<Bug size={20} />}
          iconClass="icon-blue"
          subtitle="Includes Kaggle ISEC dataset"
          onClick={() => navigate('/issues')}
        />

        {/* 3. Open Issues */}
        <MetricCard
          label="Open Issues"
          value={stats.issues.unresolved.toLocaleString()}
          icon={<AlertCircle size={20} />}
          iconClass="icon-orange"
          valueColor="var(--color-warning, #f59e0b)"
          subtitle={`${resolutionRate}% Resolution Rate`}
          onClick={() => navigate('/issues?status=REPORTED')}
        />

        {/* 4. Critical & Blocker */}
        <MetricCard
          label="Critical & Blocker"
          value={(stats.severity.critical + stats.severity.blocker).toLocaleString()}
          icon={<AlertTriangle size={20} />}
          iconClass="icon-red"
          valueColor="#ef4444"
          subtitle={`${stats.severity.blocker} Blocker • ${stats.severity.critical.toLocaleString()} Critical`}
          onClick={() => navigate('/issues?severity=CRITICAL')}
        />

        {/* 5. Active Sprints */}
        <MetricCard
          label="Active Sprints"
          value={(stats.sprints?.active || 0) + (stats.sprints?.in_progress || 0)}
          icon={<PlayCircle size={20} />}
          iconClass="icon-green"
          subtitle={`${stats.sprints?.in_progress || 0} In Progress • ${stats.sprints?.active || 0} Active`}
          onClick={() => navigate('/admin/sprints')}
        />

        {/* 6. Awaiting Approval */}
        <MetricCard
          label="Awaiting Approval"
          value={awaitingApproval.length || (stats.sprints?.ready_for_approval || 0)}
          icon={<ClipboardCheck size={20} />}
          iconClass="icon-blue"
          valueColor={awaitingApproval.length > 0 ? '#818cf8' : undefined}
          badge={awaitingApproval.length > 0 ? 'ACTION REQUIRED' : undefined}
          badgeColor="#6366f1"
          subtitle={awaitingApproval.length > 0 ? 'Admin Review Pending' : 'All Sprints Reviewed'}
          onClick={() => navigate('/admin/sprint-approvals')}
        />

        {/* 7. Unassigned Backlog */}
        <MetricCard
          label="Unassigned Backlog"
          value={(stats.backlog?.unassigned || 0).toLocaleString()}
          icon={<Layers size={20} />}
          iconClass="icon-cyan"
          valueColor="#9333ea"
          subtitle={`Of ${(stats.backlog?.total || 0).toLocaleString()} Total Backlog`}
          onClick={() => navigate('/issues?unassigned=true')}
        />
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 3B. TRACEPILOT DEFECT RESOLUTION WORKFLOW                             */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <TracePilotWorkflowStepper />

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 4. ADMIN PRIORITY QUEUE (Immediate Attention Actionable Queue)       */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <AdminPriorityQueue
          onAssignSuccess={() => fetchData(true)}
          refreshTrigger={refreshCounter}
        />
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 5 & 6. OPERATIONAL ROW: ISSUE AGING + COMPACT PENDING APPROVALS        */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem',
          marginBottom: '1.75rem',
          alignItems: 'stretch',
        }}
      >
        {/* Compact Issue Aging Monitor */}
        <AdminIssueAgingMonitor
          compact={true}
          refreshTrigger={refreshCounter}
        />

        {/* Compact Pending Approvals Summary Card */}
        <div
          className="card admin-dashboard-card"
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            background: 'var(--card-bg, #ffffff)',
            border: awaitingApproval.length > 0 ? '1px solid rgba(99,102,241,0.35)' : '1px solid var(--border-subtle, #e2e8f0)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(99,102,241,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6366f1',
                  }}
                >
                  <ClipboardCheck size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Pending Approvals
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Sprint sign-off and completion review
                  </p>
                </div>
              </div>
              {awaitingApproval.length > 0 ? (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    background: 'rgba(99,102,241,0.12)',
                    color: '#4f46e5',
                    border: '1px solid rgba(99,102,241,0.25)',
                    letterSpacing: '0.03em',
                  }}
                >
                  ACTION REQUIRED
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    background: 'rgba(16,185,129,0.1)',
                    color: '#10b981',
                  }}
                >
                  ALL REVIEWED
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', margin: '0.75rem 0 0.4rem' }}>
              <div
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  color: awaitingApproval.length > 0 ? 'var(--primary-color, #4f46e5)' : 'var(--text-primary)',
                  lineHeight: 1,
                }}
              >
                {awaitingApproval.length}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {awaitingApproval.length === 1 ? 'sprint awaiting sign-off' : 'sprints awaiting sign-off'}
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.85rem', lineHeight: 1.4 }}>
              {awaitingApproval.length > 0
                ? `Developers have submitted ${awaitingApproval.length} sprint${awaitingApproval.length > 1 ? 's' : ''} for sign-off. Detailed inspection, issue reviews and approval are handled in Sprint Approvals.`
                : 'No sprints are currently waiting for admin sign-off. All active sprints are underway or completed.'}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {awaitingApproval.length > 0 ? 'Requires admin action' : 'Queue is clear'}
            </span>
            <Link
              to="/admin/sprint-approvals"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.8rem',
                borderRadius: '6px',
                background: awaitingApproval.length > 0 ? 'var(--primary-color, #4f46e5)' : 'var(--bg-surface)',
                color: awaitingApproval.length > 0 ? '#ffffff' : 'var(--text-primary)',
                border: awaitingApproval.length > 0 ? 'none' : '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                fontWeight: 600,
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Review Approvals
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 7. COMPACT REAL-TIME ACTIVITY                                         */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div>
        <AdminRealtimeActivity
          maxItems={6}
          refreshTrigger={refreshCounter}
        />
      </div>
    </div>
  );
};

export default AdminDashboardPage;
