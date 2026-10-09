/**
 * DefectTrendsSection — Feature 01: Defect Trends & Quality History
 *
 * Provides:
 *  - Preset date ranges: 7d, 30d, 90d, and custom date range picker
 *  - Optional project filter
 *  - 4 Summary cards: Reported, Resolved, Closed, and Net Backlog Change (with period comparison %)
 *  - Time-series Recharts chart: Daily Reported, Resolved, Closed, and Cumulative Backlog
 *  - Status distribution breakdown of defects reported in the selected period
 *  - Side-by-side period comparison table (current vs immediately preceding period of equal duration)
 *  - Loading spinner, error with retry, and empty state
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsApi } from '../../api/analytics';
import { getApiErrorMessage } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type {
  DefectTrendPoint,
  DefectTrendsHistoryResponse,
} from '../../types/analytics';

interface ProjectOption {
  id: number;
  name: string;
  key: string;
}

interface Props {
  projects?: ProjectOption[];
}

type RangePreset = '7d' | '30d' | '90d' | 'custom';

export const DefectTrendsSection: React.FC<Props> = ({ projects = [] }) => {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);

  // Custom date range state
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  // API state
  const [data, setData] = useState<DefectTrendsHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Series visibility toggles
  const [showReported, setShowReported] = useState<boolean>(true);
  const [showResolved, setShowResolved] = useState<boolean>(true);
  const [showClosed, setShowClosed] = useState<boolean>(true);
  const [showCumulative, setShowCumulative] = useState<boolean>(true);

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setValidationError(null);

    try {
      let start_date: string | undefined = undefined;
      let end_date: string | undefined = undefined;

      if (preset === 'custom') {
        if (!customStart || !customEnd) {
          setValidationError('Please select both start and end dates.');
          setIsLoading(false);
          return;
        }
        if (customStart > customEnd) {
          setValidationError('Start date cannot be after end date.');
          setIsLoading(false);
          return;
        }
        start_date = new Date(`${customStart}T00:00:00Z`).toISOString();
        end_date = new Date(`${customEnd}T23:59:59Z`).toISOString();
      }

      const res = await analyticsApi.getDefectTrendsHistory({
        preset,
        start_date,
        end_date,
        project_id: selectedProjectId,
      });
      setData(res);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [preset, customStart, customEnd, selectedProjectId]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  // Formatted date range label
  const rangeLabel = useMemo(() => {
    if (!data) return '';
    try {
      const s = new Date(data.start_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const e = new Date(data.end_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${s} — ${e}`;
    } catch {
      return `${data.start_date.slice(0, 10)} — ${data.end_date.slice(0, 10)}`;
    }
  }, [data]);

  const prevRangeLabel = useMemo(() => {
    if (!data?.comparison) return '';
    try {
      const s = new Date(data.comparison.prev_start_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const e = new Date(data.comparison.prev_end_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${s} — ${e}`;
    } catch {
      return '';
    }
  }, [data]);

  // Chart data formatting
  const chartData = useMemo(() => {
    if (!data?.timeline) return [];
    return data.timeline.map((pt: DefectTrendPoint) => {
      // Format 'YYYY-MM-DD' to 'MMM D'
      const parts = pt.date.split('-');
      let label = pt.date;
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return {
        date: label,
        rawDate: pt.date,
        Reported: pt.reported_count,
        Resolved: pt.resolved_count,
        Closed: pt.closed_count,
        NetChange: pt.net_change,
        CumulativeNet: pt.cumulative_net,
      };
    });
  }, [data]);

  // Check if data is completely empty
  const isDatasetEmpty = useMemo(() => {
    if (!data) return false;
    return (
      data.total_reported === 0 &&
      data.total_resolved === 0 &&
      data.total_closed === 0 &&
      data.opening_backlog === 0 &&
      data.closing_backlog === 0
    );
  }, [data]);

  const renderPctBadge = (pct: number | null | undefined, invertGood: boolean = false) => {
    if (pct === null || pct === undefined) {
      return (
        <span
          style={{
            fontSize: '0.72rem',
            padding: '0.15rem 0.45rem',
            borderRadius: '4px',
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.2rem',
          }}
        >
          <Minus size={11} /> N/A (No prior data)
        </span>
      );
    }

    const isPositive = pct > 0;
    const isZero = pct === 0;

    // By default: higher resolved/closed is good (green), higher reported/backlog is warning (red)
    // If invertGood is true: lower is good (green)
    let isFavorable = isPositive;
    if (invertGood) {
      isFavorable = !isPositive;
    }

    const badgeColor = isZero
      ? 'var(--text-muted)'
      : isFavorable
      ? '#34d399'
      : '#f87171';

    const bgAlpha = isZero
      ? 'var(--bg-surface-elevated)'
      : isFavorable
      ? 'rgba(52, 211, 153, 0.12)'
      : 'rgba(248, 113, 113, 0.12)';

    return (
      <span
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '0.15rem 0.45rem',
          borderRadius: '4px',
          backgroundColor: bgAlpha,
          color: badgeColor,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.2rem',
        }}
        title={`${pct > 0 ? '+' : ''}${pct}% compared to preceding equal period`}
      >
        {isZero ? (
          <Minus size={11} />
        ) : isPositive ? (
          <ArrowUpRight size={12} />
        ) : (
          <ArrowDownRight size={12} />
        )}
        {isPositive ? `+${pct}%` : `${pct}%`}
      </span>
    );
  };

  return (
    <section
      className="card"
      style={{
        marginBottom: '2rem',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}
      aria-label="Defect Trends and Quality History Section"
    >
      {/* ── 1. Header Toolbar ────────────────────────────────────────────── */}
      <div
        className="card-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 className="card-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                Defect Trends &amp; Quality History
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary)',
                  letterSpacing: '0.04em',
                }}
              >
                Feature 01
              </span>
            </div>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Historical defect intake, resolution velocity, net backlog evolution, and period comparisons
            </p>
          </div>
        </div>

        {/* Filters Controls */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          {/* Optional Project Filter */}
          {projects.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Filter size={14} color="var(--text-muted)" />
              <select
                aria-label="Filter trends by project"
                value={selectedProjectId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedProjectId(val ? parseInt(val, 10) : undefined);
                }}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.key}] {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Presets */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {(['7d', '30d', '90d', 'custom'] as RangePreset[]).map((r) => {
              const labels: Record<RangePreset, string> = {
                '7d': '7 Days',
                '30d': '30 Days',
                '90d': '90 Days',
                custom: 'Custom',
              };
              const active = preset === r;
              return (
                <button
                  key={r}
                  onClick={() => setPreset(r)}
                  style={{
                    backgroundColor: active ? 'var(--primary)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {labels[r]}
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchTrends}
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
            title="Refresh trends data"
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            <span style={{ fontSize: '0.78rem' }}>Sync</span>
          </button>
        </div>
      </div>

      {/* ── 2. Custom Date Filter Bar (if preset === 'custom') ───────────── */}
      {preset === 'custom' && (
        <div
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--bg-surface-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={15} color="var(--text-muted)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              From:
            </span>
            <input
              type="date"
              aria-label="Custom start date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              To:
            </span>
            <input
              type="date"
              aria-label="Custom end date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
              }}
            />
          </div>

          <button
            onClick={fetchTrends}
            disabled={isLoading}
            className="btn btn-sm btn-primary"
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.8rem' }}
          >
            Apply Range
          </button>

          {validationError && (
            <span style={{ color: '#f87171', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertCircle size={13} /> {validationError}
            </span>
          )}
        </div>
      )}

      {/* ── 3. Date Context Banner ───────────────────────────────────────── */}
      {data && (
        <div
          style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: 'rgba(99, 102, 241, 0.04)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>Selected Window:</strong> {rangeLabel}
          </span>
          {prevRangeLabel && (
            <span>
              <strong style={{ color: 'var(--text-primary)' }}>Preceding Period Baseline:</strong> {prevRangeLabel}
            </span>
          )}
        </div>
      )}

      {/* ── 4. Main Body: States Handling ────────────────────────────────── */}
      <div className="card-body" style={{ padding: '1.5rem' }}>
        {/* Loading Spinner */}
        {isLoading && !data && (
          <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <LoadingSpinner message="Querying PostgreSQL defect history and calculating period metrics..." />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <AlertCircle size={18} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.85rem' }}>Failed to Load Defect Trends</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{error}</span>
              </div>
            </div>
            <button
              onClick={fetchTrends}
              className="btn btn-sm"
              style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.78rem',
                border: 'none',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && isDatasetEmpty && (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-muted)',
            }}
          >
            <Layers size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>
              No Eligible Defect Records Found
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
              There were no defect creation or resolution events recorded for the selected date window
              {selectedProjectId ? ' and project filter' : ''}.
            </p>
            <button
              onClick={() => {
                setPreset('30d');
                setSelectedProjectId(undefined);
              }}
              className="btn btn-sm btn-primary"
            >
              Reset to All Projects (Last 30 Days)
            </button>
          </div>
        )}

        {/* Content View */}
        {data && !isDatasetEmpty && (
          <>
            {/* ── A. 4 Summary KPI Cards ─────────────────────────────────── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1.75rem',
              }}
            >
              {/* Card 1: Reported Issues */}
              <div
                className="metric-card"
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.1rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Reported Issues
                    </span>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f87171', margin: '0.2rem 0' }}>
                      {data.total_reported.toLocaleString()}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '6px',
                      backgroundColor: 'rgba(248, 113, 113, 0.15)',
                      color: '#f87171',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AlertCircle size={16} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Prior: {data.comparison.previous_reported.toLocaleString()}
                  </span>
                  {renderPctBadge(data.comparison.reported_pct_change, true)}
                </div>
              </div>

              {/* Card 2: Resolved Issues */}
              <div
                className="metric-card"
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.1rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Resolved Issues
                    </span>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#34d399', margin: '0.2rem 0' }}>
                      {data.total_resolved.toLocaleString()}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '6px',
                      backgroundColor: 'rgba(52, 211, 153, 0.15)',
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Prior: {data.comparison.previous_resolved.toLocaleString()}
                  </span>
                  {renderPctBadge(data.comparison.resolved_pct_change, false)}
                </div>
              </div>

              {/* Card 3: Closed Issues */}
              <div
                className="metric-card"
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.1rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Verified Closures
                    </span>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#60a5fa', margin: '0.2rem 0' }}>
                      {data.total_closed.toLocaleString()}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '6px',
                      backgroundColor: 'rgba(96, 165, 250, 0.15)',
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Clock size={16} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Prior: {data.comparison.previous_closed.toLocaleString()}
                  </span>
                  {renderPctBadge(data.comparison.closed_pct_change, false)}
                </div>
              </div>

              {/* Card 4: Net Backlog Change */}
              <div
                className="metric-card"
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.1rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Net Backlog Delta
                    </span>
                    <div
                      style={{
                        fontSize: '1.65rem',
                        fontWeight: 800,
                        color: data.net_backlog_change <= 0 ? '#34d399' : '#fbbf24',
                        margin: '0.2rem 0',
                      }}
                    >
                      {data.net_backlog_change > 0 ? `+${data.net_backlog_change}` : data.net_backlog_change}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '6px',
                      backgroundColor:
                        data.net_backlog_change <= 0
                          ? 'rgba(52, 211, 153, 0.15)'
                          : 'rgba(251, 191, 36, 0.15)',
                      color: data.net_backlog_change <= 0 ? '#34d399' : '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {data.net_backlog_change <= 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                  <span
                    style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}
                    title={`Opening Backlog: ${data.opening_backlog} -> Closing Backlog: ${data.closing_backlog}`}
                  >
                    {data.opening_backlog} → {data.closing_backlog} (open)
                  </span>
                  {renderPctBadge(data.comparison.net_backlog_pct_change, true)}
                </div>
              </div>
            </div>

            {/* ── B. Time-Series Trend Chart ─────────────────────────────── */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                padding: '1.25rem',
                marginBottom: '1.75rem',
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
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.75rem',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Daily Inflow, Outflow &amp; Backlog Evolution
                  </h3>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Continuous time-series tracking issues created, resolved, and cumulative period backlog trajectory
                  </p>
                </div>

                {/* Interactive Series Visibility Toggles */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <button
                    onClick={() => setShowReported((v) => !v)}
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid rgba(248, 113, 113, 0.4)',
                      backgroundColor: showReported ? 'rgba(248, 113, 113, 0.15)' : 'transparent',
                      color: showReported ? '#f87171' : 'var(--text-muted)',
                      textDecoration: showReported ? 'none' : 'line-through',
                    }}
                  >
                    ● Reported
                  </button>

                  <button
                    onClick={() => setShowResolved((v) => !v)}
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid rgba(52, 211, 153, 0.4)',
                      backgroundColor: showResolved ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                      color: showResolved ? '#34d399' : 'var(--text-muted)',
                      textDecoration: showResolved ? 'none' : 'line-through',
                    }}
                  >
                    ● Resolved
                  </button>

                  <button
                    onClick={() => setShowClosed((v) => !v)}
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid rgba(96, 165, 250, 0.4)',
                      backgroundColor: showClosed ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                      color: showClosed ? '#60a5fa' : 'var(--text-muted)',
                      textDecoration: showClosed ? 'none' : 'line-through',
                    }}
                  >
                    ● Closed
                  </button>

                  <button
                    onClick={() => setShowCumulative((v) => !v)}
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid rgba(251, 191, 36, 0.4)',
                      backgroundColor: showCumulative ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
                      color: showCumulative ? '#fbbf24' : 'var(--text-muted)',
                      textDecoration: showCumulative ? 'none' : 'line-through',
                    }}
                  >
                    --- Cumulative Net
                  </button>
                </div>
              </div>

              {/* Chart Canvas */}
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--text-muted)"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border-subtle)' }}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border-subtle)' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border-muted)',
                              borderRadius: '6px',
                              padding: '0.65rem 0.85rem',
                              boxShadow: 'var(--shadow-md)',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                              {p.rawDate} ({p.date})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: '#f87171' }}>
                                <span>Reported:</span>
                                <strong>{p.Reported}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: '#34d399' }}>
                                <span>Resolved:</span>
                                <strong>{p.Resolved}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: '#60a5fa' }}>
                                <span>Closed:</span>
                                <strong>{p.Closed}</strong>
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  gap: '1rem',
                                  color: '#fbbf24',
                                  borderTop: '1px solid var(--border-subtle)',
                                  paddingTop: '0.25rem',
                                  marginTop: '0.15rem',
                                }}
                              >
                                <span>Cumulative Net:</span>
                                <strong>{p.CumulativeNet > 0 ? `+${p.CumulativeNet}` : p.CumulativeNet}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '0.5rem' }} />
                    {showReported && (
                      <Line
                        type="monotone"
                        dataKey="Reported"
                        stroke="#f87171"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#f87171' }}
                        activeDot={{ r: 5 }}
                        name="Reported (Created)"
                      />
                    )}
                    {showResolved && (
                      <Line
                        type="monotone"
                        dataKey="Resolved"
                        stroke="#34d399"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#34d399' }}
                        activeDot={{ r: 5 }}
                        name="Resolved"
                      />
                    )}
                    {showClosed && (
                      <Line
                        type="monotone"
                        dataKey="Closed"
                        stroke="#60a5fa"
                        strokeWidth={1.75}
                        dot={{ r: 2.5, fill: '#60a5fa' }}
                        activeDot={{ r: 4 }}
                        name="Closed"
                      />
                    )}
                    {showCumulative && (
                      <Line
                        type="monotone"
                        dataKey="CumulativeNet"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                        name="Cumulative Net Backlog"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── C. Period Comparison & Status Breakdown Grid ───────────── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {/* Left Column: Period Comparison Table */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: '1.1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Calendar size={16} color="var(--primary)" />
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Period-over-Period Performance
                  </h4>
                </div>
                <p style={{ margin: '0 0 0.85rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Selected period compared against the immediately preceding period of equal duration:
                </p>

                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="data-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th style={{ textAlign: 'right' }}>Current</th>
                        <th style={{ textAlign: 'right' }}>Prior</th>
                        <th style={{ textAlign: 'right' }}>Δ Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>Issues Reported</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {data.comparison.current_reported.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {data.comparison.previous_reported.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {renderPctBadge(data.comparison.reported_pct_change, true)}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Issues Resolved</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {data.comparison.current_resolved.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {data.comparison.previous_resolved.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {renderPctBadge(data.comparison.resolved_pct_change, false)}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Issues Closed</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {data.comparison.current_closed.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {data.comparison.previous_closed.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {renderPctBadge(data.comparison.closed_pct_change, false)}
                        </td>
                      </tr>
                      <tr>
                        <td>Opening Backlog</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {data.comparison.opening_backlog.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {data.comparison.prev_opening_backlog.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Baseline</td>
                      </tr>
                      <tr>
                        <td>Closing Backlog</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {data.comparison.closing_backlog.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {data.comparison.prev_closing_backlog.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Status at End</td>
                      </tr>
                      <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
                        <td>
                          <strong>Net Backlog Shift</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: data.net_backlog_change <= 0 ? '#34d399' : '#fbbf24' }}>
                          {data.comparison.current_net_backlog > 0
                            ? `+${data.comparison.current_net_backlog}`
                            : data.comparison.current_net_backlog}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {data.comparison.previous_net_backlog > 0
                            ? `+${data.comparison.previous_net_backlog}`
                            : data.comparison.previous_net_backlog}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {renderPctBadge(data.comparison.net_backlog_pct_change, true)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Status Breakdown of Reported Defects */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Layers size={16} color="var(--primary)" />
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Current Status of Defects Reported in Window
                  </h4>
                </div>
                <p style={{ margin: '0 0 1rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Reflects the current lifecycle stage of the {data.status_trend.total} defect(s) logged in this period:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1, justifyContent: 'center' }}>
                  {/* Open / In Progress */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>Open / In Progress</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {data.status_trend.open}{' '}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ({data.status_trend.total > 0 ? ((data.status_trend.open / data.status_trend.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div style={{ height: '7px', backgroundColor: 'var(--bg-input)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${data.status_trend.total > 0 ? (data.status_trend.open / data.status_trend.total) * 100 : 0}%`,
                          height: '100%',
                          backgroundColor: '#fbbf24',
                          borderRadius: '999px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Resolved */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#34d399', fontWeight: 600 }}>Resolved</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {data.status_trend.resolved}{' '}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ({data.status_trend.total > 0 ? ((data.status_trend.resolved / data.status_trend.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div style={{ height: '7px', backgroundColor: 'var(--bg-input)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${data.status_trend.total > 0 ? (data.status_trend.resolved / data.status_trend.total) * 100 : 0}%`,
                          height: '100%',
                          backgroundColor: '#34d399',
                          borderRadius: '999px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Closed */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#60a5fa', fontWeight: 600 }}>Closed</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {data.status_trend.closed}{' '}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ({data.status_trend.total > 0 ? ((data.status_trend.closed / data.status_trend.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div style={{ height: '7px', backgroundColor: 'var(--bg-input)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${data.status_trend.total > 0 ? (data.status_trend.closed / data.status_trend.total) * 100 : 0}%`,
                          height: '100%',
                          backgroundColor: '#60a5fa',
                          borderRadius: '999px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Reopened */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#f87171', fontWeight: 600 }}>Reopened</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {data.status_trend.reopened}{' '}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ({data.status_trend.total > 0 ? ((data.status_trend.reopened / data.status_trend.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div style={{ height: '7px', backgroundColor: 'var(--bg-input)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${data.status_trend.total > 0 ? (data.status_trend.reopened / data.status_trend.total) * 100 : 0}%`,
                          height: '100%',
                          backgroundColor: '#f87171',
                          borderRadius: '999px',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  💡 <strong>Calculation transparency:</strong> Event counts (Reported / Resolved / Closed) record
                  when actions occurred, while Status Breakdown indicates the state today of issues originating in this period.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
