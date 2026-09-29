/**
 * UserResolutionPerformance — Real resolution metrics for the authenticated user.
 *
 * Uses REAL timestamps from userIssues:
 *   - resolved_at field when available (set by backend on PATCH /issues/{id}/resolve)
 *   - Falls back to updated_at for RESOLVED/CLOSED issues when resolved_at is absent
 *   - created_at for elapsed time
 *
 * NOTE: The Issue list response (Issue type) does NOT include resolved_at
 * (that field is only on IssueDetail). So we use updated_at as the proxy
 * for resolution time for issues with status RESOLVED or CLOSED.
 * This is consistent with how avgResolutionDays is already computed in DashboardPage.
 *
 * Data: userIssues already loaded. Zero extra API calls.
 * RBAC: userIssues scoped to reporter_id = current_user by backend.
 */
import React, { useMemo } from 'react';
import { CheckCircle2, Clock, Target, TrendingUp } from 'lucide-react';
import type { Issue, IssueStatus } from '../../types/issue';

const RESOLVED_STATUSES: IssueStatus[] = ['RESOLVED', 'CLOSED'];

function formatDays(days: number): string {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours}h`;
  }
  if (days === Math.floor(days)) return `${days}d`;
  return `${days.toFixed(1)}d`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance computation
// ─────────────────────────────────────────────────────────────────────────────
interface PerfMetrics {
  total: number;
  resolved: number;
  resolutionRate: number;
  avgResolutionDays: number | null;
  fastestDays: number | null;
  slowestDays: number | null;
}

function computePerformance(userIssues: Issue[]): PerfMetrics {
  const total = userIssues.length;
  const resolvedIssues = userIssues.filter((i) => RESOLVED_STATUSES.includes(i.status));
  const resolved = resolvedIssues.length;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Compute resolution times from updated_at - created_at for resolved issues
  const times = resolvedIssues
    .filter((i) => i.updated_at && i.created_at)
    .map((i) => {
      const ms = new Date(i.updated_at).getTime() - new Date(i.created_at).getTime();
      return ms / (1000 * 60 * 60 * 24); // days
    })
    .filter((d) => d >= 0);

  if (times.length === 0) {
    return { total, resolved, resolutionRate, avgResolutionDays: null, fastestDays: null, slowestDays: null };
  }

  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const fastest = Math.min(...times);
  const slowest = Math.max(...times);

  return {
    total,
    resolved,
    resolutionRate,
    avgResolutionDays: Math.round(avg * 10) / 10,
    fastestDays: Math.round(fastest * 10) / 10,
    slowestDays: Math.round(slowest * 10) / 10,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  userIssues: Issue[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export const UserResolutionPerformance: React.FC<Props> = ({ userIssues }) => {
  const metrics = useMemo(() => computePerformance(userIssues), [userIssues]);
  const rateColor =
    metrics.resolutionRate >= 75
      ? '#34d399'
      : metrics.resolutionRate >= 40
      ? '#fbbf24'
      : '#f87171';

  // Summary stat cards
  const stats = [
    {
      label: 'Total Issues',
      value: metrics.total.toString(),
      icon: <TrendingUp size={16} />,
      color: '#818cf8',
    },
    {
      label: 'Resolved',
      value: metrics.resolved.toString(),
      icon: <CheckCircle2 size={16} />,
      color: '#34d399',
    },
    {
      label: 'Resolution Rate',
      value: `${metrics.resolutionRate}%`,
      icon: <Target size={16} />,
      color: rateColor,
    },
    {
      label: 'Avg Resolution',
      value: metrics.avgResolutionDays !== null ? formatDays(metrics.avgResolutionDays) : '—',
      icon: <Clock size={16} />,
      color: '#38bdf8',
      sub: 'based on closed issues',
    },
  ];

  return (
    <section className="card" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <TrendingUp size={18} color="#818cf8" />
        <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          My Resolution Performance
        </span>
      </div>

      {/* Empty state */}
      {metrics.total === 0 ? (
        <div
          style={{
            padding: '2rem 0',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <TrendingUp size={28} style={{ opacity: 0.25 }} />
          <span>Resolution performance will appear after your first reported issue.</span>
        </div>
      ) : (
        <>
          {/* Metric Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.65rem',
              marginBottom: metrics.resolved > 0 ? '1rem' : 0,
            }}
          >
            {stats.map(({ label, value, icon, color, sub }) => (
              <div
                key={label}
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: `1px solid ${color}22`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem', color }}>
                  {icon}
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{label}</span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color, lineHeight: 1 }}>
                  {value}
                </div>
                {sub && (
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {sub}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* No resolved issues note */}
          {metrics.resolved === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: '0.5rem 0 0' }}>
              Resolution performance will appear after your first resolved issue.
            </p>
          )}

          {/* Fastest / Slowest */}
          {metrics.fastestDays !== null && metrics.slowestDays !== null && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.55rem',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  Fastest Resolution
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#34d399' }}>
                  {formatDays(metrics.fastestDays)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  Slowest Resolution
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#f87171' }}>
                  {formatDays(metrics.slowestDays)}
                </div>
              </div>
            </div>
          )}

          {/* Resolution rate progress bar */}
          {metrics.total > 0 && (
            <div style={{ marginTop: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Resolution progress
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: rateColor }}>
                  {metrics.resolved} / {metrics.total}
                </span>
              </div>
              <div
                style={{
                  height: '6px',
                  backgroundColor: 'var(--border-subtle)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${metrics.resolutionRate}%`,
                    backgroundColor: rateColor,
                    borderRadius: '999px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
