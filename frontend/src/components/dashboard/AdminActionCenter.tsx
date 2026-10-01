/**
 * AdminActionCenter
 *
 * Surfaces real actionable items for the admin.
 * Props-driven - no extra API calls beyond what AdminDashboardPage already fetches.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  ExternalLink,
  RotateCcw,
  UserX,
  Zap,
} from 'lucide-react';
import type { Sprint } from '../../types/Sprint';
import { formatRelativeTime } from '../../utils/formatters';

type ActionCategory =
  | 'pending_approvals'
  | 'critical_issues'
  | 'reopened_issues'
  | 'sprint_ending'
  | 'unassigned_issues';

interface ActionItem {
  id: string;
  category: ActionCategory;
  label: string;
  description: string;
  count: number;
  timestamp?: string;
  href: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const CATEGORY_META: Record<ActionCategory, { icon: React.ReactNode; color: string; bg: string; badgeLabel: string; badgeColor: string }> = {
  pending_approvals: {
    icon: <ClipboardCheck size={16} />,
    color: '#818cf8',
    bg: 'rgba(99,102,241,0.10)',
    badgeLabel: 'ACTION NEEDED',
    badgeColor: '#6366f1',
  },
  critical_issues: {
    icon: <AlertTriangle size={16} />,
    color: '#f87171',
    bg: 'rgba(239,68,68,0.10)',
    badgeLabel: 'CRITICAL',
    badgeColor: '#ef4444',
  },
  reopened_issues: {
    icon: <RotateCcw size={16} />,
    color: '#fb923c',
    bg: 'rgba(249,115,22,0.10)',
    badgeLabel: 'REOPENED',
    badgeColor: '#f97316',
  },
  sprint_ending: {
    icon: <Clock size={16} />,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.10)',
    badgeLabel: 'AT RISK',
    badgeColor: '#d97706',
  },
  unassigned_issues: {
    icon: <UserX size={16} />,
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.10)',
    badgeLabel: 'NEEDS ATTENTION',
    badgeColor: '#64748b',
  },
};

interface AdminActionCenterProps {
  awaitingApproval: Sprint[];
  activeSprints: Sprint[];
  criticalCount: number;
  reopenedCount: number;
  unassignedCount: number;
}

export const AdminActionCenter: React.FC<AdminActionCenterProps> = ({
  awaitingApproval,
  activeSprints,
  criticalCount,
  reopenedCount,
  unassignedCount,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [visibleCount, setVisibleCount] = useState(6);

  const sprintsEndingSoon = useMemo(() => {
    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    return activeSprints.filter(
      (s) => s.end_date && new Date(s.end_date).getTime() - now <= threeDays
    );
  }, [activeSprints]);

  const actions: ActionItem[] = useMemo(() => {
    const items: ActionItem[] = [];

    if (awaitingApproval.length > 0) {
      items.push({
        id: 'pending_approvals',
        category: 'pending_approvals',
        label: 'Sprint Approvals Pending',
        description: `${awaitingApproval.length} sprint${awaitingApproval.length > 1 ? 's' : ''} submitted by developers are awaiting your review.`,
        count: awaitingApproval.length,
        timestamp: awaitingApproval[0]?.submitted_at ?? undefined,
        href: '/admin/sprint-approvals',
        priority: 'critical',
      });
    }

    if (criticalCount > 0) {
      items.push({
        id: 'critical_issues',
        category: 'critical_issues',
        label: 'Critical & Blocker Issues',
        description: `${criticalCount} critical or blocker severity issue${criticalCount > 1 ? 's' : ''} are currently open.`,
        count: criticalCount,
        href: '/issues?severity=CRITICAL',
        priority: 'critical',
      });
    }

    if (reopenedCount > 0) {
      items.push({
        id: 'reopened_issues',
        category: 'reopened_issues',
        label: 'Reopened Issues',
        description: `${reopenedCount} issue${reopenedCount > 1 ? 's' : ''} have been reopened and require investigation.`,
        count: reopenedCount,
        href: '/issues?status=REOPENED',
        priority: 'high',
      });
    }

    if (sprintsEndingSoon.length > 0) {
      items.push({
        id: 'sprint_ending',
        category: 'sprint_ending',
        label: 'Sprints Ending Soon',
        description: `${sprintsEndingSoon.length} active sprint${sprintsEndingSoon.length > 1 ? 's' : ''} will end within 3 days.`,
        count: sprintsEndingSoon.length,
        href: '/admin/sprints',
        priority: 'high',
      });
    }

    if (unassignedCount > 0) {
      items.push({
        id: 'unassigned_issues',
        category: 'unassigned_issues',
        label: 'Unassigned Backlog Issues',
        description: `${unassignedCount} backlog issue${unassignedCount > 1 ? 's' : ''} have no assignee. Schedule them into a sprint.`,
        count: unassignedCount,
        href: '/issues?backlog=true',
        priority: 'medium',
      });
    }

    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return items.sort((a, b) => order[a.priority] - order[b.priority]);
  }, [awaitingApproval, criticalCount, reopenedCount, sprintsEndingSoon, unassignedCount]);

  const totalActionItems = actions.reduce((sum, a) => sum + a.count, 0);
  const visible = actions.slice(0, visibleCount);

  return (
    <section className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
      <div
        className="card-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', padding: '1rem 1.25rem', borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(99,102,241,0.18)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={15} />
          </div>
          <div>
            <h2 className="card-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Admin Action Center
              {totalActionItems > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 800, borderRadius: '999px', padding: '0.1rem 0.45rem' }}>
                  {totalActionItems}
                </span>
              )}
            </h2>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Items requiring immediate attention</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {totalActionItems === 0 && (
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
              All Clear
            </span>
          )}
          {expanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {expanded && (
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          {actions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <CheckSquare size={36} style={{ color: '#10b981', opacity: 0.7 }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No action items right now</span>
              <span style={{ fontSize: '0.78rem' }}>All sprints reviewed, no critical issues open.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {visible.map((item) => {
                const meta = CATEGORY_META[item.category];
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.75rem 1rem', borderRadius: '10px', background: meta.bg, border: `1px solid ${meta.color}22` }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: `${meta.color}18`, border: `1px solid ${meta.color}30`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</span>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fff', background: meta.badgeColor, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{meta.badgeLabel}</span>
                      </div>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.description}</p>
                      {item.timestamp && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'block' }}>{formatRelativeTime(item.timestamp)}</span>
                      )}
                    </div>
                    <div style={{ minWidth: '36px', height: '36px', borderRadius: '8px', background: `${meta.color}20`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                      {item.count}
                    </div>
                    <Link to={item.href} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.38rem 0.75rem', borderRadius: '7px', background: `${meta.color}15`, border: `1px solid ${meta.color}30`, color: meta.color, fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                      <ExternalLink size={12} /> View
                    </Link>
                  </div>
                );
              })}
              {actions.length > 4 && (
                <button onClick={() => setVisibleCount((c) => (c >= actions.length ? 4 : actions.length))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', padding: '0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0 auto' }}>
                  {visibleCount >= actions.length ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Show {actions.length - visibleCount} more</>}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default AdminActionCenter;
