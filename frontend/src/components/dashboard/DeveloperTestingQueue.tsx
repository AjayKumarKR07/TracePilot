/**
 * DeveloperTestingQueue — Shows assigned issues currently in testing/review/reopened states.
 *
 * Groups:
 *   - Testing Required: IN_TESTING
 *   - Review Required: IN_REVIEW
 *   - Reopened: REOPENED
 *
 * Data: assignedIssues prop (zero extra API calls).
 * Actions: View Issue only — no automatic state changes.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  Code2,
  ExternalLink,
  Eye,
  RotateCcw,
} from 'lucide-react';
import type { Issue, IssueStatus } from '../../types/issue';
import { PriorityBadge } from '../common/PriorityBadge';
import { SeverityBadge } from '../common/SeverityBadge';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

interface QueueGroup {
  key: IssueStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
  emptyMsg: string;
}

const GROUPS: QueueGroup[] = [
  {
    key: 'IN_TESTING',
    label: 'Testing Required',
    icon: <ClipboardCheck size={15} />,
    color: '#34d399',
    emptyMsg: 'No issues currently in testing.',
  },
  {
    key: 'IN_REVIEW',
    label: 'Review Required',
    icon: <Eye size={15} />,
    color: '#818cf8',
    emptyMsg: 'No issues currently in review.',
  },
  {
    key: 'REOPENED',
    label: 'Reopened',
    icon: <RotateCcw size={15} />,
    color: '#f87171',
    emptyMsg: 'No reopened issues assigned to you.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  assignedIssues: Issue[];
}

export const DeveloperTestingQueue: React.FC<Props> = ({ assignedIssues }) => {
  const grouped = useMemo(() => {
    const map: Record<string, Issue[]> = {
      IN_TESTING: [],
      IN_REVIEW: [],
      REOPENED: [],
    };
    assignedIssues.forEach((issue) => {
      if (map[issue.status]) {
        map[issue.status].push(issue);
      }
    });
    // sort each group by priority then updated_at
    const priorityWeight: Record<string, number> = {
      URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
    };
    Object.values(map).forEach((list) => {
      list.sort((a, b) => {
        const pw = (priorityWeight[a.priority] ?? 4) - (priorityWeight[b.priority] ?? 4);
        if (pw !== 0) return pw;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    });
    return map;
  }, [assignedIssues]);

  const totalCount =
    grouped.IN_TESTING.length +
    grouped.IN_REVIEW.length +
    grouped.REOPENED.length;

  return (
    <section
      className="card"
      style={{
        padding: '1.25rem',
        border: '1px solid rgba(52,211,153,0.25)',
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
          <Code2 size={18} style={{ color: '#34d399' }} />
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Testing &amp; Review Queue
          </h2>
          {totalCount > 0 && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                background: 'rgba(52,211,153,0.15)',
                color: '#34d399',
              }}
            >
              {totalCount}
            </span>
          )}
        </div>
        <Link
          to="/developer-issues"
          style={{ fontSize: '0.75rem', color: 'var(--primary)' }}
        >
          All Issues
        </Link>
      </div>

      {totalCount === 0 ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <ClipboardCheck
            size={28}
            style={{ color: '#34d399', opacity: 0.5, marginBottom: '0.5rem' }}
          />
          <p
            style={{
              margin: 0,
              fontSize: '0.86rem',
              color: 'var(--text-muted)',
            }}
          >
            No issues are currently in testing, review, or reopened state.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {GROUPS.map((group) => {
            const items = grouped[group.key] ?? [];
            return (
              <div key={group.key}>
                {/* Group header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ color: group.color }}>{group.icon}</span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: group.color,
                    }}
                  >
                    {group.label}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '999px',
                      background: `${group.color}18`,
                      color: group.color,
                    }}
                  >
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p
                    style={{
                      margin: '0 0 0 1.5rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                    }}
                  >
                    {group.emptyMsg}
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                    }}
                  >
                    {items.slice(0, 8).map((issue) => {
                      const ageDays = Math.floor(
                        (Date.now() - new Date(issue.created_at).getTime()) /
                          (1000 * 60 * 60 * 24)
                      );
                      return (
                        <div
                          key={issue.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.65rem',
                            padding: '0.5rem 0.75rem',
                            background: 'var(--bg-surface-elevated)',
                            borderRadius: '7px',
                            border: '1px solid var(--border-subtle)',
                            borderLeft: `3px solid ${group.color}`,
                            flexWrap: 'wrap',
                          }}
                        >
                          {/* Left: key + title */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.55rem',
                              minWidth: 0,
                              flex: 1,
                            }}
                          >
                            <Link
                              to={`/issues/${issue.id}`}
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: 'var(--primary)',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {issue.issue_key}
                            </Link>
                            <span
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '280px',
                              }}
                              title={issue.title}
                            >
                              {issue.title}
                            </span>
                          </div>

                          {/* Right: badges + age + action */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              flexShrink: 0,
                              flexWrap: 'wrap',
                            }}
                          >
                            <SeverityBadge severity={issue.severity} />
                            <PriorityBadge priority={issue.priority} />
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {ageDays}d old
                            </span>
                            <Link
                              to={`/issues/${issue.id}`}
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.2rem 0.5rem',
                              }}
                              title="View issue details"
                            >
                              <ExternalLink size={11} />
                              <span>View</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                    {items.length > 8 && (
                      <Link
                        to="/developer-issues"
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--primary)',
                          padding: '0.25rem 0.75rem',
                          display: 'block',
                          textAlign: 'center',
                        }}
                      >
                        + {items.length - 8} more in {group.label}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
