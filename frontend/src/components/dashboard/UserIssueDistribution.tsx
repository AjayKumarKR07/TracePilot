/**
 * UserIssueDistribution — Priority & Severity distribution from userIssues.
 *
 * Data: computed from already-loaded userIssues prop (zero extra API calls).
 *
 * CONFIRMED enum values from backend/app/models/issue.py:
 *   Priority: LOW, MEDIUM, HIGH, URGENT
 *   Severity: MINOR, MAJOR, CRITICAL, BLOCKER
 *
 * The global analyticsApi returns team/system data — NOT used here because
 * this is the USER dashboard (RBAC: only authenticated user's own issues).
 */
import React, { useMemo } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Flag,
} from 'lucide-react';
import type { Issue } from '../../types/issue';

// ─────────────────────────────────────────────────────────────────────────────
// Config (actual enum values from backend)
// ─────────────────────────────────────────────────────────────────────────────
const PRIORITY_ORDER = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;
const PRIORITY_COLORS: Record<string, string> = {
  URGENT: '#f87171',
  HIGH:   '#fb923c',
  MEDIUM: '#fbbf24',
  LOW:    '#818cf8',
};
const PRIORITY_LABELS: Record<string, string> = {
  URGENT: 'Urgent',
  HIGH:   'High',
  MEDIUM: 'Medium',
  LOW:    'Low',
};

const SEVERITY_ORDER = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR'] as const;
const SEVERITY_COLORS: Record<string, string> = {
  BLOCKER:  '#dc2626',
  CRITICAL: '#f87171',
  MAJOR:    '#fb923c',
  MINOR:    '#34d399',
};
const SEVERITY_LABELS: Record<string, string> = {
  BLOCKER:  'Blocker',
  CRITICAL: 'Critical',
  MAJOR:    'Major',
  MINOR:    'Minor',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
interface DistBar {
  key: string;
  label: string;
  count: number;
  pct: number;
  color: string;
}

function countDist<K extends string>(
  issues: Issue[],
  field: keyof Issue,
  order: readonly K[],
  colors: Record<string, string>,
  labels: Record<string, string>
): DistBar[] {
  const counts: Record<string, number> = {};
  order.forEach((k) => (counts[k] = 0));
  issues.forEach((i) => {
    const val = i[field] as string;
    if (val in counts) counts[val]++;
  });
  const total = issues.length || 1;
  return order.map((k) => ({
    key: k,
    label: labels[k] || k,
    count: counts[k],
    pct: Math.round((counts[k] / total) * 100),
    color: colors[k] || '#818cf8',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar Row
// ─────────────────────────────────────────────────────────────────────────────
const DistBarRow: React.FC<{ bar: DistBar; maxCount: number }> = ({ bar, maxCount }) => {
  const widthPct = maxCount > 0 ? Math.round((bar.count / maxCount) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
      <span
        style={{
          fontSize: '0.75rem',
          color: bar.count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
          minWidth: '58px',
          textAlign: 'right',
          fontWeight: bar.count > 0 ? 600 : 400,
        }}
      >
        {bar.label}
      </span>
      <div
        style={{
          flex: 1,
          height: '8px',
          backgroundColor: 'var(--border-subtle)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}
      >
        {widthPct > 0 && (
          <div
            style={{
              height: '100%',
              width: `${widthPct}%`,
              backgroundColor: bar.color,
              borderRadius: '999px',
              transition: 'width 0.4s ease',
            }}
          />
        )}
      </div>
      <span
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: bar.count > 0 ? bar.color : 'var(--text-muted)',
          minWidth: '28px',
          textAlign: 'right',
        }}
      >
        {bar.count}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  userIssues: Issue[];
}

export const UserIssueDistribution: React.FC<Props> = ({ userIssues }) => {
  const priorityBars = useMemo(
    () => countDist(userIssues, 'priority', PRIORITY_ORDER, PRIORITY_COLORS, PRIORITY_LABELS),
    [userIssues]
  );
  const severityBars = useMemo(
    () => countDist(userIssues, 'severity', SEVERITY_ORDER, SEVERITY_COLORS, SEVERITY_LABELS),
    [userIssues]
  );

  const maxPriority = Math.max(...priorityBars.map((b) => b.count), 1);
  const maxSeverity = Math.max(...severityBars.map((b) => b.count), 1);

  if (userIssues.length === 0) {
    return (
      <section className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <BarChart3 size={18} color="#818cf8" />
          <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            My Issue Distribution
          </span>
        </div>
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
          <BarChart3 size={28} style={{ opacity: 0.25 }} />
          <span>No issue distribution data yet.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="card" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <BarChart3 size={18} color="#818cf8" />
        <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          My Issue Distribution
        </span>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '0.1rem 0.45rem',
            borderRadius: '999px',
            backgroundColor: 'rgba(129,140,248,0.15)',
            color: '#818cf8',
            marginLeft: 'auto',
          }}
        >
          {userIssues.length} total
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Priority */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
            <Flag size={13} color="#f59e0b" />
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Priority
            </span>
          </div>
          {priorityBars.map((bar) => (
            <DistBarRow key={bar.key} bar={bar} maxCount={maxPriority} />
          ))}
        </div>

        {/* Severity */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
            <AlertTriangle size={13} color="#f87171" />
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Severity
            </span>
          </div>
          {severityBars.map((bar) => (
            <DistBarRow key={bar.key} bar={bar} maxCount={maxSeverity} />
          ))}
        </div>
      </div>
    </section>
  );
};
