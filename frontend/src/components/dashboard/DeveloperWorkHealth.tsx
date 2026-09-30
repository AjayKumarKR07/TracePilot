/**
 * DeveloperWorkHealth — Calculates health state from real assigned issues.
 *
 * Rules:
 *   CRITICAL: BLOCKER/CRITICAL severity + active, or URGENT priority + active
 *   NEEDS ATTENTION: HIGH priority, REOPENED status, or aging MEDIUM+ issues (>10d)
 *   HEALTHY: everything else
 *
 * Data: assignedIssues prop (zero extra API calls).
 * RBAC: issues already filtered to assignee = current developer.
 */
import React, { useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Heart,
  Info,
  ShieldAlert,
} from 'lucide-react';
import type { Issue, IssueStatus } from '../../types/issue';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES: IssueStatus[] = [
  'REPORTED', 'TRIAGED', 'ASSIGNED', 'IN_DEVELOPMENT',
  'IN_REVIEW', 'IN_TESTING', 'REOPENED',
];

type HealthState = 'healthy' | 'attention' | 'critical';

interface HealthReason {
  label: string;
  count: number;
  color: string;
}

interface HealthResult {
  state: HealthState;
  activeCount: number;
  reasons: HealthReason[];
}

function computeHealth(issues: Issue[]): HealthResult {
  const active = issues.filter((i) => ACTIVE_STATUSES.includes(i.status));
  const reasons: HealthReason[] = [];

  const blockerCritical = active.filter(
    (i) => i.severity === 'BLOCKER' || i.severity === 'CRITICAL'
  );
  const urgentPriority = active.filter((i) => i.priority === 'URGENT');
  const reopened = active.filter((i) => i.status === 'REOPENED');
  const highPriority = active.filter((i) => i.priority === 'HIGH');
  const agingMediumPlus = active.filter((i) => {
    const ageDays =
      (Date.now() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return (
      (i.priority === 'MEDIUM' || i.priority === 'HIGH') && ageDays > 10
    );
  });

  let state: HealthState = 'healthy';

  if (blockerCritical.length > 0) {
    state = 'critical';
    reasons.push({
      label: `BLOCKER/CRITICAL severity active`,
      count: blockerCritical.length,
      color: '#f87171',
    });
  }
  if (urgentPriority.length > 0) {
    state = 'critical';
    reasons.push({
      label: `URGENT priority active`,
      count: urgentPriority.length,
      color: '#f87171',
    });
  }
  if (reopened.length > 0) {
    if (state === 'healthy') state = 'attention';
    reasons.push({
      label: 'Reopened issues',
      count: reopened.length,
      color: '#fb923c',
    });
  }
  if (highPriority.length > 0) {
    if (state === 'healthy') state = 'attention';
    reasons.push({
      label: 'HIGH priority active',
      count: highPriority.length,
      color: '#fbbf24',
    });
  }
  if (agingMediumPlus.length > 0) {
    if (state === 'healthy') state = 'attention';
    reasons.push({
      label: 'Issues aging beyond 10 days',
      count: agingMediumPlus.length,
      color: '#fbbf24',
    });
  }

  return { state, activeCount: active.length, reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<
  HealthState,
  {
    icon: React.ReactNode;
    label: string;
    color: string;
    bg: string;
    border: string;
    desc: string;
  }
> = {
  healthy: {
    icon: <CheckCircle2 size={22} />,
    label: 'Healthy',
    color: '#34d399',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.3)',
    desc: 'Your workload is in good shape.',
  },
  attention: {
    icon: <AlertCircle size={22} />,
    label: 'Needs Attention',
    color: '#fbbf24',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.3)',
    desc: 'Some issues require your focus.',
  },
  critical: {
    icon: <ShieldAlert size={22} />,
    label: 'Critical',
    color: '#f87171',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.3)',
    desc: 'High-severity issues need immediate attention.',
  },
};

interface Props {
  assignedIssues: Issue[];
}

export const DeveloperWorkHealth: React.FC<Props> = ({ assignedIssues }) => {
  const health = useMemo(() => computeHealth(assignedIssues), [assignedIssues]);
  const cfg = STATE_CONFIG[health.state];

  return (
    <section
      className="card"
      style={{
        padding: '1.25rem',
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <Heart size={17} style={{ color: cfg.color }} />
        <h3
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          My Work Health
        </h3>
        <span
          title="Calculated from your active assigned issues using priority, severity, and age rules. Not a database-backed field."
          style={{
            cursor: 'help',
            color: 'var(--text-muted)',
            display: 'inline-flex',
          }}
        >
          <Info size={13} />
        </span>
      </div>

      {/* State pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          background: `${cfg.color}18`,
          border: `1px solid ${cfg.color}44`,
          marginBottom: '0.85rem',
        }}
      >
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <div>
          <div
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: cfg.color,
              lineHeight: 1.1,
            }}
          >
            {cfg.label}
          </div>
          <div
            style={{
              fontSize: '0.76rem',
              color: 'var(--text-secondary)',
              marginTop: '0.15rem',
            }}
          >
            {cfg.desc}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'flex',
          gap: '0.65rem',
          marginBottom: health.reasons.length > 0 ? '0.85rem' : 0,
        }}
      >
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '0.55rem',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
            }}
          >
            {assignedIssues.length}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Total Assigned
          </div>
        </div>
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '0.55rem',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
            }}
          >
            {health.activeCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Active
          </div>
        </div>
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '0.55rem',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: '#34d399',
            }}
          >
            {assignedIssues.filter((i) =>
              ['RESOLVED', 'CLOSED'].includes(i.status)
            ).length}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Resolved
          </div>
        </div>
      </div>

      {/* Reasons */}
      {health.reasons.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
          }}
        >
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.2rem',
            }}
          >
            Attention Factors
          </div>
          {health.reasons.map((r) => (
            <div
              key={r.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.35rem 0.65rem',
                background: 'var(--bg-surface-elevated)',
                borderRadius: '6px',
                fontSize: '0.78rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: r.color }}>{r.count}</span>
            </div>
          ))}
        </div>
      )}

      <p
        style={{
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          margin: '0.75rem 0 0 0',
          fontStyle: 'italic',
        }}
      >
        Informational estimate based on priority, severity, and age. Not a database-backed SLA.
      </p>
    </section>
  );
};
