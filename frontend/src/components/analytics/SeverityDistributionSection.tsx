/**
 * SeverityDistributionSection — Feature 02: Severity Distribution
 *
 * Provides:
 *  - Real PostgreSQL issue counts and percentages by severity:
 *    BLOCKER, CRITICAL, MAJOR, MINOR (using actual backend enum values)
 *  - Responsive interactive Donut / Pie chart (Recharts) with custom tooltips
 *  - Project filter dropdown
 *  - Summary callout for Critical & Blocker backlog health
 *  - Severity breakdown cards with animated progress bars
 *  - Informative empty state when 0 issues exist for the selection
 *  - Loading spinner & Error state with retry
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  PieChart as PieChartIcon,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { analyticsApi } from '../../api/analytics';
import { getApiErrorMessage } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { SeverityDistributionResponse } from '../../types/analytics';

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

const SEVERITY_CONFIG = [
  {
    key: 'BLOCKER',
    label: 'Blocker',
    sublabel: 'System inoperable / P0',
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.12)',
    border: 'rgba(220, 38, 38, 0.35)',
  },
  {
    key: 'CRITICAL',
    label: 'Critical',
    sublabel: 'Severe impairment / P1',
    color: '#ea580c',
    bg: 'rgba(234, 88, 12, 0.12)',
    border: 'rgba(234, 88, 12, 0.35)',
  },
  {
    key: 'MAJOR',
    label: 'Major',
    sublabel: 'Functionality degraded / P2',
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.12)',
    border: 'rgba(217, 119, 6, 0.35)',
  },
  {
    key: 'MINOR',
    label: 'Minor',
    sublabel: 'Low impact / Cosmetic / P3',
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.12)',
    border: 'rgba(2, 132, 199, 0.35)',
  },
] as const;

export const SeverityDistributionSection: React.FC<Props> = ({
  projects = [],
  selectedProjectId: initialProjectId,
  onProjectChange,
}) => {
  const [projectId, setProjectId] = useState<number | undefined>(initialProjectId);
  const [data, setData] = useState<SeverityDistributionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProjectId(initialProjectId);
  }, [initialProjectId]);

  const handleProjectSelect = (id: number | undefined) => {
    setProjectId(id);
    if (onProjectChange) {
      onProjectChange(id);
    }
  };

  const fetchSeverityData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await analyticsApi.getSeverityDistribution({
        project_id: projectId,
        include_test: false,
      });
      setData(res);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSeverityData();
  }, [fetchSeverityData]);

  const totalCount = useMemo(() => {
    if (!data) return 0;
    if (typeof data.total === 'number' && data.total > 0) return data.total;
    return (data.BLOCKER || 0) + (data.CRITICAL || 0) + (data.MAJOR || 0) + (data.MINOR || 0);
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return SEVERITY_CONFIG.map((cfg) => {
      const count = (data[cfg.key as keyof SeverityDistributionResponse] as number) || 0;
      const pct = totalCount > 0 ? Number(((count / totalCount) * 100).toFixed(1)) : 0;
      return {
        name: cfg.label,
        enumKey: cfg.key,
        count,
        pct,
        color: cfg.color,
      };
    });
  }, [data, totalCount]);

  const criticalBlockerCount = useMemo(() => {
    if (!data) return 0;
    if (typeof data.critical_blocker_total === 'number') return data.critical_blocker_total;
    return (data.BLOCKER || 0) + (data.CRITICAL || 0);
  }, [data]);

  const criticalBlockerPct = useMemo(() => {
    if (!data) return 0;
    if (typeof data.critical_blocker_pct === 'number') return data.critical_blocker_pct;
    return totalCount > 0 ? Number(((criticalBlockerCount / totalCount) * 100).toFixed(1)) : 0;
  }, [data, criticalBlockerCount, totalCount]);

  return (
    <div className="card" style={{ marginBottom: '1.75rem' }}>
      {/* ── Section Header & Filter Controls ────────────────────────── */}
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
              backgroundColor: 'rgba(234, 88, 12, 0.12)',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PieChartIcon size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 className="card-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                Defect Severity Distribution
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(234, 88, 12, 0.15)',
                  color: '#ea580c',
                  letterSpacing: '0.04em',
                }}
              >
                Feature 02
              </span>
            </div>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Defect breakdown by severity impact levels using live PostgreSQL production data
            </p>
          </div>
        </div>

        {/* Filter & Sync Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {projects.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Filter size={14} color="var(--text-muted)" />
              <select
                aria-label="Filter severity distribution by project"
                value={projectId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleProjectSelect(val ? parseInt(val, 10) : undefined);
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

          <button
            onClick={fetchSeverityData}
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
            title="Refresh severity distribution"
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            <span style={{ fontSize: '0.78rem' }}>Sync</span>
          </button>
        </div>
      </div>

      {/* ── Content Body ────────────────────────────────────────────── */}
      <div className="card-body" style={{ padding: '1.5rem' }}>
        {isLoading && !data && (
          <div style={{ padding: '2.5rem 0' }}>
            <LoadingSpinner message="Calculating severity breakdown..." />
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <AlertTriangle size={18} />
              <span style={{ fontSize: '0.85rem' }}>{error}</span>
            </div>
            <button
              onClick={fetchSeverityData}
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

        {!isLoading && !error && totalCount === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              border: '1px dashed var(--border-subtle)',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-surface-elevated)',
            }}
          >
            <CheckCircle2 size={36} color="var(--success)" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.35rem' }}>
              No Defects Recorded
            </h3>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
              There are currently no active defect records matching this selection. Check back once issues are created or select another project filter.
            </p>
          </div>
        )}

        {!error && totalCount > 0 && (
          <div>
            {/* ── Critical & Blocker Callout Banner ──────────────────── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '0.9rem 1.25rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                backgroundColor:
                  criticalBlockerCount > 0 ? 'rgba(220, 38, 38, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                border: `1px solid ${
                  criticalBlockerCount > 0 ? 'rgba(220, 38, 38, 0.28)' : 'rgba(16, 185, 129, 0.28)'
                }`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {criticalBlockerCount > 0 ? (
                  <ShieldAlert size={22} color="#dc2626" />
                ) : (
                  <CheckCircle2 size={22} color="#10b981" />
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        color: criticalBlockerCount > 0 ? '#ef4444' : '#10b981',
                      }}
                    >
                      {criticalBlockerCount > 0
                        ? 'High-Impact Severity Alert'
                        : 'Optimal Quality Stance'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor:
                          criticalBlockerCount > 0
                            ? 'rgba(220, 38, 38, 0.18)'
                            : 'rgba(16, 185, 129, 0.18)',
                        color: criticalBlockerCount > 0 ? '#ef4444' : '#10b981',
                      }}
                    >
                      {criticalBlockerCount > 0 ? 'Requires Priority Fix' : 'Zero High Risk'}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: '0.2rem 0 0',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {criticalBlockerCount > 0
                      ? `${criticalBlockerCount} issues (${criticalBlockerPct}% of total) are classified as Critical or Blocker severity.`
                      : 'No critical or blocker severity issues are reported in this scope.'}
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                  Critical + Blocker Volume
                </span>
                <span
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: criticalBlockerCount > 0 ? '#ef4444' : '#10b981',
                  }}
                >
                  {criticalBlockerCount}
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, marginLeft: '0.35rem', color: 'var(--text-muted)' }}>
                    ({criticalBlockerPct}%)
                  </span>
                </span>
              </div>
            </div>

            {/* ── Visual Chart & Breakdown Grid ──────────────────────── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.5rem',
                alignItems: 'center',
              }}
            >
              {/* Left Column: Responsive Donut Chart */}
              <div
                style={{
                  height: 280,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.enumKey} fill={entry.color} stroke="var(--bg-surface)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload as {
                            name: string;
                            count: number;
                            pct: number;
                            color: string;
                          };
                          return (
                            <div
                              style={{
                                backgroundColor: 'var(--bg-surface-elevated)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '6px',
                                padding: '0.5rem 0.75rem',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                                <div
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    backgroundColor: item.color,
                                  }}
                                />
                                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                  {item.name}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Count:{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {item.count.toLocaleString()}
                                </strong>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Share:{' '}
                                <strong style={{ color: item.color }}>
                                  {item.pct}%
                                </strong>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Total Label */}
                <div
                  style={{
                    position: 'absolute',
                    top: '44%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: '1.45rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      display: 'block',
                      lineHeight: 1,
                    }}
                  >
                    {totalCount.toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    Defects
                  </span>
                </div>
              </div>

              {/* Right Column: Severity Cards & Progress Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {SEVERITY_CONFIG.map((cfg) => {
                  const count = (data?.[cfg.key as keyof SeverityDistributionResponse] as number) || 0;
                  const pct = totalCount > 0 ? Number(((count / totalCount) * 100).toFixed(1)) : 0;

                  return (
                    <div
                      key={cfg.key}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: `1px solid var(--border-subtle)`,
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.4rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              backgroundColor: cfg.color,
                            }}
                          />
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: cfg.color }}>
                            {cfg.label}
                          </span>
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                            • {cfg.sublabel}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.92rem',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {count.toLocaleString()}
                          </span>
                          <span
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-muted)',
                              marginLeft: '0.35rem',
                              fontWeight: 600,
                            }}
                          >
                            ({pct}%)
                          </span>
                        </div>
                      </div>

                      {/* Percentage Track */}
                      <div
                        style={{
                          width: '100%',
                          height: 7,
                          backgroundColor: 'var(--bg-input)',
                          borderRadius: '999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            backgroundColor: cfg.color,
                            borderRadius: '999px',
                            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
