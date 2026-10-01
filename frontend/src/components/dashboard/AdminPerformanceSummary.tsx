/**
 * AdminPerformanceSummary
 * Shows system-level performance metrics derived from AdminDashboardResponse + QualityMetricsResponse.
 * Props-driven, no extra API calls.
 */
import React from 'react';
import { BarChart3, CheckCircle2, Clock, RotateCcw, TrendingUp, Zap } from 'lucide-react';
import type { AdminDashboardResponse } from '../../types/admin';
import type { QualityMetricsResponse } from '../../types/analytics';

interface Props {
  stats: AdminDashboardResponse;
  quality: QualityMetricsResponse | null;
}

interface Metric {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}

export const AdminPerformanceSummary: React.FC<Props> = ({ stats, quality }) => {
  const totalIssues = stats.issues.total || 1;
  const resolvedClosed = stats.issues.resolved + stats.issues.closed;
  const resolutionRate = Math.round((resolvedClosed / totalIssues) * 100);
  const reopenRate = Math.round((stats.issues.reopened / totalIssues) * 100);
  const criticalRate = Math.round(((stats.severity.critical + stats.severity.blocker) / totalIssues) * 100);

  const totalSprints = (stats.sprints?.completed || 0) + (stats.sprints?.active || 0) + (stats.sprints?.in_progress || 0) + (stats.sprints?.planned || 0);
  const sprintCompletionRate = totalSprints > 0 ? Math.round(((stats.sprints?.completed || 0) / totalSprints) * 100) : 0;

  const mttr = quality?.mttr_hours !== null && quality?.mttr_hours !== undefined
    ? quality.mttr_hours >= 24
      ? `${(quality.mttr_hours / 24).toFixed(1)}d`
      : `${quality.mttr_hours.toFixed(1)}h`
    : 'N/A';

  const metrics: Metric[] = [
    {
      label: 'Resolution Rate',
      value: `${resolutionRate}%`,
      sub: `${resolvedClosed.toLocaleString()} of ${totalIssues.toLocaleString()} issues`,
      icon: <CheckCircle2 size={16} />,
      color: resolutionRate >= 75 ? '#10b981' : resolutionRate >= 50 ? '#f59e0b' : '#ef4444',
      trend: resolutionRate >= 75 ? 'up' : 'down',
    },
    {
      label: 'Avg Resolution Time',
      value: mttr,
      sub: quality ? 'Mean Time To Resolve' : 'Not available',
      icon: <Clock size={16} />,
      color: '#38bdf8',
    },
    {
      label: 'Reopen Rate',
      value: `${reopenRate}%`,
      sub: `${stats.issues.reopened.toLocaleString()} reopened issues`,
      icon: <RotateCcw size={16} />,
      color: reopenRate > 15 ? '#ef4444' : reopenRate > 5 ? '#f59e0b' : '#10b981',
    },
    {
      label: 'Critical Issue Rate',
      value: `${criticalRate}%`,
      sub: `${(stats.severity.critical + stats.severity.blocker).toLocaleString()} critical/blocker`,
      icon: <Zap size={16} />,
      color: criticalRate > 10 ? '#ef4444' : criticalRate > 3 ? '#f59e0b' : '#10b981',
    },
    {
      label: 'Sprint Completion',
      value: `${sprintCompletionRate}%`,
      sub: `${stats.sprints?.completed || 0} of ${totalSprints} sprints`,
      icon: <TrendingUp size={16} />,
      color: sprintCompletionRate >= 70 ? '#10b981' : sprintCompletionRate >= 40 ? '#f59e0b' : '#ef4444',
    },
    {
      label: 'Backlog Health',
      value: quality ? `${quality.backlog_health_score}/100` : 'N/A',
      sub: quality ? 'Composite backlog score' : 'Quality data unavailable',
      icon: <BarChart3 size={16} />,
      color: quality && quality.backlog_health_score >= 70 ? '#10b981' : quality && quality.backlog_health_score >= 40 ? '#f59e0b' : '#ef4444',
    },
  ];

  return (
    <section className="card" style={{ border: '1px solid var(--border-subtle)' }}>
      <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={14} />
          </div>
          <h2 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Performance Summary</h2>
        </div>
      </div>
      <div className="card-body" style={{ padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem' }}>
          {metrics.map((m) => (
            <div key={m.label} style={{ padding: '0.85rem', borderRadius: '9px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: m.color }}>{m.icon}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>{m.label}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AdminPerformanceSummary;
