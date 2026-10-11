/**
 * DeveloperPerformanceSection — Feature 04: Developer Performance & Workload Analytics
 *
 * Provides:
 *  - Real PostgreSQL developer workload & resolution metrics for active developers (DEVELOPER role)
 *  - Distinguishes live workload (currently assigned unresolved issues, critical backlog)
 *    from historical performance (resolved & closed issues in period, avg resolution speed)
 *  - Unassigned work highlighted separately as a dedicated triage metric, never falsely attributed
 *  - Workload distribution comparison across active developers with percentage shares
 *  - Reopened defect count tracking supported by PostgreSQL audit log & status events
 *  - Average resolution speed where reliable creation-to-resolution timestamps exist
 *  - Interactive date presets: 7 Days, 30 Days, 90 Days, and All Time
 *  - Project filtering with empty-state handling
 *  - Multi-column sortable developer table with clear zero-activity empty states
 *  - Workload comparison chart using Recharts
 *  - Fair assessment transparency notice preventing naive ranking by raw counts
 *  - Collapsible container matching TracePilot design system
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Flame,
  Info,
  RefreshCw,
  RotateCcw,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { analyticsApi, type DeveloperPerformanceParams } from '../../api/analytics';
import { getApiErrorMessage } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type {
  DeveloperAnalyticsResponse,
} from '../../types/analytics';

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

type SortField =
  | 'workload'
  | 'critical'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'avg_time'
  | 'share'
  | 'name';

type SortDirection = 'asc' | 'desc';

export const DeveloperPerformanceSection: React.FC<Props> = ({
  projects = [],
  selectedProjectId: externalProjectId,
  onProjectChange,
}) => {
  // ── Section Collapse State ────────────────────────────────────────────────
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // ── Filters State ─────────────────────────────────────────────────────────
  const [preset, setPreset] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [localProjectId, setLocalProjectId] = useState<number | undefined>(externalProjectId);

  // Sync external project id prop if passed
  useEffect(() => {
    setLocalProjectId(externalProjectId);
  }, [externalProjectId]);

  const activeProjectId = localProjectId;

  // ── Data & Loading State ──────────────────────────────────────────────────
  const [data, setData] = useState<DeveloperAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ── Sorting State ─────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>('workload');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // ── Fetch Data ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: DeveloperPerformanceParams = {
        preset: preset === 'all' ? undefined : preset,
        project_id: activeProjectId,
      };
      const response = await analyticsApi.getDeveloperPerformance(params);
      setData(response);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [preset, activeProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Handle Project Filter Change ──────────────────────────────────────────
  const handleProjectSelect = (projId: number | undefined) => {
    setLocalProjectId(projId);
    if (onProjectChange) {
      onProjectChange(projId);
    }
  };

  const handleResetFilters = () => {
    setPreset('30d');
    handleProjectSelect(undefined);
  };

  // ── Sorting Logic ─────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    const items = [...data.items];

    items.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'workload':
          comparison = a.open_issues - b.open_issues;
          break;
        case 'critical':
          comparison = (a.critical_open_issues ?? 0) - (b.critical_open_issues ?? 0);
          break;
        case 'resolved':
          comparison = a.resolved_issues - b.resolved_issues;
          break;
        case 'closed':
          comparison = (a.closed_issues ?? 0) - (b.closed_issues ?? 0);
          break;
        case 'reopened':
          comparison = (a.reopened_issues ?? 0) - (b.reopened_issues ?? 0);
          break;
        case 'avg_time': {
          const timeA = a.average_resolution_time_hours ?? 999999;
          const timeB = b.average_resolution_time_hours ?? 999999;
          comparison = timeA - timeB;
          break;
        }
        case 'share':
          comparison = (a.workload_share_pct ?? 0) - (b.workload_share_pct ?? 0);
          break;
        case 'name':
          comparison = a.developer_name.localeCompare(b.developer_name);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return items;
  }, [data?.items, sortField, sortDirection]);

  // ── Chart Data Preparation ────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!data?.items) return [];
    return data.items.map(dev => ({
      name: dev.developer_name.split(' ')[0] || dev.developer_name,
      fullName: dev.developer_name,
      'Active Backlog': dev.open_issues,
      'Critical Backlog': dev.critical_open_issues ?? 0,
      'Resolved in Period': dev.resolved_issues,
      'Closed in Period': dev.closed_issues ?? 0,
      sharePct: dev.workload_share_pct ?? 0,
    }));
  }, [data?.items]);

  // Render sort icon helper
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.4, marginLeft: '4px' }} />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={13} style={{ color: 'var(--brand-primary)', marginLeft: '4px' }} />
    ) : (
      <ArrowDown size={13} style={{ color: 'var(--brand-primary)', marginLeft: '4px' }} />
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      {/* ── Section Header ── */}
      <div
        className="card-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '1.1rem 1.25rem',
          background: 'var(--bg-surface)',
          borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
        }}
        onClick={() => setIsCollapsed(prev => !prev)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(192, 132, 252, 0.15)',
              color: '#c084fc',
            }}
          >
            <Users size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>
                Developer Performance &amp; Workload Analytics
              </h3>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px',
                  background: 'rgba(192, 132, 252, 0.12)',
                  color: '#c084fc',
                  border: '1px solid rgba(192, 132, 252, 0.25)',
                }}
              >
                Feature 04 · Real PostgreSQL Data
              </span>
            </div>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                margin: '0.2rem 0 0',
              }}
            >
              Actionable, fair backlog distribution &amp; resolution velocity for active developers
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.35rem 0.5rem' }}
            aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
          >
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {/* ── Section Content (when expanded) ── */}
      {!isCollapsed && (
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {/* ── Filter & Control Bar ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.02))',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginRight: '0.3rem' }}>
                Resolution Window:
              </span>
              {(['7d', '30d', '90d', 'all'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`btn btn-sm ${preset === p ? 'btn-primary' : 'btn-outline'}`}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                  }}
                  onClick={() => setPreset(p)}
                >
                  {p === '7d' && '7 Days'}
                  {p === '30d' && '30 Days'}
                  {p === '90d' && '90 Days'}
                  {p === 'all' && 'All Time'}
                </button>
              ))}
            </div>

            {/* Project Filter & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              {projects.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                  <select
                    className="form-select form-select-sm"
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      maxWidth: '200px',
                    }}
                    value={activeProjectId ?? ''}
                    onChange={e =>
                      handleProjectSelect(e.target.value ? Number(e.target.value) : undefined)
                    }
                  >
                    <option value="">All Projects</option>
                    {projects.map(proj => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name} ({proj.key})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(activeProjectId !== undefined || preset !== '30d') && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                  onClick={handleResetFilters}
                  title="Reset to default 30 days & all projects"
                >
                  <RotateCcw size={13} style={{ marginRight: '4px' }} />
                  Reset
                </button>
              )}

              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                onClick={fetchData}
                disabled={isLoading}
                title="Refresh metrics from PostgreSQL"
              >
                <RefreshCw size={13} className={isLoading ? 'spin' : ''} style={{ marginRight: '4px' }} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── Error State ── */}
          {error && (
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} />
                <span style={{ fontSize: '0.85rem' }}>{error}</span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                onClick={fetchData}
              >
                Retry
              </button>
            </div>
          )}

          {/* ── Loading Spinner ── */}
          {isLoading && !data && (
            <div style={{ padding: '3rem 0', textAlign: 'center' }}>
              <LoadingSpinner message="Aggregating live developer workload &amp; resolution metrics..." />
            </div>
          )}

          {/* ── Main Data View ── */}
          {data && (
            <>
              {/* ── KPI Summary Cards ── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                {/* 1. Team Assigned Open Workload */}
                <div
                  className="card"
                  style={{
                    padding: '1rem',
                    background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.02))',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      ASSIGNED WORKLOAD
                    </span>
                    <UserCheck size={16} color="#818cf8" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#818cf8' }}>
                    {data.total_assigned_open ?? 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Active unresolved issues on developers
                  </div>
                </div>

                {/* 2. Team Critical Backlog */}
                <div
                  className="card"
                  style={{
                    padding: '1rem',
                    background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.02))',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      CRITICAL BACKLOG
                    </span>
                    <Flame size={16} color="#f43f5e" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#f43f5e' }}>
                    {data.total_critical_open ?? 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Assigned Blocker &amp; Critical defects
                  </div>
                </div>

                {/* 3. Unassigned Work (Triage Queue - Separated!) */}
                <div
                  className="card"
                  style={{
                    padding: '1rem',
                    background: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: '700' }}>
                      UNASSIGNED TRIAGE
                    </span>
                    <UserX size={16} color="#fbbf24" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#fbbf24' }}>
                    {data.total_unassigned_open ?? 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <strong style={{ color: '#f87171' }}>{data.total_unassigned_critical ?? 0} critical</strong> · Not attributed to developers
                  </div>
                </div>

                {/* 4. Completed in Period */}
                <div
                  className="card"
                  style={{
                    padding: '1rem',
                    background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.02))',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      COMPLETED IN WINDOW
                    </span>
                    <CheckCircle2 size={16} color="#34d399" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#34d399' }}>
                    {(data.total_resolved_period ?? 0) + (data.total_closed_period ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {data.total_resolved_period ?? 0} resolved · {data.total_closed_period ?? 0} closed
                  </div>
                </div>

                {/* 5. Team Resolution Velocity */}
                <div
                  className="card"
                  style={{
                    padding: '1rem',
                    background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.02))',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      AVG RESOLUTION SPEED
                    </span>
                    <Clock size={16} color="#06b6d4" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#06b6d4' }}>
                    {data.team_avg_resolution_time_hours != null
                      ? `${data.team_avg_resolution_time_hours.toFixed(1)}h`
                      : '—'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Creation to resolution speed
                  </div>
                </div>
              </div>

              {/* ── Workload Comparison Chart ── */}
              {chartData.length > 0 && (
                <div
                  className="card"
                  style={{
                    padding: '1.25rem',
                    marginBottom: '1.25rem',
                    background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.02))',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Workload &amp; Throughput Comparison
                      </h4>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Side-by-side view of active backlog vs. period resolutions across active developers
                      </p>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                          axisLine={{ stroke: 'var(--border-color)' }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                          axisLine={{ stroke: 'var(--border-color)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.8rem',
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '0.78rem', paddingTop: '10px' }}
                        />
                        <Bar dataKey="Active Backlog" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Critical Backlog" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Resolved in Period" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── Sortable Developer Table ── */}
              <div
                className="card"
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '0.85rem 1.15rem',
                    background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.02))',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Developer Workload &amp; Resolution Table
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Click any column header to toggle sort order
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    {sortedItems.length} Active Developers
                  </span>
                </div>

                <div className="table-container" style={{ border: 'none', borderRadius: 0, margin: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('name')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            Developer {renderSortIcon('name')}
                          </div>
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('workload')}
                          title="Currently assigned unresolved issues"
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            Assigned Workload {renderSortIcon('workload')}
                          </div>
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('critical')}
                          title="Assigned unresolved Critical/Blocker backlog"
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            Critical Backlog {renderSortIcon('critical')}
                          </div>
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('resolved')}
                          title="Issues resolved during selected date window"
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            Resolved (Period) {renderSortIcon('resolved')}
                          </div>
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('closed')}
                          title="Issues closed during selected date window"
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            Closed (Period) {renderSortIcon('closed')}
                          </div>
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('reopened')}
                          title="Reopened issues supported by audit events or REOPENED status"
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            Reopened {renderSortIcon('reopened')}
                          </div>
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('avg_time')}
                          title="Average creation-to-resolution speed where reliable timestamps exist"
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            Avg Resolution Speed {renderSortIcon('avg_time')}
                          </div>
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('share')}
                          title="Percentage share of total assigned open workload"
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            Workload Share {renderSortIcon('share')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                              <Users size={32} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                              <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                No qualifying developer activity found
                              </span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                No active developers matched the current project filter or date window.
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        sortedItems.map(dev => {
                          const hasActivity =
                            dev.open_issues > 0 ||
                            dev.resolved_issues > 0 ||
                            (dev.closed_issues ?? 0) > 0 ||
                            (dev.reopened_issues ?? 0) > 0;

                          return (
                            <tr key={dev.developer_id} style={{ opacity: hasActivity ? 1 : 0.65 }}>
                              {/* Developer Info */}
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                  <div
                                    style={{
                                      width: '30px',
                                      height: '30px',
                                      borderRadius: '50%',
                                      background: hasActivity
                                        ? 'rgba(99, 102, 241, 0.2)'
                                        : 'rgba(148, 163, 184, 0.15)',
                                      color: hasActivity ? '#818cf8' : 'var(--text-muted)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.75rem',
                                      fontWeight: '700',
                                    }}
                                  >
                                    {dev.developer_name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                      {dev.developer_name}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      {dev.developer_email}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Assigned Workload */}
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span
                                    style={{
                                      fontWeight: '700',
                                      fontSize: '0.9rem',
                                      color: dev.open_issues > 0 ? '#818cf8' : 'var(--text-muted)',
                                    }}
                                  >
                                    {dev.open_issues}
                                  </span>
                                  {dev.open_issues > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                      open
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Critical Backlog */}
                              <td>
                                {(dev.critical_open_issues ?? 0) > 0 ? (
                                  <span
                                    className="badge"
                                    style={{
                                      backgroundColor: 'rgba(244, 63, 94, 0.15)',
                                      color: '#f43f5e',
                                      border: '1px solid rgba(244, 63, 94, 0.3)',
                                      fontWeight: '700',
                                    }}
                                  >
                                    {dev.critical_open_issues} critical
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    0
                                  </span>
                                )}
                              </td>

                              {/* Resolved (Period) */}
                              <td>
                                <span
                                  style={{
                                    color: dev.resolved_issues > 0 ? '#34d399' : 'var(--text-muted)',
                                    fontWeight: dev.resolved_issues > 0 ? '700' : 'normal',
                                  }}
                                >
                                  {dev.resolved_issues}
                                </span>
                              </td>

                              {/* Closed (Period) */}
                              <td>
                                <span
                                  style={{
                                    color: (dev.closed_issues ?? 0) > 0 ? '#38bdf8' : 'var(--text-muted)',
                                    fontWeight: (dev.closed_issues ?? 0) > 0 ? '600' : 'normal',
                                  }}
                                >
                                  {dev.closed_issues ?? 0}
                                </span>
                              </td>

                              {/* Reopened */}
                              <td>
                                {(dev.reopened_issues ?? 0) > 0 ? (
                                  <span
                                    className="badge"
                                    style={{
                                      backgroundColor: 'rgba(251, 146, 60, 0.15)',
                                      color: '#fb923c',
                                      border: '1px solid rgba(251, 146, 60, 0.3)',
                                      fontWeight: '600',
                                    }}
                                    title="Defects reopened based on audit events or current reopened state"
                                  >
                                    {dev.reopened_issues}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    0
                                  </span>
                                )}
                              </td>

                              {/* Avg Resolution Speed */}
                              <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                {dev.average_resolution_time_hours != null ? (
                                  <span style={{ fontWeight: '600' }}>
                                    {dev.average_resolution_time_hours.toFixed(1)} hrs
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                              </td>

                              {/* Workload Share % */}
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div
                                    style={{
                                      width: '50px',
                                      height: '6px',
                                      borderRadius: '3px',
                                      background: 'rgba(255, 255, 255, 0.1)',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${Math.min(dev.workload_share_pct ?? 0, 100)}%`,
                                        height: '100%',
                                        background: (dev.workload_share_pct ?? 0) > 50 ? '#f43f5e' : '#818cf8',
                                        borderRadius: '3px',
                                      }}
                                    />
                                  </div>
                                  <span style={{ fontSize: '0.78rem', fontWeight: '600', minWidth: '36px' }}>
                                    {(dev.workload_share_pct ?? 0).toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Fair Assessment Transparency Notice ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  marginTop: '1.25rem',
                }}
              >
                <Info size={18} style={{ color: '#818cf8', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Fair Workload &amp; Performance Transparency:
                  </strong>{' '}
                  Assigned open issues represent current backlog allocation and ongoing focus, not developer productivity or defect fault. Resolution speed reflects task complexity, architectural scope, and review pipelines. Unassigned defects are tracked in a dedicated triage queue and are never attributed to individual developers.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
