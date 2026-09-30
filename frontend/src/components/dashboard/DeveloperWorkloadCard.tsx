/**
 * DeveloperWorkloadCard — Shows developer's issue distribution by status.
 *
 * Data: assignedIssues prop (zero extra API calls).
 * RBAC: issues already filtered to assignee = current developer.
 * Uses REAL issue data only — no team-global numbers.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import type { Issue, IssueStatus } from '../../types/issue';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

interface StatusBucket {
  status: IssueStatus;
  label: string;
  color: string;
}

const STATUS_BUCKETS: StatusBucket[] = [
  { status: 'IN_DEVELOPMENT', label: 'In Development', color: '#818cf8' },
  { status: 'IN_TESTING',     label: 'In Testing',     color: '#34d399' },
  { status: 'IN_REVIEW',      label: 'In Review',      color: '#38bdf8' },
  { status: 'REOPENED',       label: 'Reopened',       color: '#f87171' },
  { status: 'REPORTED',       label: 'Reported',       color: '#94a3b8' },
  { status: 'TRIAGED',        label: 'Triaged',        color: '#94a3b8' },
  { status: 'ASSIGNED',       label: 'Assigned',       color: '#a78bfa' },
  { status: 'RESOLVED',       label: 'Resolved',       color: '#10b981' },
  { status: 'CLOSED',         label: 'Closed',         color: '#6b7280' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  assignedIssues: Issue[];
}

export const DeveloperWorkloadCard: React.FC<Props> = ({ assignedIssues }) => {
  const buckets = useMemo(() => {
    const counts: Record<string, number> = {};
    assignedIssues.forEach((i) => {
      counts[i.status] = (counts[i.status] || 0) + 1;
    });
    return STATUS_BUCKETS.filter((b) => counts[b.status] > 0).map((b) => ({
      ...b,
      count: counts[b.status] ?? 0,
    }));
  }, [assignedIssues]);

  const total = assignedIssues.length;
  const activeCount = assignedIssues.filter(
    (i) => !['RESOLVED', 'CLOSED'].includes(i.status)
  ).length;

  return (
    <section
      className="card"
      style={{
        padding: '1.25rem',
        border: '1px solid rgba(99,102,241,0.2)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={17} style={{ color: '#818cf8' }} />
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Developer Workload
          </h3>
        </div>
        <Link
          to="/developer-issues"
          style={{ fontSize: '0.75rem', color: 'var(--primary)' }}
        >
          All Issues
        </Link>
      </div>

      {total === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            No issues are currently assigned to you.
          </p>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              marginBottom: '1rem',
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
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                }}
              >
                {total}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
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
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#fbbf24',
                }}
              >
                {activeCount}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
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
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#34d399',
                }}
              >
                {total - activeCount}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Resolved
              </div>
            </div>
          </div>

          {/* Distribution bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {buckets.map((b) => {
              const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
              return (
                <div key={b.status}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.2rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {b.label}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: b.color,
                      }}
                    >
                      {b.count}
                    </span>
                  </div>
                  <div
                    style={{
                      height: '5px',
                      background: 'var(--border-subtle)',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: b.color,
                        borderRadius: '999px',
                        transition: 'width 0.35s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
