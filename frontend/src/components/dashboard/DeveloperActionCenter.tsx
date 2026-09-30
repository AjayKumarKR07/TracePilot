/**
 * DeveloperActionCenter — Actionable items from the developer's assigned issues/sprints.
 *
 * Data sources (zero extra API calls — props from DeveloperDashboardPage):
 *   - assignedIssues: already loaded (assignee_id = current developer)
 *   - assignedSprints: already loaded (assigned_tester_id = current developer)
 *
 * Shows issues that genuinely need attention:
 *   - Urgent/High priority active issues
 *   - Reopened issues
 *   - Issues awaiting development
 *   - Issues in review/testing (validation work)
 *   - Sprints approaching their end date
 *
 * Actions: View Issue / Open Sprint only. No automatic mutations.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  ExternalLink,
  Layers,
  RotateCcw,
  Zap,
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Sprint } from '../../types/Sprint';
import { formatRelativeTime } from '../../utils/formatters';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActionCategory =
  | 'reopened'
  | 'urgent'
  | 'high'
  | 'awaiting_dev'
  | 'in_review'
  | 'sprint_ending';

interface ActionItem {
  id: string;
  category: ActionCategory;
  label: string;
  description: string;
  timestamp: string;
  issueId?: number;
  issueKey?: string;
  sprintId?: number;
  sprintName?: string;
  urgent: boolean;
}

const CATEGORY_META: Record<
  ActionCategory,
  { icon: React.ReactNode; color: string; bg: string }
> = {
  reopened: {
    icon: <RotateCcw size={14} />,
    color: '#f87171',
    bg: 'rgba(239,68,68,0.12)',
  },
  urgent: {
    icon: <AlertCircle size={14} />,
    color: '#f87171',
    bg: 'rgba(239,68,68,0.10)',
  },
  high: {
    icon: <AlertTriangle size={14} />,
    color: '#fb923c',
    bg: 'rgba(249,115,22,0.10)',
  },
  awaiting_dev: {
    icon: <Bug size={14} />,
    color: '#818cf8',
    bg: 'rgba(99,102,241,0.10)',
  },
  in_review: {
    icon: <Code2 size={14} />,
    color: '#34d399',
    bg: 'rgba(16,185,129,0.10)',
  },
  sprint_ending: {
    icon: <Clock size={14} />,
    color: '#fbbf24',
    bg: 'rgba(245,158,11,0.10)',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  assignedIssues: Issue[];
  assignedSprints: Sprint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const DeveloperActionCenter: React.FC<Props> = ({
  assignedIssues,
  assignedSprints,
}) => {
  const [expanded, setExpanded] = useState(true);

  const items = useMemo<ActionItem[]>(() => {
    const result: ActionItem[] = [];

    assignedIssues.forEach((issue) => {
      const active = !['RESOLVED', 'CLOSED'].includes(issue.status);
      if (!active) return;

      // Reopened
      if (issue.status === 'REOPENED') {
        result.push({
          id: `reopened-${issue.id}`,
          category: 'reopened',
          label: `${issue.issue_key} — Reopened`,
          description: issue.title,
          timestamp: issue.updated_at,
          issueId: issue.id,
          issueKey: issue.issue_key,
          urgent: true,
        });
        return;
      }

      // Urgent priority active issues
      if (issue.priority === 'URGENT') {
        result.push({
          id: `urgent-${issue.id}`,
          category: 'urgent',
          label: `${issue.issue_key} — URGENT Priority`,
          description: issue.title,
          timestamp: issue.updated_at,
          issueId: issue.id,
          issueKey: issue.issue_key,
          urgent: true,
        });
        return;
      }

      // High + CRITICAL/BLOCKER severity
      if (
        issue.priority === 'HIGH' &&
        (issue.severity === 'CRITICAL' || issue.severity === 'BLOCKER')
      ) {
        result.push({
          id: `high-${issue.id}`,
          category: 'high',
          label: `${issue.issue_key} — High Priority / ${issue.severity}`,
          description: issue.title,
          timestamp: issue.updated_at,
          issueId: issue.id,
          issueKey: issue.issue_key,
          urgent: false,
        });
        return;
      }

      // Awaiting development
      if (
        ['REPORTED', 'TRIAGED', 'ASSIGNED'].includes(issue.status)
      ) {
        result.push({
          id: `dev-${issue.id}`,
          category: 'awaiting_dev',
          label: `${issue.issue_key} — Awaiting Development`,
          description: issue.title,
          timestamp: issue.updated_at,
          issueId: issue.id,
          issueKey: issue.issue_key,
          urgent: false,
        });
        return;
      }

      // In review / testing
      if (issue.status === 'IN_REVIEW' || issue.status === 'IN_TESTING') {
        result.push({
          id: `review-${issue.id}`,
          category: 'in_review',
          label: `${issue.issue_key} — ${issue.status === 'IN_REVIEW' ? 'In Review' : 'In Testing'}`,
          description: issue.title,
          timestamp: issue.updated_at,
          issueId: issue.id,
          issueKey: issue.issue_key,
          urgent: false,
        });
      }
    });

    // Sprints ending within 3 days (active/in-progress)
    assignedSprints
      .filter((s) => s.status === 'IN_PROGRESS' || s.status === 'ACTIVE')
      .forEach((s) => {
        const daysLeft = daysUntil(s.end_date);
        if (daysLeft <= 3) {
          result.push({
            id: `sprint-${s.id}`,
            category: 'sprint_ending',
            label: `Sprint ending in ${daysLeft <= 0 ? 'OVERDUE' : `${daysLeft}d`}`,
            description: s.name,
            timestamp: s.end_date,
            sprintId: s.id,
            sprintName: s.name,
            urgent: daysLeft <= 1,
          });
        }
      });

    // Sort: urgent first, then by timestamp desc
    result.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return result;
  }, [assignedIssues, assignedSprints]);

  const urgentCount = items.filter((i) => i.urgent).length;

  return (
    <section
      className="card"
      style={{
        padding: '1.15rem 1.25rem',
        border:
          urgentCount > 0
            ? '1px solid rgba(239,68,68,0.3)'
            : '1px solid rgba(99,102,241,0.25)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: expanded ? '1rem' : 0,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded((p) => !p)}
        role="button"
        aria-expanded={expanded}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <Zap
            size={18}
            style={{ color: urgentCount > 0 ? '#f87171' : '#818cf8' }}
          />
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Developer Action Center
          </h2>
          {items.length > 0 && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                background:
                  urgentCount > 0
                    ? 'rgba(239,68,68,0.15)'
                    : 'rgba(99,102,241,0.15)',
                color: urgentCount > 0 ? '#f87171' : '#818cf8',
              }}
            >
              {items.length} item{items.length !== 1 ? 's' : ''}
              {urgentCount > 0 && ` · ${urgentCount} urgent`}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>

      {!expanded ? null : items.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <CheckCircle2
            size={28}
            style={{ color: '#34d399', opacity: 0.6, marginBottom: '0.4rem' }}
          />
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
            No immediate action needed. Your workload is under control.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {items.slice(0, 10).map((item) => {
            const meta = CATEGORY_META[item.category];
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.6rem 0.85rem',
                  background: meta.bg,
                  borderRadius: '7px',
                  border: `1px solid ${meta.color}22`,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span style={{ color: meta.color, flexShrink: 0 }}>
                    {meta.icon}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: meta.color,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '380px',
                      }}
                      title={item.description}
                    >
                      {item.description}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
                  >
                    {formatRelativeTime(item.timestamp)}
                  </span>

                  {item.issueId && (
                    <Link
                      to={`/issues/${item.issueId}`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.74rem', padding: '0.22rem 0.6rem' }}
                    >
                      <ExternalLink size={11} />
                      <span>View Issue</span>
                    </Link>
                  )}

                  {item.sprintId && (
                    <Link
                      to={`/developer-sprints?sprintId=${item.sprintId}`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.74rem', padding: '0.22rem 0.6rem' }}
                    >
                      <Layers size={11} />
                      <span>Open Sprint</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          {items.length > 10 && (
            <div
              style={{
                textAlign: 'center',
                padding: '0.5rem',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              + {items.length - 10} more items —{' '}
              <Link
                to="/developer-issues"
                style={{ color: 'var(--primary)', fontWeight: 600 }}
              >
                View all issues <ArrowRight size={11} style={{ display: 'inline' }} />
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
