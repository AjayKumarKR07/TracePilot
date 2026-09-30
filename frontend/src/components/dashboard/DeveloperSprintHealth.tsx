/**
 * DeveloperSprintHealth — Sprint health view using developer's assigned sprints.
 *
 * Uses: total_issues, completed_issues, progress_percentage from Sprint type.
 * These are optional fields — falls back gracefully if absent.
 * Zero extra API calls.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Layers,
  Target,
} from 'lucide-react';
import type { Sprint } from '../../types/Sprint';
import { formatDate } from '../../utils/formatters';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'IN_PROGRESS': return '#fbbf24';
    case 'ACTIVE': return '#818cf8';
    case 'READY_FOR_APPROVAL': return '#22d3ee';
    case 'COMPLETED': return '#34d399';
    case 'ARCHIVED': return 'var(--text-muted)';
    default: return 'var(--text-secondary)';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'IN_PROGRESS': return 'In Progress';
    case 'ACTIVE': return 'Active';
    case 'READY_FOR_APPROVAL': return 'Awaiting Approval';
    case 'COMPLETED': return 'Completed';
    case 'PLANNED': return 'Planned';
    case 'ARCHIVED': return 'Archived';
    default: return status.replace(/_/g, ' ');
  }
}

interface SprintStats {
  total: number;
  active: number;
  inProgress: number;
  completed: number;
  totalIssues: number;
  completedIssues: number;
  avgCompletion: number;
}

function computeStats(sprints: Sprint[]): SprintStats {
  const total = sprints.length;
  const active = sprints.filter((s) => s.status === 'ACTIVE').length;
  const inProgress = sprints.filter((s) => s.status === 'IN_PROGRESS').length;
  const completed = sprints.filter((s) => s.status === 'COMPLETED').length;

  const totalIssues = sprints.reduce(
    (sum, s) => sum + (s.total_issues ?? 0),
    0
  );
  const completedIssues = sprints.reduce(
    (sum, s) => sum + (s.completed_issues ?? 0),
    0
  );
  const avgCompletion =
    sprints.length === 0
      ? 0
      : Math.round(
          sprints.reduce((sum, s) => sum + (s.progress_percentage ?? 0), 0) /
            sprints.length
        );

  return { total, active, inProgress, completed, totalIssues, completedIssues, avgCompletion };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  assignedSprints: Sprint[];
}

export const DeveloperSprintHealth: React.FC<Props> = ({ assignedSprints }) => {
  const stats = useMemo(() => computeStats(assignedSprints), [assignedSprints]);

  const activeSprints = useMemo(
    () =>
      assignedSprints.filter(
        (s) => s.status === 'IN_PROGRESS' || s.status === 'ACTIVE'
      ),
    [assignedSprints]
  );

  return (
    <section
      className="card"
      style={{
        padding: '1.25rem',
        border: '1px solid rgba(99,102,241,0.25)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
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
          <Layers size={17} style={{ color: '#818cf8' }} />
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Sprint Health
          </h3>
        </div>
        <Link
          to="/developer-sprints"
          style={{ fontSize: '0.75rem', color: 'var(--primary)' }}
        >
          All Sprints
        </Link>
      </div>

      {assignedSprints.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
            border: '1px dashed var(--border-subtle)',
            textAlign: 'center',
          }}
        >
          <Layers
            size={28}
            style={{ opacity: 0.3, marginBottom: '0.5rem', color: '#818cf8' }}
          />
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            No active sprints are assigned to you.
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.55rem',
              marginBottom: '0.85rem',
            }}
          >
            {[
              { label: 'Total', value: stats.total, color: '#818cf8' },
              { label: 'In Progress', value: stats.inProgress, color: '#fbbf24' },
              { label: 'Completed', value: stats.completed, color: '#34d399' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  textAlign: 'center',
                  padding: '0.5rem 0.35rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: '8px',
                }}
              >
                <div
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: s.color,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.1rem',
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Issue completion */}
          {stats.totalIssues > 0 && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                background: 'var(--bg-surface-elevated)',
                borderRadius: '8px',
                marginBottom: '0.85rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.45rem',
                }}
              >
                <span
                  style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}
                >
                  <Target size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />
                  Issues Completed
                </span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {stats.completedIssues} / {stats.totalIssues}
                </span>
              </div>
              <div
                style={{
                  height: '6px',
                  background: 'var(--border-subtle)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${
                      stats.totalIssues > 0
                        ? Math.round(
                            (stats.completedIssues / stats.totalIssues) * 100
                          )
                        : 0
                    }%`,
                    height: '100%',
                    background: '#34d399',
                    borderRadius: '999px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Active sprint rows */}
          {activeSprints.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '0.2rem',
                }}
              >
                Active Sprints
              </div>
              {activeSprints.slice(0, 4).map((s) => {
                const pct = s.progress_percentage ?? 0;
                return (
                  <div
                    key={s.id}
                    style={{
                      padding: '0.55rem 0.75rem',
                      background: 'var(--bg-surface-elevated)',
                      borderRadius: '7px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <Link
                        to={`/developer-sprints?sprintId=${s.id}`}
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          textDecoration: 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '200px',
                        }}
                        title={s.name}
                      >
                        {s.name}
                      </Link>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: statusColor(s.status),
                        }}
                      >
                        {statusLabel(s.status)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: '4px',
                          background: 'var(--border-subtle)',
                          borderRadius: '999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background:
                              pct >= 80
                                ? '#34d399'
                                : pct >= 50
                                ? '#fbbf24'
                                : '#818cf8',
                            borderRadius: '999px',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          minWidth: '28px',
                        }}
                      >
                        {pct}%
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '0.6rem',
                        marginTop: '0.3rem',
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>
                        <Clock size={10} style={{ display: 'inline', marginRight: '0.2rem' }} />
                        {formatDate(s.end_date)}
                      </span>
                      {s.total_issues != null && (
                        <span>
                          <CheckCircle2 size={10} style={{ display: 'inline', marginRight: '0.2rem' }} />
                          {s.completed_issues ?? 0}/{s.total_issues} issues
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
};
