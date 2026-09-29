/**
 * UserSlaTracker — Resolution age tracker using existing issue timestamps.
 *
 * TracePilot has NO SLA database field. Instead, this component uses
 * priority-based age thresholds derived from industry best practices:
 *
 *   URGENT   → target 2 days, due-soon 3 days
 *   HIGH     → target 5 days, due-soon 7 days
 *   MEDIUM   → target 10 days, due-soon 14 days
 *   LOW      → target 21 days, due-soon 28 days
 *
 * "Age" = now - created_at for open (non-RESOLVED, non-CLOSED) issues.
 * These are INFORMATIONAL estimates only — not database-backed SLA records.
 *
 * Data: userIssues already loaded in DashboardPage. Zero extra API calls.
 * RBAC: userIssues is already scoped to reporter_id = current_user.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  CheckCircle2,
  Clock3,
  Eye,
  Timer,
} from 'lucide-react';
import type { Issue, IssueStatus } from '../../types/issue';
import { PriorityBadge } from '../common/PriorityBadge';
import { SeverityBadge } from '../common/SeverityBadge';

// ─────────────────────────────────────────────────────────────────────────────
// SLA thresholds by priority (in hours)
// ─────────────────────────────────────────────────────────────────────────────
const SLA_CONFIG: Record<string, { targetH: number; dueSoonH: number }> = {
  URGENT: { targetH: 48, dueSoonH: 36 },
  HIGH:   { targetH: 120, dueSoonH: 96 },
  MEDIUM: { targetH: 240, dueSoonH: 192 },
  LOW:    { targetH: 504, dueSoonH: 432 },
};

const ACTIVE_STATUSES: IssueStatus[] = [
  'REPORTED', 'TRIAGED', 'ASSIGNED',
  'IN_DEVELOPMENT', 'IN_REVIEW', 'IN_TESTING', 'REOPENED',
];

type SlaState = 'within' | 'due_soon' | 'overdue';

interface IssueWithAge {
  issue: Issue;
  ageHours: number;
  ageDays: number;
  ageLabel: string;
  sla: SlaState;
  targetH: number;
  pct: number; // 0-100 progress toward overdue
}

function formatAge(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function computeSla(issue: Issue): IssueWithAge {
  const cfg = SLA_CONFIG[issue.priority] ?? SLA_CONFIG.MEDIUM;
  const ageMs = Date.now() - new Date(issue.created_at).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageDays = ageHours / 24;

  let sla: SlaState;
  if (ageHours >= cfg.targetH) sla = 'overdue';
  else if (ageHours >= cfg.dueSoonH) sla = 'due_soon';
  else sla = 'within';

  const pct = Math.min(100, Math.round((ageHours / cfg.targetH) * 100));

  return {
    issue,
    ageHours,
    ageDays,
    ageLabel: formatAge(ageHours),
    sla,
    targetH: cfg.targetH,
    pct,
  };
}

function slaColor(sla: SlaState): string {
  if (sla === 'overdue') return '#f87171';
  if (sla === 'due_soon') return '#fbbf24';
  return '#34d399';
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
export const UserSlaTracker: React.FC<Props> = ({ userIssues }) => {
  const enriched = useMemo<IssueWithAge[]>(() => {
    return userIssues
      .filter((i) => ACTIVE_STATUSES.includes(i.status))
      .map(computeSla)
      .sort((a, b) => {
        // Sort: overdue first, then due_soon, then within; within each group newest first
        const order: Record<SlaState, number> = { overdue: 0, due_soon: 1, within: 2 };
        if (order[a.sla] !== order[b.sla]) return order[a.sla] - order[b.sla];
        return b.ageHours - a.ageHours;
      });
  }, [userIssues]);

  const withinCount = enriched.filter((e) => e.sla === 'within').length;
  const dueSoonCount = enriched.filter((e) => e.sla === 'due_soon').length;
  const overdueCount = enriched.filter((e) => e.sla === 'overdue').length;
  const total = enriched.length;

  const headerBorderColor =
    overdueCount > 0
      ? 'rgba(248,113,113,0.35)'
      : dueSoonCount > 0
      ? 'rgba(251,191,36,0.35)'
      : 'rgba(52,211,153,0.25)';

  const headerBgColor =
    overdueCount > 0
      ? 'rgba(248,113,113,0.04)'
      : dueSoonCount > 0
      ? 'rgba(251,191,36,0.04)'
      : 'rgba(52,211,153,0.04)';

  return (
    <section
      className="card"
      style={{
        padding: '1.25rem',
        border: `1px solid ${headerBorderColor}`,
        backgroundColor: headerBgColor,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Timer size={18} color={overdueCount > 0 ? '#f87171' : '#818cf8'} />
        <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          Resolution SLA
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
          Age-based estimate
        </span>
      </div>

      {/* Empty state */}
      {total === 0 ? (
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
          <CheckCircle2 size={28} color="#34d399" style={{ opacity: 0.5 }} />
          <span>All your reported issues are currently resolved.</span>
        </div>
      ) : (
        <>
          {/* Summary counters */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.6rem',
              marginBottom: '1rem',
            }}
          >
            {[
              { label: 'Within Target', count: withinCount, color: '#34d399', icon: <CheckCircle2 size={14} /> },
              { label: 'Due Soon', count: dueSoonCount, color: '#fbbf24', icon: <Clock3 size={14} /> },
              { label: 'Overdue', count: overdueCount, color: '#f87171', icon: <AlertOctagon size={14} /> },
            ].map(({ label, count, color, icon }) => (
              <div
                key={label}
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: `1px solid ${color}33`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.75rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.3rem', color }}>
                  {icon}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: '800', color }}>{count}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Issue list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {enriched.slice(0, 6).map(({ issue, ageLabel, sla, pct }) => (
              <div
                key={issue.id}
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: `1px solid ${slaColor(sla)}33`,
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 0.9rem',
                }}
              >
                {/* Row 1 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.35rem',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        color: 'var(--primary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {issue.issue_key}
                    </span>
                    <PriorityBadge priority={issue.priority} />
                    <SeverityBadge severity={issue.severity} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: slaColor(sla),
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      {sla === 'overdue' && <AlertOctagon size={11} />}
                      {sla === 'due_soon' && <Clock3 size={11} />}
                      {sla === 'within' && <CheckCircle2 size={11} />}
                      {sla === 'overdue' ? 'Overdue' : sla === 'due_soon' ? 'Due Soon' : 'On Track'}
                    </span>
                    <Link
                      to={`/issues/${issue.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.15rem 0.4rem' }}
                    >
                      <Eye size={11} />
                    </Link>
                  </div>
                </div>

                {/* Title */}
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    marginBottom: '0.45rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {issue.title}
                </div>

                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      flex: 1,
                      height: '4px',
                      backgroundColor: 'var(--border-subtle)',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: slaColor(sla),
                        borderRadius: '999px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      minWidth: '45px',
                      textAlign: 'right',
                    }}
                  >
                    Age: {ageLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Disclosure */}
          <p
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              marginTop: '0.75rem',
              lineHeight: 1.4,
            }}
          >
            Thresholds are estimates (URGENT: 2d, HIGH: 5d, MEDIUM: 10d, LOW: 21d). Not a database-backed SLA.
          </p>
        </>
      )}
    </section>
  );
};
