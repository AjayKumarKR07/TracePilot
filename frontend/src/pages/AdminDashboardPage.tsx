/**
 * AdminDashboardPage — Upgraded Enterprise Admin Dashboard & Governance Center.
 *
 * DESIGN SYSTEM ALIGNMENT:
 * - Matches the visual language, typography, tokens, spacing, colors, and responsive layouts
 *   established by the upgraded User and Tester Dashboards.
 * - Header gradient container with user initials avatar, active session pulse, and role badge.
 * - Zero-layout-shift responsive loading skeleton (AdminDashboardSkeleton).
 * - Action toast notifications with dismiss buttons.
 *
 * 5 OPERATIONAL PILLARS:
 * 1. Overview: 6 core KPI cards, Action Center, Priority Queue, Issue Aging, Pending Sprint Approvals.
 * 2. User Management: Search, role filters, activation/deactivation safe confirmation, role changes.
 * 3. Project & Issue Management: Live project cards, defect filters, sorting, quick developer assign.
 * 4. Analytics & Workload: Status distribution, severity breakdown, 7d/30d/90d trends, team workload.
 * 5. Audit Activity: Real-time immutable audit trail from /activity with action filters.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  Bug,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FolderGit2,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

import { adminApi } from '../api/admin';
import { analyticsApi } from '../api/analytics';
import { SprintService } from '../services/SprintService';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { AdminActionCenter } from '../components/dashboard/AdminActionCenter';
import { AdminPriorityQueue } from '../components/admin/AdminPriorityQueue';
import { AdminIssueAgingMonitor } from '../components/admin/AdminIssueAgingMonitor';
import { AdminRealtimeActivity } from '../components/admin/AdminRealtimeActivity';
import { TracePilotWorkflowStepper } from '../components/dashboard/TracePilotWorkflowStepper';
import { AdminUserManagement } from '../components/admin/AdminUserManagement';
import { AdminProjectsAndIssues } from '../components/admin/AdminProjectsAndIssues';
import { AdminIssueDistribution } from '../components/dashboard/AdminIssueDistribution';
import { AdminDefectTrend } from '../components/dashboard/AdminDefectTrend';
import { AdminTeamWorkload } from '../components/dashboard/AdminTeamWorkload';
import { AdminProjectHealth } from '../components/dashboard/AdminProjectHealth';
import { AdminAuditActivity } from '../components/admin/AdminAuditActivity';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import type { AdminDashboardResponse, IssueAgingResponse } from '../types/admin';
import type { DeveloperAnalyticsItem } from '../types/analytics';
import type { Sprint } from '../types/Sprint';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AdminDashboardTab = 'overview' | 'users' | 'projects_issues' | 'analytics' | 'audit';

interface AdminDashboardPageProps {
  defaultTab?: AdminDashboardTab;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card Component (Matching User/Tester Design)
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
    className="metric-card tp-kpi-card"
    onClick={onClick}
    style={{
      padding: '0.95rem 1.15rem',
      borderRadius: '10px',
      backgroundColor: 'var(--card-bg, #ffffff)',
      border: badge ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-subtle, #e2e8f0)',
      cursor: onClick ? 'pointer' : undefined,
      transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
      minWidth: 0,
    }}
  >
    <div className="metric-info" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.25rem' }}>
        <span
          className="metric-label"
          title={label}
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            color: 'var(--text-secondary, #64748b)',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
        {badge && (
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '0.12rem 0.45rem',
              borderRadius: '999px',
              backgroundColor: badgeColor || 'var(--primary, #6366f1)',
              color: '#ffffff',
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              boxShadow: '0 1px 3px rgba(99,102,241,0.3)',
              flexShrink: 0,
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
          color: valueColor || 'var(--text-primary, #0f172a)',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>

      {subtitle && (
        <span
          className="metric-subtitle"
          title={subtitle}
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted, #94a3b8)',
            marginTop: '0.25rem',
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }}
        >
          {subtitle}
        </span>
      )}
    </div>

    <div
      className={`metric-icon ${iconClass}`}
      style={{
        flexShrink: 0,
        width: '38px',
        height: '38px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Loading Skeleton View
// ─────────────────────────────────────────────────────────────────────────────

const AdminDashboardSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2.5rem' }}>
    {/* Header Skeleton */}
    <div
      className="card"
      style={{
        padding: '1.5rem',
        borderRadius: 'var(--radius-lg, 12px)',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
          <div style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'var(--bg-surface-elevated)' }} className="skeleton-pulse" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
            <div style={{ width: '150px', height: '18px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)' }} className="skeleton-pulse" />
            <div style={{ width: '280px', height: '26px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)' }} className="skeleton-pulse" />
            <div style={{ width: '380px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)' }} className="skeleton-pulse" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <div style={{ width: '90px', height: '34px', borderRadius: '6px', backgroundColor: 'var(--bg-surface-elevated)' }} className="skeleton-pulse" />
          <div style={{ width: '110px', height: '34px', borderRadius: '6px', backgroundColor: 'var(--bg-surface-elevated)' }} className="skeleton-pulse" />
        </div>
      </div>
    </div>

    {/* KPI Grid Skeleton */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="card" style={{ padding: '1.1rem', height: '105px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ width: '100px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', marginBottom: '0.65rem' }} className="skeleton-pulse" />
          <div style={{ width: '60px', height: '28px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', marginBottom: '0.45rem' }} className="skeleton-pulse" />
          <div style={{ width: '130px', height: '12px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)' }} className="skeleton-pulse" />
        </div>
      ))}
    </div>

    {/* Content Skeleton */}
    <div className="card" style={{ padding: '1.5rem', height: '340px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ width: '200px', height: '20px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', marginBottom: '1.25rem' }} className="skeleton-pulse" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ width: '100%', height: '44px', borderRadius: '6px', backgroundColor: 'var(--bg-surface-elevated)' }} className="skeleton-pulse" />
        ))}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ defaultTab = 'overview' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const { unreadCount, wsStatus, notifications: liveNotifications } = useNotifications();

  // Determine active tab from URL query param `?tab=users` or defaultTab prop
  const urlTab = searchParams.get('tab') as AdminDashboardTab | null;
  const [activeTab, setActiveTab] = useState<AdminDashboardTab>(urlTab || defaultTab);

  // Sync tab state with query params
  useEffect(() => {
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab, activeTab]);

  const handleTabChange = (tab: AdminDashboardTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab });
  };

  // ── Live Backend Data ──
  const [stats, setStats] = useState<AdminDashboardResponse | null>(null);
  const [issueAging, setIssueAging] = useState<IssueAgingResponse | null>(null);
  const [awaitingApproval, setAwaitingApproval] = useState<Sprint[]>([]);
  const [activeSprints, setActiveSprints] = useState<Sprint[]>([]);
  const [workloads, setWorkloads] = useState<DeveloperAnalyticsItem[]>([]);

  // ── UI States ──
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // ── Load All Operational Stats ──
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [dashStats, agingRes, pendingSprints, activeSprintsRes, devWorkloadRes] =
        await Promise.all([
          adminApi.getDashboard(),
          adminApi.getIssueAging().catch(() => null),
          SprintService.getAwaitingApprovalSprints().catch(() => []),
          SprintService.getActiveSprints().catch(() => []),
          analyticsApi.getDeveloperPerformance().catch(() => ({ items: [], total: 0 })),
        ]);

      setStats(dashStats);
      setIssueAging(agingRes);
      setAwaitingApproval(pendingSprints || []);
      setActiveSprints(activeSprintsRes || []);
      setWorkloads(devWorkloadRes.items || []);
      setRefreshCounter((c) => c + 1);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to load admin dashboard data from server.';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time synchronization on WebSocket events
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

  // User initials avatar
  const userInitials = useMemo(() => {
    if (!currentUser?.full_name) return 'AD';
    const parts = currentUser.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }, [currentUser?.full_name]);

  // Overall resolution rate
  const resolutionRate = useMemo(() => {
    if (!stats || stats.issues.total === 0) return 0;
    return Math.round(((stats.issues.resolved + stats.issues.closed) / stats.issues.total) * 100);
  }, [stats]);

  // Overdue count calculation
  const overdueCount = useMemo(() => {
    if (!issueAging) return 0;
    return (issueAging.over_7d || 0) + (issueAging.days_3_to_7 || 0);
  }, [issueAging]);

  if (isLoading && !stats) {
    return <AdminDashboardSkeleton />;
  }

  if (error && !stats) {
    return (
      <div style={{ padding: '2rem 1rem' }}>
        <ErrorMessage message={error} onRetry={() => fetchData()} />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2.5rem' }}>
      {/* ── Action Success Toast ── */}
      {actionSuccess && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md, 8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={18} color="#34d399" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', padding: 0 }}
            title="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Action Error Toast ── */}
      {actionError && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md, 8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={18} color="#f87171" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}
            title="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER CARD (Gradient style matching User & Tester Dashboards) */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          background:
            'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.08) 50%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.28)',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.08)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '1.4rem 1.6rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', flex: 1, minWidth: '280px' }}>
            {/* User Initials Avatar with Active Pulse */}
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                border: '2px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 4px 14px rgba(249, 115, 22, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '1.2rem',
                flexShrink: 0,
                position: 'relative',
              }}
              title={currentUser?.full_name || 'Admin Profile'}
            >
              {userInitials}
              <span
                style={{
                  position: 'absolute',
                  bottom: '1px',
                  right: '1px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '2px solid var(--bg-surface, #0f172a)',
                }}
                title="Active Session"
              />
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  marginBottom: '0.35rem',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(249, 115, 22, 0.18)',
                    color: '#fb923c',
                    border: '1px solid rgba(249, 115, 22, 0.35)',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Sparkles size={12} /> ADMINISTRATOR COMMAND CENTER
                </span>
                {currentUser?.email && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {currentUser.email}
                  </span>
                )}
              </div>

              <h1
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: 'var(--text-primary, #ffffff)',
                  margin: '0 0 0.3rem 0',
                  letterSpacing: '-0.02em',
                }}
              >
                Welcome back, {currentUser?.full_name || 'System Admin'}!
              </h1>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, lineHeight: 1.45 }}>
                System-wide defect tracking, user governance, project health, sprint oversight, and audit logs.
              </p>
            </div>
          </div>

          {/* Controls: Live Status, Bell, Refresh, Quick Shortcuts */}
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* WebSocket Indicator */}
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

            {/* Notification Badge */}
            <Link
              to="/notifications"
              title="Notifications"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Bell size={16} />
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

            {/* Refresh Button with Spin */}
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="btn btn-secondary btn-sm"
              title="Refresh Dashboard"
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 2. OVERVIEW KPI CARDS (Requirement 1: 6 Core Metrics + Sprints)       */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {/* Total Users */}
        <MetricCard
          label="Total Users"
          value={stats.users.total}
          icon={<Users size={20} />}
          iconClass="metric-icon-indigo"
          subtitle={`${stats.users.active} Active • ${stats.users.inactive} Inactive`}
          badge={`${stats.users.active} Active`}
          badgeColor="#6366f1"
          onClick={() => handleTabChange('users')}
        />

        {/* Active Projects */}
        <MetricCard
          label="Active Projects"
          value={stats.projects.active}
          icon={<FolderGit2 size={20} />}
          iconClass="metric-icon-purple"
          subtitle={`${stats.projects.total} Total • ${stats.projects.inactive} Inactive`}
          badge={`${stats.projects.active} Active`}
          badgeColor="#8b5cf6"
          onClick={() => handleTabChange('projects_issues')}
        />

        {/* Total Issues */}
        <MetricCard
          label="Total Issues"
          value={stats.issues.total.toLocaleString()}
          icon={<Bug size={20} />}
          iconClass="metric-icon-blue"
          subtitle="Comprehensive system defects"
          onClick={() => handleTabChange('projects_issues')}
        />

        {/* Open Issues */}
        <MetricCard
          label="Open Issues"
          value={stats.issues.unresolved.toLocaleString()}
          icon={<AlertCircle size={20} />}
          iconClass="metric-icon-amber"
          valueColor="var(--color-warning, #f59e0b)"
          subtitle={`${resolutionRate}% Resolution Rate`}
          badge={stats.issues.unresolved > 0 ? 'Action Needed' : undefined}
          badgeColor="#f59e0b"
          onClick={() => handleTabChange('projects_issues')}
        />

        {/* Resolved Issues */}
        <MetricCard
          label="Resolved Issues"
          value={(stats.issues.resolved + stats.issues.closed).toLocaleString()}
          icon={<CheckCircle2 size={20} />}
          iconClass="metric-icon-emerald"
          valueColor="#34d399"
          subtitle={`${resolutionRate}% of all defects`}
          badge={`${resolutionRate}% Rate`}
          badgeColor="#10b981"
          onClick={() => handleTabChange('analytics')}
        />

        {/* Overdue / Aging Issues */}
        <MetricCard
          label="Overdue / Aging"
          value={overdueCount.toLocaleString()}
          icon={<Clock size={20} />}
          iconClass="metric-icon-red"
          valueColor={overdueCount > 0 ? '#f87171' : undefined}
          subtitle={`${issueAging?.over_7d || 0} older than 7d • ${issueAging?.critical_blocker_over_24h || 0} crit >24h`}
          badge={overdueCount > 0 ? 'Aging Alert' : undefined}
          badgeColor="#ef4444"
          onClick={() => {
            handleTabChange('overview');
            document.getElementById('admin-aging-monitor-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 3. NAVIGATION TABS (5 Comprehensive Operational Sections)             */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          background: 'var(--bg-surface-elevated)',
          padding: '0.35rem',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          overflowX: 'auto',
          flexWrap: 'wrap',
        }}
      >
        {[
          { id: 'overview', label: 'Command Overview', icon: <LayoutDashboard size={15} /> },
          { id: 'users', label: 'User Governance', icon: <Users size={15} />, badge: stats.users.total },
          { id: 'projects_issues', label: 'Projects & Issues', icon: <FolderGit2 size={15} />, badge: stats.projects.total },
          { id: 'analytics', label: 'Analytics & Workload', icon: <BarChart3 size={15} /> },
          { id: 'audit', label: 'Audit Activity', icon: <ShieldCheck size={15} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as AdminDashboardTab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                fontSize: '0.84rem',
                fontWeight: isActive ? 700 : 500,
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'var(--primary, #6366f1)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '999px',
                    background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-surface)',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: COMMAND OVERVIEW                                               */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Action Center */}
          <AdminActionCenter
            awaitingApproval={awaitingApproval}
            activeSprints={activeSprints}
            criticalCount={stats.severity.critical + stats.severity.blocker}
            reopenedCount={stats.issues.reopened}
            unassignedCount={stats.backlog.unassigned}
          />

          {/* Admin Priority Queue (Immediate Attention Actionable Queue) */}
          <AdminPriorityQueue
            onAssignSuccess={() => fetchData(true)}
            refreshTrigger={refreshCounter}
          />

          {/* Operational Row: Issue Aging Monitor + Pending Approvals Summary */}
          <div
            id="admin-aging-monitor-section"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '1.25rem',
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
                      color: awaitingApproval.length > 0 ? 'var(--primary, #4f46e5)' : 'var(--text-primary)',
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
                    background: awaitingApproval.length > 0 ? 'var(--primary, #4f46e5)' : 'var(--bg-surface)',
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

          {/* Workflow Stepper */}
          <TracePilotWorkflowStepper />

          {/* Real-Time Activity Component */}
          <div>
            <AdminRealtimeActivity
              maxItems={6}
              refreshTrigger={refreshCounter}
            />
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: USER GOVERNANCE (Requirement 2)                                */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <AdminUserManagement
          onActionSuccess={(msg) => {
            setActionSuccess(msg);
            fetchData(true);
          }}
          onActionError={(msg) => {
            setActionError(msg);
          }}
          refreshTrigger={refreshCounter}
        />
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: PROJECTS & ISSUES MANAGEMENT (Requirement 3)                   */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === 'projects_issues' && (
        <AdminProjectsAndIssues
          onActionSuccess={(msg) => {
            setActionSuccess(msg);
            fetchData(true);
          }}
          onActionError={(msg) => {
            setActionError(msg);
          }}
          refreshTrigger={refreshCounter}
        />
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: ANALYTICS & WORKLOAD (Requirement 4)                           */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Issue Distribution by Severity & Priority */}
          <AdminIssueDistribution stats={stats} />

          {/* 30-Day Defect Trends Line Chart */}
          <AdminDefectTrend />

          {/* Team Workload & Developer Performance Table */}
          <AdminTeamWorkload workloads={workloads} />

          {/* Project Health Matrix */}
          <AdminProjectHealth />
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: AUDIT ACTIVITY (Requirement 5)                                 */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <AdminAuditActivity refreshTrigger={refreshCounter} />
      )}
    </div>
  );
};

export default AdminDashboardPage;
