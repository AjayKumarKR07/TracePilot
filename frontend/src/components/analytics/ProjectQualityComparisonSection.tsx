/**
 * ProjectQualityComparisonSection — Feature 02: Project Quality Comparison
 *
 * Provides:
 *  - Comparison chart across eligible projects (Total, Open, Resolved/Closed, Critical/Blocker Open, Fix Rate)
 *  - Interactive comparison table with:
 *     - Project name and key
 *     - Total issues
 *     - Open issues
 *     - Critical/blocker open issues
 *     - Resolved/closed issues
 *     - Fix rate (%)
 *     - Average resolution time (hours / days)
 *     - Unassigned issue count
 *  - Sorting by project name, issue count, fix rate, and critical/blocker backlog
 *  - Real-time project search / filter by name or key
 *  - Pagination for clean navigation across large project portfolios
 *  - Summary aggregate footer row
 *  - Informative empty, loading, and error states
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart2,
  FolderGit2,
  RefreshCw,
  Search,
  ShieldAlert,
  UserX,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsApi } from '../../api/analytics';
import { getApiErrorMessage } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { ProjectAnalyticsResponse } from '../../types/analytics';

type SortField =
  | 'project_name'
  | 'total_issues'
  | 'open_issues'
  | 'critical_blocker_open_issues'
  | 'resolved_closed_issues'
  | 'fix_rate'
  | 'avg_resolution_time_hours'
  | 'unassigned_issues';

type SortDirection = 'asc' | 'desc';

type ChartMetric = 'volume' | 'fix_rate';

export const ProjectQualityComparisonSection: React.FC = () => {
  const [projects, setProjects] = useState<ProjectAnalyticsResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('volume');
  const [showZeroIssueProjects, setShowZeroIssueProjects] = useState<boolean>(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('total_issues');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const fetchProjectData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await analyticsApi.getAllProjectsAnalytics({
        include_test: false,
      });
      setProjects(res.items || []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Handle Sort Column Click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Default to desc for numeric counts, asc for name
      setSortDirection(field === 'project_name' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Zero issues toggle filter
      if (!showZeroIssueProjects && p.total_issues === 0) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.project_name.toLowerCase().includes(q) ||
        p.project_key.toLowerCase().includes(q)
      );
    });
  }, [projects, searchQuery, showZeroIssueProjects]);

  // Sorted Projects
  const sortedProjects = useMemo(() => {
    const list = [...filteredProjects];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      // Handle nulls in resolution time
      if (sortField === 'avg_resolution_time_hours') {
        valA = a.avg_resolution_time_hours ?? -1;
        valB = b.avg_resolution_time_hours ?? -1;
      }

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB as string);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      const numA = Number(valA ?? 0);
      const numB = Number(valB ?? 0);
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
    return list;
  }, [filteredProjects, sortField, sortDirection]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / pageSize));
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProjects.slice(start, start + pageSize);
  }, [sortedProjects, currentPage, pageSize]);

  // Summary Totals across filtered projects
  const aggregateTotals = useMemo(() => {
    const total = filteredProjects.reduce((acc, p) => acc + p.total_issues, 0);
    const open = filteredProjects.reduce((acc, p) => acc + p.open_issues, 0);
    const critOpen = filteredProjects.reduce(
      (acc, p) => acc + (p.critical_blocker_open_issues ?? 0),
      0
    );
    const resolvedClosed = filteredProjects.reduce(
      (acc, p) => acc + (p.resolved_closed_issues ?? (p.resolved_issues + p.closed_issues)),
      0
    );
    const unassigned = filteredProjects.reduce(
      (acc, p) => acc + (p.unassigned_issues ?? 0),
      0
    );
    const fixRate = total > 0 ? Number(((resolvedClosed / total) * 100).toFixed(1)) : 0;

    return {
      total,
      open,
      critOpen,
      resolvedClosed,
      unassigned,
      fixRate,
      projectCount: filteredProjects.length,
    };
  }, [filteredProjects]);

  // Chart Data: Top 10 projects by issue count or fix rate
  const chartData = useMemo(() => {
    // Take projects with issues
    const active = [...filteredProjects].filter((p) => p.total_issues > 0);
    if (chartMetric === 'fix_rate') {
      active.sort((a, b) => (b.fix_rate ?? b.resolution_rate) - (a.fix_rate ?? a.resolution_rate));
    } else {
      active.sort((a, b) => b.total_issues - a.total_issues);
    }
    return active.slice(0, 10).map((p) => ({
      key: p.project_key,
      name: p.project_name,
      total: p.total_issues,
      open: p.open_issues,
      resolvedClosed: p.resolved_closed_issues ?? (p.resolved_issues + p.closed_issues),
      criticalOpen: p.critical_blocker_open_issues ?? 0,
      fixRate: p.fix_rate ?? p.resolution_rate,
      avgHours: p.avg_resolution_time_hours,
      unassigned: p.unassigned_issues ?? 0,
    }));
  }, [filteredProjects, chartMetric]);

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.35, marginLeft: '0.3rem' }} />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={12} style={{ color: 'var(--primary)', marginLeft: '0.3rem' }} />
    ) : (
      <ArrowDown size={12} style={{ color: 'var(--primary)', marginLeft: '0.3rem' }} />
    );
  };

  const formatHours = (hours: number | null | undefined) => {
    if (hours === null || hours === undefined) return '—';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours >= 48) {
      const days = (hours / 24).toFixed(1);
      return `${days}d (${hours.toFixed(0)}h)`;
    }
    return `${hours.toFixed(1)}h`;
  };

  return (
    <div className="card" style={{ marginBottom: '1.75rem' }}>
      {/* ── Section Header ────────────────────────────────────────────── */}
      <div
        className="card-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '1rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FolderGit2 size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 className="card-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                Project Quality &amp; Defect Comparison
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  letterSpacing: '0.04em',
                }}
              >
                Feature 02
              </span>
            </div>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Cross-project quality benchmarks: defect volume, backlog pressure, fix rates, and MTTR
            </p>
          </div>
        </div>

        {/* Sync Button */}
        <button
          onClick={fetchProjectData}
          disabled={isLoading}
          className="btn btn-sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
          title="Refresh project quality data"
        >
          <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
          <span style={{ fontSize: '0.78rem' }}>Sync</span>
        </button>
      </div>

      {/* ── Toolbar: Search & View Options ───────────────────────────── */}
      <div
        style={{
          padding: '0.85rem 1.5rem',
          backgroundColor: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: 260, maxWidth: 380, flex: 1 }}>
          <Search
            size={14}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search projects by name or key..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.4rem 0.75rem 0.4rem 2rem',
              fontSize: '0.82rem',
            }}
          />
        </div>

        {/* Chart View Metric Switcher & Zero Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={showZeroIssueProjects}
              onChange={(e) => {
                setShowZeroIssueProjects(e.target.checked);
                setCurrentPage(1);
              }}
              style={{ cursor: 'pointer' }}
            />
            <span>Include zero-defect projects</span>
          </label>

          <div
            style={{
              display: 'inline-flex',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              onClick={() => setChartMetric('volume')}
              style={{
                backgroundColor: chartMetric === 'volume' ? 'var(--primary)' : 'transparent',
                color: chartMetric === 'volume' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '0.28rem 0.65rem',
                fontSize: '0.76rem',
                fontWeight: chartMetric === 'volume' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Defect Volumes
            </button>
            <button
              onClick={() => setChartMetric('fix_rate')}
              style={{
                backgroundColor: chartMetric === 'fix_rate' ? 'var(--primary)' : 'transparent',
                color: chartMetric === 'fix_rate' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '0.28rem 0.65rem',
                fontSize: '0.76rem',
                fontWeight: chartMetric === 'fix_rate' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Fix Rates (%)
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ────────────────────────────────────────── */}
      <div className="card-body" style={{ padding: '1.5rem' }}>
        {isLoading && projects.length === 0 && (
          <div style={{ padding: '3rem 0' }}>
            <LoadingSpinner message="Aggregating cross-project metrics..." />
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <AlertTriangle size={18} />
              <span style={{ fontSize: '0.85rem' }}>{error}</span>
            </div>
            <button
              onClick={fetchProjectData}
              className="btn btn-sm"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                padding: '0.3rem 0.75rem',
                fontSize: '0.78rem',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && filteredProjects.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              border: '1px dashed var(--border-subtle)',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-surface-elevated)',
            }}
          >
            <BarChart2 size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.35rem' }}>
              No Eligible Projects Found
            </h3>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
              {searchQuery
                ? `No projects matched your search "${searchQuery}". Clear your search query to view all available projects.`
                : 'No projects with active defect volume were found. Ensure non-test projects exist in the system.'}
            </p>
          </div>
        )}

        {filteredProjects.length > 0 && (
          <>
            {/* ── Interactive Comparison Chart ─────────────────────────── */}
            <div
              style={{
                marginBottom: '1.75rem',
                padding: '1.25rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
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
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>
                    {chartMetric === 'volume'
                      ? 'Top Projects by Defect Intake & Resolution Volume'
                      : 'Project Fix Rate Benchmark Comparison'}
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Displaying up to 10 prominent active projects
                  </span>
                </div>
                {chartMetric === 'fix_rate' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                    <span style={{ width: 12, height: 2, backgroundColor: '#10b981' }} />
                    <span style={{ color: 'var(--text-muted)' }}>Target: 80% Fix Rate</span>
                  </div>
                )}
              </div>

              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chartMetric === 'volume' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis
                        dataKey="key"
                        stroke="var(--text-muted)"
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                        interval={0}
                      />
                      <YAxis
                        stroke="var(--text-muted)"
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div
                                style={{
                                  backgroundColor: 'var(--bg-surface)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: '6px',
                                  padding: '0.65rem 0.85rem',
                                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                                  fontSize: '0.78rem',
                                }}
                              >
                                <div style={{ fontWeight: 800, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                                  [{p.key}] {p.name}
                                </div>
                                <div style={{ color: '#6366f1', marginBottom: '0.15rem' }}>
                                  Total Defects: <strong>{p.total.toLocaleString()}</strong>
                                </div>
                                <div style={{ color: '#f59e0b', marginBottom: '0.15rem' }}>
                                  Open Backlog: <strong>{p.open.toLocaleString()}</strong>
                                </div>
                                <div style={{ color: '#10b981', marginBottom: '0.15rem' }}>
                                  Resolved / Closed: <strong>{p.resolvedClosed.toLocaleString()}</strong>
                                </div>
                                {p.criticalOpen > 0 && (
                                  <div style={{ color: '#ef4444', marginBottom: '0.15rem' }}>
                                    Critical Open Backlog: <strong>{p.criticalOpen.toLocaleString()}</strong>
                                  </div>
                                )}
                                <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                  Fix Rate: <strong>{p.fixRate.toFixed(1)}%</strong>
                                </div>
                                {p.avgHours !== null && p.avgHours !== undefined && (
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                    MTTR: <strong>{formatHours(p.avgHours)}</strong>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={32}
                        formatter={(val) => (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {val}
                          </span>
                        )}
                      />
                      <Bar dataKey="total" name="Total Issues" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="open" name="Open Backlog" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="resolvedClosed" name="Resolved / Closed" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="criticalOpen" name="Critical / Blocker Open" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis
                        dataKey="key"
                        stroke="var(--text-muted)"
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                        interval={0}
                      />
                      <YAxis
                        domain={[0, 100]}
                        unit="%"
                        stroke="var(--text-muted)"
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      />
                      <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 4" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div
                                style={{
                                  backgroundColor: 'var(--bg-surface)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: '6px',
                                  padding: '0.65rem 0.85rem',
                                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                                  fontSize: '0.78rem',
                                }}
                              >
                                <div style={{ fontWeight: 800, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                                  [{p.key}] {p.name}
                                </div>
                                <div style={{ color: p.fixRate >= 80 ? '#10b981' : p.fixRate >= 50 ? '#f59e0b' : '#ef4444' }}>
                                  Fix Rate: <strong>{p.fixRate.toFixed(1)}%</strong>
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                                  Resolved: {p.resolvedClosed} / Total: {p.total}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="fixRate" name="Fix Rate (%)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Sortable Comparison Data Table ───────────────────────── */}
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <div className="table-container" style={{ border: 'none', borderRadius: 0, margin: 0 }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
                      <th
                        onClick={() => handleSort('project_name')}
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span>Project</span>
                          {renderSortIndicator('project_name')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('total_issues')}
                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span>Total</span>
                          {renderSortIndicator('total_issues')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('open_issues')}
                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span>Open</span>
                          {renderSortIndicator('open_issues')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('critical_blocker_open_issues')}
                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span>Critical / Blocker Open</span>
                          {renderSortIndicator('critical_blocker_open_issues')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('resolved_closed_issues')}
                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span>Resolved / Closed</span>
                          {renderSortIndicator('resolved_closed_issues')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('fix_rate')}
                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span>Fix Rate</span>
                          {renderSortIndicator('fix_rate')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('avg_resolution_time_hours')}
                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span>Avg Resolution</span>
                          {renderSortIndicator('avg_resolution_time_hours')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('unassigned_issues')}
                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span>Unassigned</span>
                          {renderSortIndicator('unassigned_issues')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProjects.map((p) => {
                      const fix = p.fix_rate ?? p.resolution_rate;
                      const critOpen = p.critical_blocker_open_issues ?? 0;
                      const resClosed =
                        p.resolved_closed_issues ?? (p.resolved_issues + p.closed_issues);

                      const fixBadgeColor =
                        fix >= 80 ? '#10b981' : fix >= 50 ? '#f59e0b' : '#ef4444';
                      const fixBadgeBg =
                        fix >= 80
                          ? 'rgba(16, 185, 129, 0.12)'
                          : fix >= 50
                          ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)';

                      return (
                        <tr key={p.project_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 700,
                                  color: 'var(--primary)',
                                  fontSize: '0.82rem',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '3px',
                                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                                }}
                              >
                                {p.project_key}
                              </span>
                              <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                                {p.project_name}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {p.total_issues.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', color: p.open_issues > 0 ? '#f59e0b' : 'inherit' }}>
                            {p.open_issues.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {critOpen > 0 ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.14)',
                                  color: '#ef4444',
                                  fontWeight: 700,
                                  fontSize: '0.78rem',
                                }}
                              >
                                <ShieldAlert size={12} />
                                {critOpen.toLocaleString()}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>0</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                            {resClosed.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.15rem 0.55rem',
                                borderRadius: '4px',
                                backgroundColor: fixBadgeBg,
                                color: fixBadgeColor,
                                fontWeight: 700,
                                fontSize: '0.78rem',
                              }}
                            >
                              {fix.toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {formatHours(p.avg_resolution_time_hours)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {(p.unassigned_issues ?? 0) > 0 ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.8rem',
                                }}
                              >
                                <UserX size={11} />
                                {(p.unassigned_issues ?? 0).toLocaleString()}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>0</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Aggregate Summary Footer */}
                  <tfoot>
                    <tr
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderTop: '2px solid var(--border-subtle)',
                        fontWeight: 700,
                      }}
                    >
                      <td>
                        <span style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Total ({aggregateTotals.projectCount} Projects)
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>
                        {aggregateTotals.total.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 800 }}>
                        {aggregateTotals.open.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 800 }}>
                        {aggregateTotals.critOpen.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 800 }}>
                        {aggregateTotals.resolvedClosed.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor:
                              aggregateTotals.fixRate >= 80
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(245, 158, 11, 0.15)',
                            color: aggregateTotals.fixRate >= 80 ? '#10b981' : '#f59e0b',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                          }}
                        >
                          {aggregateTotals.fixRate.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {aggregateTotals.unassigned.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ── Pagination Controls ─────────────────────────────────── */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>
                    Showing {(currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, sortedProjects.length)} of{' '}
                    {sortedProjects.length} projects
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Per page:</span>
                      <select
                        aria-label="Projects per page"
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="btn btn-sm"
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.76rem',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.5 : 1,
                      }}
                    >
                      Prev
                    </button>
                    <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="btn btn-sm"
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.76rem',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage === totalPages ? 0.5 : 1,
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
