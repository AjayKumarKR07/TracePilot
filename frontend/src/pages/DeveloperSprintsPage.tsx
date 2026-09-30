﻿import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  FlaskConical,
  Layers,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsUp,
} from 'lucide-react';
import { issuesApi } from '../api/issues';
import { getApiErrorMessage } from '../api/client';
import { SprintService } from '../services/SprintService';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { SprintLifecycleIndicator } from '../components/sprints/SprintLifecycleIndicator';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import type { Issue } from '../types/issue';
import type { Sprint } from '../types/Sprint';
import { formatDate, formatRelativeTime } from '../utils/formatters';

type FilterTab = 'ALL' | 'ACTIVE' | 'IN_PROGRESS' | 'READY_FOR_APPROVAL' | 'COMPLETED';

export const DeveloperSprintsPage: React.FC = () => {
  const { user } = useAuth();
  const { wsStatus, notifications: liveNotifications } = useNotifications();
  const [searchParams] = useSearchParams();
  const targetSprintId = searchParams.get('sprintId');

  // â”€â”€ Data state â”€â”€
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // â”€â”€ Action states â”€â”€
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [downloadingReport, setDownloadingReport] = useState<number | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // â”€â”€ Filter & Search â”€â”€
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  // â”€â”€ Issues drawer per sprint â”€â”€
  const [expandedSprintIds, setExpandedSprintIds] = useState<Set<number>>(new Set());
  const [sprintIssues, setSprintIssues] = useState<Record<number, Issue[]>>({});
  const [loadingIssues, setLoadingIssues] = useState<Record<number, boolean>>({});
  const [updatingIssueId, setUpdatingIssueId] = useState<number | null>(null);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Data loading
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loadSprints = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const data = await SprintService.getAssignedSprints();
      setSprints(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSprints();
  }, [loadSprints]);

  // Real-time WebSocket refresh
  const isInitialMount = useRef(true);
  const latestNotifId = liveNotifications[0]?.id;

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (latestNotifId) {
      loadSprints(true);
    }
  }, [latestNotifId, loadSprints]);

  // Refetch when WebSocket reconnects
  useEffect(() => {
    if (wsStatus === 'connected') {
      loadSprints(true);
    }
  }, [wsStatus, loadSprints]);

  // Also listen for broadcasted app-level realtime events
  useEffect(() => {
    const handleRealtime = () => {
      loadSprints(true);
    };
    window.addEventListener('app:realtime_notification', handleRealtime);
    window.addEventListener('app:ws_reconnected', handleRealtime);
    return () => {
      window.removeEventListener('app:realtime_notification', handleRealtime);
      window.removeEventListener('app:ws_reconnected', handleRealtime);
    };
  }, [loadSprints]);

  // Load issues for a specific sprint
  const loadIssuesForSprint = async (sprintId: number) => {
    if (sprintIssues[sprintId]) return; // already loaded
    setLoadingIssues(prev => ({ ...prev, [sprintId]: true }));
    try {
      const res = await issuesApi.list({ sprint_id: sprintId, page_size: 100 });
      setSprintIssues(prev => ({ ...prev, [sprintId]: res.items || [] }));
    } catch (err: unknown) {
      console.error('Failed to load issues for sprint', sprintId, err);
    } finally {
      setLoadingIssues(prev => ({ ...prev, [sprintId]: false }));
    }
  };

  const toggleExpandSprint = (sprintId: number) => {
    setExpandedSprintIds(prev => {
      const next = new Set(prev);
      if (next.has(sprintId)) {
        next.delete(sprintId);
      } else {
        next.add(sprintId);
        loadIssuesForSprint(sprintId);
      }
      return next;
    });
  };

  // Handle notification deep-link: expand, scroll, and highlight target sprint
  useEffect(() => {
    if (targetSprintId && sprints.length > 0) {
      const sId = parseInt(targetSprintId, 10);
      if (!isNaN(sId)) {
        const targetSprint = sprints.find((s) => s.id === sId);
        if (targetSprint) {
          setActiveTab('ALL');
          setExpandedSprintIds((prev) => {
            const next = new Set(prev);
            next.add(sId);
            return next;
          });
          loadIssuesForSprint(sId);
          setTimeout(() => {
            const el = document.getElementById(`sprint-card-${sId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 150);
        }
      }
    }
  }, [targetSprintId, sprints]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Sprint Workflow Handlers
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleBeginWork = async (sprintId: number) => {
    setActionLoading(sprintId);
    setActionError(null);
    try {
      await SprintService.beginWork(sprintId);
      setActionSuccess('Sprint marked In Progress. Testing work has begun!');
      setTimeout(() => setActionSuccess(null), 5000);
      await loadSprints(true);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err));
      setTimeout(() => setActionError(null), 6000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitForApproval = async (sprintId: number) => {
    setActionLoading(sprintId);
    setActionError(null);
    try {
      await SprintService.submitForApproval(sprintId);
      setActionSuccess('Sprint successfully submitted for Admin approval!');
      setTimeout(() => setActionSuccess(null), 5000);
      await loadSprints(true);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err));
      setTimeout(() => setActionError(null), 6000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadReport = async (sprint: Sprint) => {
    setDownloadingReport(sprint.id);
    try {
      await SprintService.downloadSprintReport(sprint.id, sprint.name);
    } catch (err: unknown) {
      setActionError('Failed to generate PDF sprint report.');
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setDownloadingReport(null);
    }
  };

  // Quick transition issue status inside sprint
  const handleQuickIssueTransition = async (sprintId: number, issueId: number, targetStatus: any) => {
    setUpdatingIssueId(issueId);
    try {
      if (targetStatus === 'RESOLVED') {
        await issuesApi.resolve(issueId, { resolution_summary: 'Verified and resolved during sprint testing' });
      } else {
        await issuesApi.updateStatus(issueId, { status: targetStatus });
      }
      // Refresh issues for this sprint
      const res = await issuesApi.list({ sprint_id: sprintId, page_size: 100 });
      setSprintIssues(prev => ({ ...prev, [sprintId]: res.items || [] }));
      await loadSprints(true);
      setActionSuccess(`Issue status updated to ${targetStatus}`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err));
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setUpdatingIssueId(null);
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Computed KPIs & Filtering
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const counts = useMemo(() => {
    const total = sprints.length;
    const active = sprints.filter(s => s.status === 'ACTIVE').length;
    const inProgress = sprints.filter(s => s.status === 'IN_PROGRESS').length;
    const readyForApproval = sprints.filter(s => s.status === 'READY_FOR_APPROVAL').length;
    const completed = sprints.filter(s => s.status === 'COMPLETED').length;
    const changesRequested = sprints.filter(
      s => s.status === 'IN_PROGRESS' && s.review_comment
    ).length;
    return { total, active, inProgress, readyForApproval, completed, changesRequested };
  }, [sprints]);

  const filteredSprints = useMemo(() => {
    let result = sprints;

    if (activeTab === 'ACTIVE') {
      result = result.filter(s => s.status === 'ACTIVE');
    } else if (activeTab === 'IN_PROGRESS') {
      result = result.filter(s => s.status === 'IN_PROGRESS');
    } else if (activeTab === 'READY_FOR_APPROVAL') {
      result = result.filter(s => s.status === 'READY_FOR_APPROVAL');
    } else if (activeTab === 'COMPLETED') {
      result = result.filter(s => s.status === 'COMPLETED');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        s => s.name.toLowerCase().includes(q) || (s.goal && s.goal.toLowerCase().includes(q))
      );
    }

    return result;
  }, [sprints, activeTab, searchQuery]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render loading / error
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (isLoading) {
    return (
      <div style={{ padding: '3.5rem 0' }}>
        <LoadingSpinner message="Loading your assigned Sprints Dashboard..." />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => loadSprints()} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>

      {/* â”€â”€ Toast Notifications â”€â”€ */}
      {actionSuccess && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.92rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.92rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* â”€â”€ Hero / Page Header â”€â”€ */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(16,185,129,0.12) 100%)',
          border: '1px solid rgba(99,102,241,0.3)',
          padding: '1.5rem 1.75rem',
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
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                marginBottom: '0.45rem',
              }}
            >
              <span
                className="badge"
                style={{
                  backgroundColor: 'rgba(99,102,241,0.2)',
                  color: '#a5b4fc',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Layers size={13} /> SPRINT EXECUTION
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Tester: {user?.full_name || user?.email}
              </span>
            </div>

            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: '800',
                color: '#fff',
                margin: '0 0 0.35rem 0',
                letterSpacing: '-0.02em',
              }}
            >
              Sprints Dashboard
            </h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0, maxWidth: '640px' }}>
              Track your assigned sprint testing cycles, investigate associated defects, and submit completed sprints for Admin sign-off.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => loadSprints(true)}
              className="btn btn-secondary btn-sm"
              disabled={isRefreshing}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title="Refresh sprint assignments"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <Link
              to="/developer-dashboard"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <FlaskConical size={14} />
              <span>Developer Dashboard</span>
            </Link>
          </div>
        </div>
      </div>

      {/* â”€â”€ KPI Stats Ribbon â”€â”€ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          className="card"
          style={{
            padding: '1.1rem 1.25rem',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            Total Assigned
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
            {counts.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            All sprints assigned to you
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '1.1rem 1.25rem',
            border: '1px solid rgba(99,102,241,0.3)',
            background: 'rgba(99,102,241,0.06)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#a5b4fc', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Play size={13} /> Active (Ready to Start)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#818cf8' }}>
            {counts.active}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Requires "Begin Work"
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '1.1rem 1.25rem',
            border: '1px solid rgba(245,158,11,0.3)',
            background: 'rgba(245,158,11,0.06)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={13} /> In Progress
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>
            {counts.inProgress}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {counts.changesRequested > 0 ? (
              <span style={{ color: '#fbbf24', fontWeight: 600 }}>{counts.changesRequested} with changes requested</span>
            ) : (
              'Under active testing'
            )}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '1.1rem 1.25rem',
            border: '1px solid rgba(6,182,212,0.3)',
            background: 'rgba(6,182,212,0.06)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#22d3ee', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={13} /> Awaiting Approval
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#06b6d4' }}>
            {counts.readyForApproval}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Submitted to Admin
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '1.1rem 1.25rem',
            border: '1px solid rgba(16,185,129,0.3)',
            background: 'rgba(16,185,129,0.06)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#34d399', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={13} /> Completed
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
            {counts.completed}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Approved by Admin
          </div>
        </div>
      </div>

      {/* â”€â”€ Search & Filter Tabs Bar â”€â”€ */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(
            [
              { key: 'ALL', label: 'All Sprints', count: counts.total },
              { key: 'ACTIVE', label: 'Active', count: counts.active },
              { key: 'IN_PROGRESS', label: 'In Progress', count: counts.inProgress },
              { key: 'READY_FOR_APPROVAL', label: 'Awaiting Approval', count: counts.readyForApproval },
              { key: 'COMPLETED', label: 'Completed', count: counts.completed },
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="btn btn-sm"
              style={{
                borderRadius: '8px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: activeTab === tab.key ? 700 : 500,
                backgroundColor: activeTab === tab.key ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                border: activeTab === tab.key ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '0.85rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search sprint name or goal..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '2.4rem',
              fontSize: '0.85rem',
              paddingTop: '0.45rem',
              paddingBottom: '0.45rem',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* â”€â”€ Sprint Cards List â”€â”€ */}
      {filteredSprints.length === 0 ? (
        <EmptyState
          icon={<Layers size={42} style={{ color: 'var(--primary)', opacity: 0.6 }} />}
          title={searchQuery ? 'No matching sprints' : 'No sprints in this view'}
          description={
            searchQuery
              ? `No assigned sprints matched "${searchQuery}". Try clearing your search.`
              : 'You do not have any sprints assigned under this filter status.'
          }
          action={
            searchQuery ? (
              <button onClick={() => setSearchQuery('')} className="btn btn-secondary btn-sm">
                Clear Search
              </button>
            ) : null
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredSprints.map(sprint => {
            const isExpanded = expandedSprintIds.has(sprint.id);
            const issues = sprintIssues[sprint.id] || [];
            const isLoadingThisSprintIssues = loadingIssues[sprint.id] || false;
            const isSubmittingThis = actionLoading === sprint.id;
            const isDownloadingThis = downloadingReport === sprint.id;

            // Status theme
            const statusConfig = {
              ACTIVE: {
                label: 'Active (Ready to Begin)',
                color: '#818cf8',
                bg: 'rgba(99,102,241,0.15)',
                border: 'rgba(99,102,241,0.35)',
              },
              IN_PROGRESS: {
                label: 'In Progress (Testing)',
                color: '#fbbf24',
                bg: 'rgba(245,158,11,0.15)',
                border: 'rgba(245,158,11,0.35)',
              },
              READY_FOR_APPROVAL: {
                label: 'Awaiting Admin Approval',
                color: '#22d3ee',
                bg: 'rgba(6,182,212,0.15)',
                border: 'rgba(6,182,212,0.35)',
              },
              COMPLETED: {
                label: 'Approved & Completed',
                color: '#34d399',
                bg: 'rgba(16,185,129,0.15)',
                border: 'rgba(16,185,129,0.35)',
              },
              PLANNED: {
                label: 'Planned',
                color: '#94a3b8',
                bg: 'rgba(148,163,184,0.15)',
                border: 'rgba(148,163,184,0.35)',
              },
              ARCHIVED: {
                label: 'Archived',
                color: '#64748b',
                bg: 'rgba(100,116,139,0.15)',
                border: 'rgba(100,116,139,0.35)',
              },
            }[sprint.status] || {
              label: sprint.status,
              color: 'var(--text-muted)',
              bg: 'rgba(255,255,255,0.05)',
              border: 'var(--border)',
            };

            const isTargeted = targetSprintId ? sprint.id === parseInt(targetSprintId, 10) : false;

            return (
              <div
                key={sprint.id}
                id={`sprint-card-${sprint.id}`}
                className="card"
                style={{
                  border: isTargeted ? '2px solid var(--primary)' : `1px solid ${statusConfig.border}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.5rem',
                  backgroundColor: 'var(--bg-surface)',
                  boxShadow: isTargeted
                    ? '0 0 0 2px var(--primary), 0 10px 25px -5px rgba(99, 102, 241, 0.35)'
                    : 'var(--shadow-md)',
                  transition: 'all 0.25s ease',
                }}
              >
                {/* â”€â”€ Sprint Lifecycle Stage Indicator â”€â”€ */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                    Sprint Lifecycle Stage
                  </div>
                  <SprintLifecycleIndicator
                    status={sprint.status}
                    hasReviewComment={Boolean(sprint.review_comment)}
                  />
                </div>

                {/* â”€â”€ Top Header Row â”€â”€ */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1rem',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '0.85rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <h2
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#f8fafc',
                          margin: 0,
                        }}
                      >
                        {sprint.name}
                      </h2>
                      {sprint.project_name && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                          {sprint.project_key ? `[${sprint.project_key}] ` : ''}{sprint.project_name}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.65rem',
                          borderRadius: '12px',
                          color: statusConfig.color,
                          backgroundColor: statusConfig.bg,
                          border: `1px solid ${statusConfig.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        â— {statusConfig.label}
                      </span>
                    </div>

                    {sprint.goal && (
                      <p
                        style={{
                          fontSize: '0.88rem',
                          color: 'var(--text-secondary)',
                          margin: '0.45rem 0 0 0',
                          lineHeight: '1.45',
                        }}
                      >
                        {sprint.goal}
                      </p>
                    )}

                    {/* Timeline & Metadata */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        marginTop: '0.65rem',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={14} style={{ color: '#818cf8' }} />
                        <span>
                          {formatDate(sprint.start_date)} â†’ {formatDate(sprint.end_date)}
                        </span>
                      </div>

                      {sprint.working_days && (
                        <div>
                          <strong>{sprint.working_days}</strong> working days
                        </div>
                      )}

                      {sprint.estimated_team_members && (
                        <div>
                          <strong>{sprint.estimated_team_members}</strong> team members
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      flexWrap: 'wrap',
                      flexShrink: 0,
                    }}
                  >
                    {/* Workflow Buttons */}
                    {sprint.status === 'ACTIVE' && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isSubmittingThis}
                        onClick={() => handleBeginWork(sprint.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, padding: '0.45rem 0.95rem' }}
                        title="Click Begin Work to start testing and enable submission"
                      >
                        <Play size={14} />
                        <span>{isSubmittingThis ? 'Starting...' : 'Begin Work'}</span>
                      </button>
                    )}

                    {sprint.status === 'IN_PROGRESS' && (
                      <button
                        className="btn btn-success btn-sm"
                        disabled={isSubmittingThis || (sprint.total_issues ?? 0) === 0}
                        onClick={() => handleSubmitForApproval(sprint.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontWeight: 700,
                          backgroundColor: (sprint.total_issues ?? 0) > 0 ? '#10b981' : 'var(--bg-surface-elevated)',
                          borderColor: (sprint.total_issues ?? 0) > 0 ? '#10b981' : 'var(--border-subtle)',
                          padding: '0.45rem 0.95rem',
                          opacity: (sprint.total_issues ?? 0) > 0 ? 1 : 0.5,
                          cursor: (sprint.total_issues ?? 0) > 0 ? 'pointer' : 'not-allowed',
                        }}
                        title={
                          (sprint.total_issues ?? 0) === 0
                            ? 'Sprint cannot be submitted for approval with 0 issues. Add backlog issues first.'
                            : 'Submit sprint testing results to Admin for final approval'
                        }
                      >
                        <ThumbsUp size={14} />
                        <span>{isSubmittingThis ? 'Submitting...' : 'Submit for Approval'}</span>
                      </button>
                    )}

                    {sprint.status === 'READY_FOR_APPROVAL' && (
                      <span
                        style={{
                          fontSize: '0.82rem',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '8px',
                          background: 'rgba(6,182,212,0.12)',
                          border: '1px solid rgba(6,182,212,0.3)',
                          color: '#22d3ee',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          fontWeight: 600,
                        }}
                      >
                        <Clock size={14} /> Awaiting Admin Approval
                      </span>
                    )}

                    {sprint.status === 'COMPLETED' && (
                      <span
                        style={{
                          fontSize: '0.82rem',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '8px',
                          background: 'rgba(16,185,129,0.12)',
                          border: '1px solid rgba(16,185,129,0.3)',
                          color: '#34d399',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle2 size={14} /> âœ“ Approved &amp; Completed
                      </span>
                    )}

                    {/* PDF Report button */}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDownloadReport(sprint)}
                      disabled={isDownloadingThis}
                      title="Download PDF Sprint Report"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Download size={13} />
                      <span>{isDownloadingThis ? 'Exporting...' : 'Report'}</span>
                    </button>
                  </div>
                </div>

                {/* Warning if sprint has no issues assigned */}
                {(sprint.total_issues ?? 0) === 0 && (
                  <div
                    style={{
                      padding: '0.85rem 1.15rem',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#f87171',
                      marginBottom: '1rem',
                    }}
                  >
                    <AlertCircle size={18} />
                    <span>âš  Sprint has no issues assigned. Add backlog issues before starting/approving this sprint.</span>
                  </div>
                )}

                {/* â”€â”€ Sprint Progress & Effort Metrics Box â”€â”€ */}
                {(() => {
                  const totalIssues = sprint.total_issues ?? 0;
                  const completedIssues = sprint.completed_issues ?? 0;
                  const remainingIssues = Math.max(0, totalIssues - completedIssues);
                  const pct = sprint.progress_percentage ?? (totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0);
                  const capacityHrs = sprint.hours_per_day && sprint.working_days && sprint.estimated_team_members
                    ? sprint.hours_per_day * sprint.working_days * sprint.estimated_team_members
                    : null;
                  const estimatedEffort = totalIssues * 5;

                  return (
                    <div
                      style={{
                        background: 'var(--bg-surface-elevated)',
                        padding: '1rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        marginBottom: '1rem',
                      }}
                    >
                      {/* Work in Progress Banner */}
                      {sprint.status === 'IN_PROGRESS' && (
                        <div
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            color: '#fbbf24',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            marginBottom: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          <Sparkles size={14} /> Work in Progress "” Testing &amp; Defect Resolution Active
                        </div>
                      )}

                      {/* 6 Key Agile Metrics Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                          gap: '0.65rem',
                          marginBottom: '0.85rem',
                        }}
                      >
                        <div style={{ background: 'var(--bg-surface)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Issues</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>{totalIssues}</div>
                        </div>

                        <div style={{ background: 'var(--bg-surface)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completed Issues</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{completedIssues}</div>
                        </div>

                        <div style={{ background: 'var(--bg-surface)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining Issues</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: remainingIssues > 0 ? '#f59e0b' : '#94a3b8' }}>{remainingIssues}</div>
                        </div>

                        <div style={{ background: 'var(--bg-surface)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Progress %</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: pct >= 100 ? '#10b981' : '#818cf8' }}>{pct}%</div>
                        </div>

                        <div style={{ background: 'var(--bg-surface)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estimated Effort</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#a78bfa' }}>{estimatedEffort} pts</div>
                        </div>

                        <div style={{ background: 'var(--bg-surface)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Capacity</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>{capacityHrs ? `${capacityHrs}h` : `${sprint.estimated_team_members || 3} members`}</div>
                        </div>
                      </div>

                      {/* Dynamic Progress Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        <span>Sprint Defect Resolution: {completedIssues} of {totalIssues} issues resolved</span>
                        <span style={{ fontWeight: 800, color: pct >= 100 ? '#10b981' : '#818cf8' }}>{pct}%</span>
                      </div>
                      <div style={{ height: '7px', borderRadius: '4px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: pct >= 100 ? '#10b981' : pct >= 50 ? '#6366f1' : '#f59e0b',
                            borderRadius: '4px',
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* â”€â”€ Admin Feedback Banner (Change Request) â”€â”€ */}
                {sprint.review_comment && sprint.status === 'IN_PROGRESS' && (
                  <div
                    style={{
                      marginBottom: '1rem',
                      padding: '1rem 1.25rem',
                      background: 'rgba(245,158,11,0.12)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      borderRadius: '10px',
                      borderLeft: '5px solid #f59e0b',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          fontWeight: 800,
                          fontSize: '0.92rem',
                          color: '#fbbf24',
                        }}
                      >
                        <AlertTriangle size={16} />
                        Admin Requested Changes (Rework Cycle Active)
                      </div>
                      <button
                        className="btn btn-success btn-sm"
                        disabled={isSubmittingThis}
                        onClick={() => handleSubmitForApproval(sprint.id)}
                        style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                      >
                        <ThumbsUp size={13} /> Resubmit for Approval
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.45 }}>
                      "{sprint.review_comment}"
                    </p>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Please review the feedback above, verify remaining defects below, and click "Submit for Approval" when complete.
                    </div>
                  </div>
                )}

                {/* â”€â”€ Approved Details â”€â”€ */}
                {sprint.status === 'COMPLETED' && sprint.approved_at && (
                  <div
                    style={{
                      marginBottom: '1rem',
                      padding: '0.65rem 1rem',
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: '8px',
                      fontSize: '0.83rem',
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <CheckCircle2 size={15} />
                    Approved by Admin {formatRelativeTime(sprint.approved_at)}
                  </div>
                )}

                {/* â”€â”€ Expandable Issues Section â”€â”€ */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => toggleExpandSprint(sprint.id)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '0.82rem',
                      width: '100%',
                      justifyContent: 'space-between',
                      background: 'var(--bg-surface-elevated)',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '8px',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                      <Bug size={14} style={{ color: '#818cf8' }} />
                      Assigned Sprint Issues
                      {sprintIssues[sprint.id] && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            background: 'rgba(99,102,241,0.2)',
                            color: '#a5b4fc',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '10px',
                          }}
                        >
                          {sprintIssues[sprint.id].length}
                        </span>
                      )}
                    </span>
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  {isExpanded && (
                    <div style={{ marginTop: '0.85rem' }}>
                      {isLoadingThisSprintIssues ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                          <LoadingSpinner message="Fetching sprint issues..." />
                        </div>
                      ) : issues.length === 0 ? (
                        <div
                          style={{
                            padding: '1.25rem',
                            textAlign: 'center',
                            background: 'var(--bg-surface-elevated)',
                            borderRadius: '8px',
                            color: 'var(--text-muted)',
                            fontSize: '0.84rem',
                          }}
                        >
                          No issues currently associated with this sprint.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {issues.map(issue => (
                            <div
                              key={issue.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                padding: '0.75rem 1rem',
                                background: 'var(--bg-surface-elevated)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
                                <Link
                                  to={`/issues/${issue.id}`}
                                  style={{
                                    fontWeight: 700,
                                    color: '#818cf8',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.82rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                >
                                  {issue.issue_key}
                                  <ExternalLink size={12} style={{ opacity: 0.7 }} />
                                </Link>
                                <span style={{ color: '#f8fafc', fontWeight: 500 }}>
                                  {issue.title}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <StatusBadge status={issue.status} />
                                <PriorityBadge priority={issue.priority} />
                                <SeverityBadge severity={issue.severity} />

                                {/* Quick testing actions based on valid defect lifecycle */}
                                {issue.status === 'ASSIGNED' && (
                                  <button
                                    onClick={() => handleQuickIssueTransition(sprint.id, issue.id, 'IN_DEVELOPMENT')}
                                    disabled={updatingIssueId === issue.id}
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}
                                    title="Begin development on assigned defect"
                                  >
                                    Start Dev
                                  </button>
                                )}

                                {issue.status === 'IN_DEVELOPMENT' && (
                                  <button
                                    onClick={() => handleQuickIssueTransition(sprint.id, issue.id, 'IN_REVIEW')}
                                    disabled={updatingIssueId === issue.id}
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}
                                    title="Submit fix for code review"
                                  >
                                    Submit Review
                                  </button>
                                )}

                                {issue.status === 'REOPENED' && (
                                  <button
                                    onClick={() => handleQuickIssueTransition(sprint.id, issue.id, 'IN_DEVELOPMENT')}
                                    disabled={updatingIssueId === issue.id}
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}
                                    title="Resume development on reopened defect"
                                  >
                                    Resume Dev
                                  </button>
                                )}

                                {issue.status === 'IN_REVIEW' && (
                                  <button
                                    onClick={() => handleQuickIssueTransition(sprint.id, issue.id, 'IN_TESTING')}
                                    disabled={updatingIssueId === issue.id}
                                    className="btn btn-primary btn-sm"
                                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}
                                    title="Move issue into QA testing"
                                  >
                                    Start Testing
                                  </button>
                                )}

                                {issue.status === 'IN_TESTING' && (
                                  <button
                                    onClick={() => handleQuickIssueTransition(sprint.id, issue.id, 'RESOLVED')}
                                    disabled={updatingIssueId === issue.id}
                                    className="btn btn-success btn-sm"
                                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem', backgroundColor: '#10b981', borderColor: '#10b981' }}
                                    title="Mark testing verified and resolved"
                                  >
                                    Verify &amp; Resolve
                                  </button>
                                )}

                                {issue.status === 'RESOLVED' && (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      color: '#34d399',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      padding: '0.15rem 0.45rem',
                                      background: 'rgba(16,185,129,0.12)',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(16,185,129,0.3)',
                                    }}
                                  >
                                    <CheckCircle2 size={12} /> Resolved
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

