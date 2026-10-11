/**
 * BacklogAgingRiskSection — Feature 03: Backlog Aging & Risk Analysis
 *
 * Provides:
 *  - Real PostgreSQL unresolved defect distribution across 4 non-overlapping age buckets:
 *      • Under 24 hours (< 24h)
 *      • 1–3 days (24h to 72h)
 *      • 3–7 days (72h to 7d)
 *      • More than 7 days (168h+)
 *  - Comprehensive Backlog Risk Summary KPIs:
 *      • Total Unresolved Issues
 *      • Critical / Blocker Unresolved
 *      • Unassigned Unresolved
 *      • Issues Older than 7 Days
 *      • Critical / Blocker Issues > 24 Hours
 *      • Oldest Unresolved Issue card with live age and details
 *  - Interactive Ranked Risk Queue with transparent 0–100 risk scoring:
 *      • Severity base points (0–40)
 *      • Age points (0–40, min(40, age_days * 2.5))
 *      • Unassigned factor (0–20, +20 for unassigned)
 *      • Clearly labeled as a triage prioritization aid (not an SLA breach)
 *  - Multi-dimensional filters: Project, Severity, Assignment Status, Age Bucket
 *  - Multi-column server-side sorting: Risk Score, Age, Severity
 *  - Server-side pagination with page-size options
 *  - Collapsible container to prevent page overcrowding
 *  - Informative empty, loading, error, and filter-reset states
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Filter,
  Flame,
  Info,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../../api/analytics';
import { getApiErrorMessage } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type {
  BacklogAgingDistributionResponse,
  BacklogRiskIssuesResponse,
} from '../../types/analytics';
import type { Severity } from '../../types/issue';

interface ProjectOption {
  id: number;
  name: string;
  key: string;
}

interface Props {
  projects?: ProjectOption[];
  selectedProjectId?: number;
  onProjectChange?: (projectId: number | undefined) => void;
}

// ─────────────────────────────────────────────────────────────────────────── //
// Age Bucket Visual Configurations
// ─────────────────────────────────────────────────────────────────────────── //

const BUCKET_METADATA: Record<
  string,
  {
    label: string;
    sublabel: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
  }
> = {
  under_24h: {
    label: 'Under 24 Hours',
    sublabel: '< 24h intake',
    color: '#10b981', // emerald
    bgColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    description: 'Fresh intake in queue under 24 hours. Normal triage SLA tier.',
  },
  days_1_to_3: {
    label: '1–3 Days',
    sublabel: '24h – 72h',
    color: '#0284c7', // sky
    bgColor: 'rgba(2, 132, 199, 0.12)',
    borderColor: 'rgba(2, 132, 199, 0.35)',
    description: 'Active review & assignment window (24 to 72 hours).',
  },
  days_3_to_7: {
    label: '3–7 Days',
    sublabel: '72h – 7 days',
    color: '#f59e0b', // amber
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    description: 'Developing backlog requiring triage review (3 to 7 days).',
  },
  over_7d: {
    label: 'More than 7 Days',
    sublabel: '> 7d (168h+)',
    color: '#ef4444', // rose/red
    bgColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    description: 'Stale backlog defects remaining unresolved for 7+ days.',
  },
};

const RISK_LEVEL_METADATA: Record<
  string,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  CRITICAL: {
    label: 'Critical Risk',
    color: '#dc2626',
    bgColor: 'rgba(220, 38, 38, 0.15)',
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  HIGH: {
    label: 'High Risk',
    color: '#ea580c',
    bgColor: 'rgba(234, 88, 12, 0.15)',
    borderColor: 'rgba(234, 88, 12, 0.4)',
  },
  MEDIUM: {
    label: 'Medium Risk',
    color: '#d97706',
    bgColor: 'rgba(217, 119, 6, 0.15)',
    borderColor: 'rgba(217, 119, 6, 0.4)',
  },
  LOW: {
    label: 'Low Risk',
    color: '#0284c7',
    bgColor: 'rgba(2, 132, 199, 0.15)',
    borderColor: 'rgba(2, 132, 199, 0.4)',
  },
};

const SEVERITY_COLORS: Record<string, { color: string; bg: string }> = {
  BLOCKER: { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)' },
  CRITICAL: { color: '#ea580c', bg: 'rgba(234, 88, 12, 0.12)' },
  MAJOR: { color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' },
  MINOR: { color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)' },
};

export const BacklogAgingRiskSection: React.FC<Props> = ({
  projects = [],
  selectedProjectId: initialProjectId,
  onProjectChange,
}) => {
  // Collapsible state (expanded by default)
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Global project filter for the section
  const [projectId, setProjectId] = useState<number | undefined>(initialProjectId);

  // Aging distribution & summary data state
  const [distData, setDistData] = useState<BacklogAgingDistributionResponse | null>(null);
  const [isDistLoading, setIsDistLoading] = useState<boolean>(true);
  const [distError, setDistError] = useState<string | null>(null);

  // Ranked Risk Issues state & filters
  const [issuesData, setIssuesData] = useState<BacklogRiskIssuesResponse | null>(null);
  const [isIssuesLoading, setIsIssuesLoading] = useState<boolean>(true);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  // Table Filters
  const [filterSeverity, setFilterSeverity] = useState<Severity | ''>('');
  const [filterAssignment, setFilterAssignment] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [filterAgeBucket, setFilterAgeBucket] = useState<string>(''); // '', 'under_24h', etc.

  // Sorting
  const [sortBy, setSortBy] = useState<'risk_score' | 'age' | 'severity'>('risk_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Synchronize initial project prop
  useEffect(() => {
    setProjectId(initialProjectId);
  }, [initialProjectId]);

  // ── Fetch Aging Distribution ──────────────────────────────────────────────
  const fetchAgingDistribution = useCallback(async () => {
    setIsDistLoading(true);
    setDistError(null);
    try {
      const res = await analyticsApi.getBacklogAgingDistribution({
        project_id: projectId,
        include_test: false,
      });
      setDistData(res);
    } catch (err) {
      setDistError(getApiErrorMessage(err));
    } finally {
      setIsDistLoading(false);
    }
  }, [projectId]);

  // ── Fetch Ranked Risk Issues ──────────────────────────────────────────────
  const fetchRiskIssues = useCallback(async () => {
    setIsIssuesLoading(true);
    setIssuesError(null);
    try {
      const isAssignedParam =
        filterAssignment === 'ASSIGNED'
          ? true
          : filterAssignment === 'UNASSIGNED'
          ? false
          : undefined;

      const res = await analyticsApi.getBacklogRiskIssues({
        project_id: projectId,
        severity: (filterSeverity || undefined) as Severity | undefined,
        is_assigned: isAssignedParam,
        age_bucket: (filterAgeBucket || undefined) as any,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        page_size: pageSize,
        include_test: false,
      });
      setIssuesData(res);
    } catch (err) {
      setIssuesError(getApiErrorMessage(err));
    } finally {
      setIsIssuesLoading(false);
    }
  }, [projectId, filterSeverity, filterAssignment, filterAgeBucket, sortBy, sortDir, page, pageSize]);

  // Trigger data fetches
  useEffect(() => {
    fetchAgingDistribution();
  }, [fetchAgingDistribution]);

  useEffect(() => {
    fetchRiskIssues();
  }, [fetchRiskIssues]);

  // Handlers
  const handleProjectSelect = (id: number | undefined) => {
    setProjectId(id);
    setPage(1);
    if (onProjectChange) {
      onProjectChange(id);
    }
  };

  const handleBucketCardClick = (bucketKey: string) => {
    setFilterAgeBucket((prev) => (prev === bucketKey ? '' : bucketKey));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilterSeverity('');
    setFilterAssignment('ALL');
    setFilterAgeBucket('');
    setSortBy('risk_score');
    setSortDir('desc');
    setPage(1);
  };

  const handleSort = (field: 'risk_score' | 'age' | 'severity') => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const hasActiveTableFilters = useMemo(() => {
    return (
      filterSeverity !== '' ||
      filterAssignment !== 'ALL' ||
      filterAgeBucket !== '' ||
      sortBy !== 'risk_score' ||
      sortDir !== 'desc'
    );
  }, [filterSeverity, filterAssignment, filterAgeBucket, sortBy, sortDir]);

  const summary = distData?.summary;
  const buckets = distData?.buckets || [];

  return (
    <div className="card" style={{ marginBottom: '1.75rem' }}>
      {/* ── Section Header & Global Controls ─────────────────────────── */}
      <div
        className="card-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
          padding: '1rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 className="card-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                Backlog Aging & Risk Analysis
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  letterSpacing: '0.04em',
                }}
              >
                Feature 03
              </span>
            </div>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Non-overlapping age tiers, backlog exposure metrics, and prioritized defect risk scoring
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Project Selector */}
          {projects.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Filter size={14} color="var(--text-muted)" />
              <select
                aria-label="Filter backlog aging by project"
                className="form-control"
                style={{
                  fontSize: '0.82rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  minWidth: 160,
                }}
                value={projectId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleProjectSelect(val ? Number(val) : undefined);
                }}
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              padding: '0.35rem 0.75rem',
            }}
            onClick={() => {
              fetchAgingDistribution();
              fetchRiskIssues();
            }}
            disabled={isDistLoading || isIssuesLoading}
            title="Refresh Backlog Aging & Risk data"
          >
            <RefreshCw size={13} className={isDistLoading || isIssuesLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              padding: '0.35rem 0.65rem',
            }}
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            title={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>
      </div>

      {/* ── Main Collapsible Body ────────────────────────────────────── */}
      {isExpanded && (
        <div className="card-body" style={{ padding: '1.25rem 1.5rem' }}>
          {/* Error Message */}
          {distError && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                <AlertCircle size={18} />
                <span style={{ fontSize: '0.85rem' }}>{distError}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={fetchAgingDistribution}
                style={{ fontSize: '0.78rem' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading Distribution State */}
          {isDistLoading && !distData ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
              <LoadingSpinner message="Analyzing backlog aging tiers and risk factors..." />
            </div>
          ) : (
            <>
              {/* ── Section 1: Backlog Risk Summary KPIs ─────────────────── */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Backlog Risk Exposure Summary
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Scope:{' '}
                    {projectId
                      ? `Project ${projects.find((p) => p.id === projectId)?.name || projectId}`
                      : 'Complete Portfolio (Excluding Test Fixtures)'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.85rem',
                  }}
                >
                  {/* KPI 1: Total Unresolved */}
                  <div
                    className="metric-card"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '1rem',
                    }}
                  >
                    <div className="metric-info">
                      <span className="metric-label" style={{ fontSize: '0.78rem' }}>
                        Total Unresolved
                      </span>
                      <span className="metric-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        {summary?.total_unresolved ?? 0}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Excludes Resolved & Closed
                      </span>
                    </div>
                    <div
                      className="metric-icon-box"
                      style={{
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        color: '#6366f1',
                      }}
                    >
                      <Clock size={20} />
                    </div>
                  </div>

                  {/* KPI 2: Critical / Blocker Unresolved */}
                  <div
                    className="metric-card"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem',
                    }}
                  >
                    <div className="metric-info">
                      <span className="metric-label" style={{ fontSize: '0.78rem' }}>
                        Critical / Blocker
                      </span>
                      <span
                        className="metric-value"
                        style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}
                      >
                        {summary?.critical_blocker_unresolved ?? 0}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#dc2626' }}>
                        {summary?.total_unresolved
                          ? `${((summary.critical_blocker_unresolved / summary.total_unresolved) * 100).toFixed(1)}% of backlog`
                          : '0%'}
                      </span>
                    </div>
                    <div
                      className="metric-icon-box"
                      style={{
                        backgroundColor: 'rgba(220, 38, 38, 0.12)',
                        color: '#dc2626',
                      }}
                    >
                      <ShieldAlert size={20} />
                    </div>
                  </div>

                  {/* KPI 3: Unassigned Unresolved */}
                  <div
                    className="metric-card"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem',
                    }}
                  >
                    <div className="metric-info">
                      <span className="metric-label" style={{ fontSize: '0.78rem' }}>
                        Unassigned Defects
                      </span>
                      <span
                        className="metric-value"
                        style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}
                      >
                        {summary?.unassigned_unresolved ?? 0}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>
                        {summary?.total_unresolved
                          ? `${((summary.unassigned_unresolved / summary.total_unresolved) * 100).toFixed(1)}% unallocated`
                          : '0%'}
                      </span>
                    </div>
                    <div
                      className="metric-icon-box"
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        color: '#f59e0b',
                      }}
                    >
                      <UserX size={20} />
                    </div>
                  </div>

                  {/* KPI 4: Older Than 7 Days */}
                  <div
                    className="metric-card"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem',
                    }}
                  >
                    <div className="metric-info">
                      <span className="metric-label" style={{ fontSize: '0.78rem' }}>
                        Aging &gt; 7 Days
                      </span>
                      <span
                        className="metric-value"
                        style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}
                      >
                        {summary?.issues_older_than_7d ?? 0}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>
                        {summary?.total_unresolved
                          ? `${((summary.issues_older_than_7d / summary.total_unresolved) * 100).toFixed(1)}% stale`
                          : '0%'}
                      </span>
                    </div>
                    <div
                      className="metric-icon-box"
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        color: '#ef4444',
                      }}
                    >
                      <Flame size={20} />
                    </div>
                  </div>

                  {/* KPI 5: Critical/Blocker > 24 Hours */}
                  <div
                    className="metric-card"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid rgba(220, 38, 38, 0.4)',
                      borderRadius: '8px',
                      padding: '1rem',
                    }}
                  >
                    <div className="metric-info">
                      <span className="metric-label" style={{ fontSize: '0.78rem' }}>
                        Critical &gt; 24h
                      </span>
                      <span
                        className="metric-value"
                        style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b91c1c' }}
                      >
                        {summary?.critical_blocker_older_than_24h ?? 0}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#b91c1c' }}>
                        Urgent triage attention
                      </span>
                    </div>
                    <div
                      className="metric-icon-box"
                      style={{
                        backgroundColor: 'rgba(185, 28, 28, 0.12)',
                        color: '#b91c1c',
                      }}
                    >
                      <AlertTriangle size={20} />
                    </div>
                  </div>
                </div>

                {/* KPI 6: Oldest Unresolved Issue Callout Banner */}
                {summary?.oldest_unresolved && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      padding: '0.85rem 1.15rem',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.07)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '6px',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Clock size={16} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Oldest Unresolved Defect:
                          </span>
                          <Link
                            to={`/issues/${summary.oldest_unresolved.id}`}
                            style={{
                              fontWeight: 700,
                              fontSize: '0.88rem',
                              color: 'var(--primary)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            {summary.oldest_unresolved.issue_key}
                            <ExternalLink size={12} />
                          </Link>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-input)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {summary.oldest_unresolved.project_name} ({summary.oldest_unresolved.project_key})
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor:
                                SEVERITY_COLORS[summary.oldest_unresolved.severity]?.bg || 'rgba(220, 38, 38, 0.12)',
                              color:
                                SEVERITY_COLORS[summary.oldest_unresolved.severity]?.color || '#dc2626',
                            }}
                          >
                            {summary.oldest_unresolved.severity}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(99, 102, 241, 0.12)',
                              color: '#6366f1',
                            }}
                          >
                            {summary.oldest_unresolved.status}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: '0.2rem 0 0',
                            fontSize: '0.8rem',
                            color: 'var(--text-primary)',
                            maxWidth: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {summary.oldest_unresolved.title}
                        </p>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626' }}>
                        {summary.oldest_unresolved.age_days.toFixed(1)} days old
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Assignee: {summary.oldest_unresolved.assignee_name || 'Unassigned'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Section 2: Non-Overlapping Backlog Aging Distribution ── */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.65rem',
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      Backlog Aging Distribution by Tier
                    </h3>
                    <p
                      style={{
                        margin: '0.15rem 0 0',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Precise, non-overlapping aging windows based on issue creation timestamp
                    </p>
                  </div>
                  {filterAgeBucket && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setFilterAgeBucket('')}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    >
                      Clear bucket filter
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {buckets.map((b) => {
                    const meta = BUCKET_METADATA[b.bucket_key] || {
                      label: b.label,
                      sublabel: b.boundary_desc,
                      color: '#6366f1',
                      bgColor: 'rgba(99, 102, 241, 0.12)',
                      borderColor: 'rgba(99, 102, 241, 0.35)',
                      description: b.boundary_desc,
                    };
                    const isSelected = filterAgeBucket === b.bucket_key;

                    return (
                      <div
                        key={b.bucket_key}
                        onClick={() => handleBucketCardClick(b.bucket_key)}
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: `2px solid ${isSelected ? meta.color : meta.borderColor}`,
                          borderRadius: '8px',
                          padding: '1rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: isSelected ? `0 0 10px ${meta.bgColor}` : 'none',
                          transform: isSelected ? 'translateY(-2px)' : 'none',
                        }}
                        title={`Click to filter table by ${meta.label}`}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                              }}
                            >
                              {meta.label}
                            </span>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {b.boundary_desc}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              color: meta.color,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: meta.bgColor,
                            }}
                          >
                            {b.percentage.toFixed(1)}%
                          </span>
                        </div>

                        {/* Total Count */}
                        <div style={{ marginBottom: '0.65rem' }}>
                          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {b.total_issues}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.35rem' }}>
                            issues
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div
                          style={{
                            width: '100%',
                            height: '6px',
                            backgroundColor: 'var(--bg-input)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            marginBottom: '0.85rem',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, b.percentage))}%`,
                              height: '100%',
                              backgroundColor: meta.color,
                              borderRadius: '3px',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>

                        {/* Breakdown Metrics */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.75rem',
                            borderTop: '1px dashed var(--border-subtle)',
                            paddingTop: '0.5rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <ShieldAlert size={13} color="#ea580c" />
                            <span style={{ color: 'var(--text-secondary)' }}>Crit/Block:</span>
                            <strong style={{ color: b.critical_blocker_count > 0 ? '#ea580c' : 'var(--text-primary)' }}>
                              {b.critical_blocker_count}
                            </strong>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <UserX size={13} color="#f59e0b" />
                            <span style={{ color: 'var(--text-secondary)' }}>Unassigned:</span>
                            <strong style={{ color: b.unassigned_count > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
                              {b.unassigned_count}
                            </strong>
                          </div>
                        </div>

                        {/* Filter Indicator */}
                        <div
                          style={{
                            marginTop: '0.5rem',
                            textAlign: 'center',
                            fontSize: '0.68rem',
                            color: isSelected ? meta.color : 'var(--text-muted)',
                            fontWeight: isSelected ? 700 : 500,
                          }}
                        >
                          {isSelected ? '✓ Filter Applied' : 'Click to filter table'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Section 3: Ranked Highest-Risk Issues Table ─────────── */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '1.25rem',
                }}
              >
                {/* Table Header & Interactive Filter Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Flame size={18} color="#dc2626" />
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Ranked Backlog Risk Queue
                      </h3>
                      {issuesData && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {issuesData.total} {issuesData.total === 1 ? 'issue' : 'issues'}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Prioritized defect exposure scoring based on actual severity, backlog age, and assignee status
                    </p>
                  </div>

                  {/* Filter Badges & Reset */}
                  {hasActiveTableFilters && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleResetFilters}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.75rem',
                        padding: '0.3rem 0.6rem',
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Reset Table Filters</span>
                    </button>
                  )}
                </div>

                {/* Filter Controls Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '0.65rem',
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {/* Severity Filter */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '0.2rem',
                      }}
                    >
                      Severity
                    </label>
                    <select
                      aria-label="Filter risk table by severity"
                      className="form-control"
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.3rem 0.5rem',
                        width: '100%',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                      value={filterSeverity}
                      onChange={(e) => {
                        setFilterSeverity(e.target.value as Severity | '');
                        setPage(1);
                      }}
                    >
                      <option value="">All Severities</option>
                      <option value="BLOCKER">Blocker (P0)</option>
                      <option value="CRITICAL">Critical (P1)</option>
                      <option value="MAJOR">Major (P2)</option>
                      <option value="MINOR">Minor (P3)</option>
                    </select>
                  </div>

                  {/* Assignment Filter */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '0.2rem',
                      }}
                    >
                      Assignment Status
                    </label>
                    <select
                      aria-label="Filter risk table by assignment"
                      className="form-control"
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.3rem 0.5rem',
                        width: '100%',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                      value={filterAssignment}
                      onChange={(e) => {
                        setFilterAssignment(e.target.value as any);
                        setPage(1);
                      }}
                    >
                      <option value="ALL">All Assignee States</option>
                      <option value="UNASSIGNED">Unassigned Only (+20 pts)</option>
                      <option value="ASSIGNED">Assigned Only</option>
                    </select>
                  </div>

                  {/* Age Bucket Filter */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '0.2rem',
                      }}
                    >
                      Age Tier
                    </label>
                    <select
                      aria-label="Filter risk table by age tier"
                      className="form-control"
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.3rem 0.5rem',
                        width: '100%',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                      value={filterAgeBucket}
                      onChange={(e) => {
                        setFilterAgeBucket(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All Age Tiers</option>
                      <option value="under_24h">Under 24 Hours (&lt; 24h)</option>
                      <option value="days_1_to_3">1–3 Days (24h–72h)</option>
                      <option value="days_3_to_7">3–7 Days (72h–7d)</option>
                      <option value="over_7d">More than 7 Days (168h+)</option>
                    </select>
                  </div>

                  {/* Sort Field */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '0.2rem',
                      }}
                    >
                      Sort By
                    </label>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <select
                        aria-label="Sort risk table by field"
                        className="form-control"
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.3rem 0.5rem',
                          width: '100%',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-input)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}
                        value={sortBy}
                        onChange={(e) => {
                          setSortBy(e.target.value as any);
                          setPage(1);
                        }}
                      >
                        <option value="risk_score">Risk Score</option>
                        <option value="age">Age (Oldest First)</option>
                        <option value="severity">Severity Impact</option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.3rem 0.5rem' }}
                        onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                        title={`Direction: ${sortDir === 'desc' ? 'Descending' : 'Ascending'}`}
                      >
                        {sortDir === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Page Size */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '0.2rem',
                      }}
                    >
                      Per Page
                    </label>
                    <select
                      aria-label="Issues per page"
                      className="form-control"
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.3rem 0.5rem',
                        width: '100%',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      <option value={10}>10 items</option>
                      <option value={25}>25 items</option>
                      <option value={50}>50 items</option>
                    </select>
                  </div>
                </div>

                {/* Filter Feedback Indicator */}
                {hasActiveTableFilters && (
                  <div
                    style={{
                      marginBottom: '0.85rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Active Filters:</span>
                    {filterSeverity && (
                      <span
                        style={{
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-input)',
                          fontSize: '0.72rem',
                        }}
                      >
                        Severity: <strong>{filterSeverity}</strong>
                      </span>
                    )}
                    {filterAssignment !== 'ALL' && (
                      <span
                        style={{
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-input)',
                          fontSize: '0.72rem',
                        }}
                      >
                        Assignment: <strong>{filterAssignment}</strong>
                      </span>
                    )}
                    {filterAgeBucket && (
                      <span
                        style={{
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-input)',
                          fontSize: '0.72rem',
                        }}
                      >
                        Age Tier: <strong>{BUCKET_METADATA[filterAgeBucket]?.label || filterAgeBucket}</strong>
                      </span>
                    )}
                    <span style={{ color: 'var(--text-muted)' }}>
                      (Summary cards reflect the complete project backlog; table reflects these filters)
                    </span>
                  </div>
                )}

                {/* Table Content */}
                {isIssuesLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem 0' }}>
                    <LoadingSpinner message="Loading ranked backlog risk queue..." />
                  </div>
                ) : issuesError ? (
                  <div
                    style={{
                      padding: '1.5rem',
                      textAlign: 'center',
                      backgroundColor: 'rgba(239, 68, 68, 0.05)',
                      borderRadius: '6px',
                      color: '#ef4444',
                    }}
                  >
                    <AlertCircle size={24} style={{ margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>{issuesError}</p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={fetchRiskIssues}
                      style={{ marginTop: '0.75rem', fontSize: '0.78rem' }}
                    >
                      Retry Loading Issues
                    </button>
                  </div>
                ) : !issuesData || issuesData.items.length === 0 ? (
                  <div
                    style={{
                      padding: '2.5rem 1rem',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: '6px',
                    }}
                  >
                    <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                    <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 700 }}>
                      No unresolved defects match criteria
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {hasActiveTableFilters
                        ? 'Try resetting the severity, assignment, or age bucket filters above.'
                        : 'Great news! There are no unresolved defects in the selected backlog scope.'}
                    </p>
                    {hasActiveTableFilters && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleResetFilters}
                        style={{ marginTop: '0.85rem', fontSize: '0.78rem' }}
                      >
                        Reset Table Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ fontSize: '0.82rem', width: '100%' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                          <th
                            style={{ width: '110px', cursor: 'pointer' }}
                            onClick={() => handleSort('risk_score')}
                            title="Sort by Risk Score"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span>Risk Score</span>
                              {sortBy === 'risk_score' ? (
                                sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                              ) : (
                                <ArrowUpDown size={12} color="var(--text-muted)" />
                              )}
                            </div>
                          </th>
                          <th style={{ minWidth: '95px' }}>Key</th>
                          <th style={{ minWidth: '220px' }}>Title &amp; Project</th>
                          <th
                            style={{ minWidth: '100px', cursor: 'pointer' }}
                            onClick={() => handleSort('severity')}
                            title="Sort by Severity"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span>Severity</span>
                              {sortBy === 'severity' ? (
                                sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                              ) : (
                                <ArrowUpDown size={12} color="var(--text-muted)" />
                              )}
                            </div>
                          </th>
                          <th style={{ minWidth: '105px' }}>Status</th>
                          <th style={{ minWidth: '120px' }}>Assignee</th>
                          <th
                            style={{ minWidth: '125px', cursor: 'pointer' }}
                            onClick={() => handleSort('age')}
                            title="Sort by Age"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span>Backlog Age</span>
                              {sortBy === 'age' ? (
                                sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                              ) : (
                                <ArrowUpDown size={12} color="var(--text-muted)" />
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {issuesData.items.map((item, idx) => {
                          const rank = (page - 1) * pageSize + idx + 1;
                          const riskMeta =
                            RISK_LEVEL_METADATA[item.risk_level] || RISK_LEVEL_METADATA.LOW;
                          const sevConfig =
                            SEVERITY_COLORS[item.severity] || { color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)' };

                          return (
                            <tr
                              key={item.id}
                              style={{
                                borderBottom: '1px solid var(--border-subtle)',
                                backgroundColor:
                                  item.risk_level === 'CRITICAL'
                                    ? 'rgba(220, 38, 38, 0.03)'
                                    : undefined,
                              }}
                            >
                              {/* Rank */}
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {rank}
                              </td>

                              {/* Risk Score & Pill */}
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span
                                      style={{
                                        fontSize: '0.95rem',
                                        fontWeight: 800,
                                        color: riskMeta.color,
                                      }}
                                    >
                                      {item.risk_score.toFixed(1)}
                                    </span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>/ 100</span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '0.65rem',
                                      fontWeight: 700,
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '3px',
                                      backgroundColor: riskMeta.bgColor,
                                      color: riskMeta.color,
                                      border: `1px solid ${riskMeta.borderColor}`,
                                      width: 'fit-content',
                                    }}
                                  >
                                    {item.risk_level}
                                  </span>
                                </div>
                              </td>

                                {/* Issue Key */}
                              <td>
                                <Link
                                  to={`/issues/${item.id}`}
                                  style={{
                                    fontWeight: 700,
                                    color: 'var(--primary)',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                  }}
                                >
                                  {item.issue_key}
                                  <ExternalLink size={11} />
                                </Link>
                              </td>

                              {/* Title & Project */}
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                                  {item.title}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {item.project_name} <span style={{ opacity: 0.7 }}>({item.project_key})</span>
                                </div>
                              </td>

                              {/* Severity */}
                              <td>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '4px',
                                    backgroundColor: sevConfig.bg,
                                    color: sevConfig.color,
                                  }}
                                >
                                  {item.severity}
                                </span>
                              </td>

                              {/* Status */}
                              <td>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                    color: '#6366f1',
                                    fontWeight: 500,
                                  }}
                                >
                                  {item.status.replace(/_/g, ' ')}
                                </span>
                              </td>

                              {/* Assignee */}
                              <td>
                                {item.assignee_name ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <UserCheck size={13} color="#10b981" />
                                    <span>{item.assignee_name}</span>
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                      color: '#d97706',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                    }}
                                  >
                                    <UserX size={11} />
                                    Unassigned
                                  </span>
                                )}
                              </td>

                              {/* Age */}
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {item.age_days >= 1
                                    ? `${item.age_days.toFixed(1)} days`
                                    : `${item.age_hours.toFixed(0)} hours`}
                                </div>
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    color: BUCKET_METADATA[item.age_bucket]?.color || 'var(--text-muted)',
                                  }}
                                >
                                  {BUCKET_METADATA[item.age_bucket]?.label || item.age_bucket}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination Bar */}
                {issuesData && issuesData.total_pages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      marginTop: '1rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Showing {(page - 1) * pageSize + 1}–
                      {Math.min(page * pageSize, issuesData.total)} of {issuesData.total} items
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                      >
                        Previous
                      </button>

                      <span style={{ fontWeight: 600, padding: '0 0.35rem' }}>
                        Page {page} of {issuesData.total_pages}
                      </span>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={page >= issuesData.total_pages}
                        onClick={() => setPage((p) => Math.min(issuesData.total_pages, p + 1))}
                        style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Section 4: Transparent Methodology & SLA Disclaimer ── */}
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.85rem 1.15rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                }}
              >
                <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Risk Scoring Methodology:</strong> Backlog Risk
                  Score (0–100) is calculated as:{' '}
                  <code>
                    Risk = Severity Points (BLOCKER: 40, CRITICAL: 30, MAJOR: 20, MINOR: 10) + Age Points (min(40,
                    age_days × 2.5)) + Assignment Factor (Unassigned: +20, Assigned: 0)
                  </code>
                  .<br />
                  <span style={{ color: 'var(--text-muted)' }}>
                    Notice: This scoring formula is an engineering prioritization aid designed to surface neglected and
                    high-exposure defects. It does not constitute a contractual SLA breach, legal commitment, or
                    guaranteed prediction.
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
