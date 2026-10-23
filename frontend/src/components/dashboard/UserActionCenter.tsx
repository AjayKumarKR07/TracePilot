/**
 * UserActionCenter — High-visibility Action Center for the TracePilot User Dashboard.
 *
 * Prominently presents defects awaiting verification from the logged-in user,
 * displays developer resolution notes, and provides instantaneous Confirm / Reopen actions.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  ListChecks,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { NotificationItem } from '../../types/notification';
import type { Project } from '../../types/project';
import { PriorityBadge } from '../common/PriorityBadge';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { formatDate, formatRelativeTime } from '../../utils/formatters';

export interface ActionCenterItem {
  id: string;
  type: 'confirm_resolution' | 'reopened' | 'notification';
  issue?: Issue;
  notification?: NotificationItem;
  title: string;
  description: string;
  resolutionDetails?: string | null;
  timestamp: string;
  urgent: boolean;
}

interface Props {
  userIssues: Issue[];
  notifications: NotificationItem[];
  isActionSubmitting: boolean;
  activeActionIssueId?: number | null;
  projectMap?: Map<number, Project>;
  onConfirmClose: (issueId: number) => void;
  onReopenIssue: (issue: Issue) => void;
}

function notifIcon(type: string) {
  if (type === 'ISSUE_COMMENTED') return <MessageSquare size={14} />;
  if (type === 'ISSUE_RESOLVED') return <CheckCircle2 size={14} />;
  if (type === 'ISSUE_REOPENED') return <RotateCcw size={14} />;
  if (type === 'ISSUE_STATUS_CHANGED') return <Zap size={14} />;
  return <BellRing size={14} />;
}

function notifColor(type: string): string {
  if (type === 'ISSUE_RESOLVED') return '#34d399';
  if (type === 'ISSUE_REOPENED') return '#f87171';
  if (type === 'ISSUE_COMMENTED') return '#38bdf8';
  if (type === 'ISSUE_STATUS_CHANGED') return '#fbbf24';
  return '#818cf8';
}

export const UserActionCenter: React.FC<Props> = ({
  userIssues,
  notifications,
  isActionSubmitting,
  activeActionIssueId,
  projectMap,
  onConfirmClose,
  onReopenIssue,
}) => {
  const { verificationItems, otherActionItems } = useMemo(() => {
    const verification: ActionCenterItem[] = [];
    const others: ActionCenterItem[] = [];

    // 1. Issues awaiting resolution verification (Highest Priority)
    userIssues
      .filter((i) => i.status === 'RESOLVED')
      .forEach((issue) => {
        verification.push({
          id: `resolved-${issue.id}`,
          type: 'confirm_resolution',
          issue,
          title: issue.title,
          description:
            'Engineering has resolved this defect. Please verify the fix in your environment and either confirm resolution or reopen.',
          resolutionDetails: issue.resolution_summary || null,
          timestamp: issue.resolved_at || issue.updated_at,
          urgent: issue.severity === 'CRITICAL' || issue.severity === 'BLOCKER' || issue.priority === 'URGENT',
        });
      });

    // 2. Reopened issues currently under investigation
    userIssues
      .filter((i) => i.status === 'REOPENED')
      .forEach((issue) => {
        others.push({
          id: `reopened-${issue.id}`,
          type: 'reopened',
          issue,
          title: issue.title,
          description: 'This issue was reopened and is actively under renewed engineering investigation.',
          timestamp: issue.updated_at,
          urgent: true,
        });
      });

    // 3. Unread issue-related notifications
    const coveredIssueIds = new Set([
      ...verification.map((a) => a.issue?.id).filter(Boolean),
      ...others.map((a) => a.issue?.id).filter(Boolean),
    ]);

    notifications
      .filter((n) => !n.is_read && n.entity_type === 'ISSUE')
      .filter((n) => !coveredIssueIds.has(n.entity_id ?? -1))
      .slice(0, 4)
      .forEach((notif) => {
        others.push({
          id: `notif-${notif.id}`,
          type: 'notification',
          notification: notif,
          title: notif.title,
          description: notif.message,
          timestamp: notif.created_at,
          urgent: notif.notification_type === 'ISSUE_REOPENED',
        });
      });

    const sortFn = (a: ActionCenterItem, b: ActionCenterItem) => {
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    };

    return {
      verificationItems: verification.sort(sortFn),
      otherActionItems: others.sort(sortFn),
    };
  }, [userIssues, notifications]);

  const totalCount = verificationItems.length + otherActionItems.length;
  const urgentCount = [...verificationItems, ...otherActionItems].filter((i) => i.urgent).length;

  // Empty State
  if (totalCount === 0) {
    return (
      <section
        className="card"
        style={{
          border: '1px solid rgba(16, 185, 129, 0.28)',
          backgroundColor: 'rgba(16, 185, 129, 0.04)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
              Action Center: You&apos;re All Caught Up!
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              No defects currently require your verification or immediate review.
            </div>
          </div>
        </div>
        <Link
          to="/create-issue"
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <span>Report New Defect</span>
        </Link>
      </section>
    );
  }

  return (
    <section
      className="card"
      style={{
        border:
          verificationItems.length > 0
            ? '1px solid rgba(16, 185, 129, 0.35)'
            : urgentCount > 0
            ? '1px solid rgba(245, 158, 11, 0.4)'
            : '1px solid rgba(99, 102, 241, 0.3)',
        backgroundColor:
          verificationItems.length > 0
            ? 'rgba(16, 185, 129, 0.02)'
            : urgentCount > 0
            ? 'rgba(245, 158, 11, 0.02)'
            : 'rgba(99, 102, 241, 0.02)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '1.25rem 1.5rem',
      }}
    >
      {/* Action Center Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
          paddingBottom: '0.85rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: verificationItems.length > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: verificationItems.length > 0 ? '#34d399' : '#818cf8',
            }}
          >
            <ListChecks size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Action Center
              </h2>
              {verificationItems.length > 0 && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.6rem',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(16, 185, 129, 0.18)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Sparkles size={11} /> {verificationItems.length} Awaiting Verification
                </span>
              )}
              {urgentCount > 0 && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(245, 158, 11, 0.18)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  {urgentCount} High Priority
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
              Items requiring your verification, feedback, or immediate awareness.
            </p>
          </div>
        </div>

        {/* Action Next-Steps Guidance Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.74rem',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '999px',
            padding: '0.3rem 0.75rem',
          }}
        >
          <Info size={13} color="#818cf8" />
          <span>
            Verify fixed issues in your environment, then <strong>Confirm</strong> or <strong>Reopen</strong>.
          </span>
        </div>
      </div>

      {/* Grid of Action Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
        }}
      >
        {verificationItems.map((item) => (
          <ActionCard
            key={item.id}
            item={item}
            isActionSubmitting={isActionSubmitting}
            activeActionIssueId={activeActionIssueId}
            projectMap={projectMap}
            onConfirmClose={onConfirmClose}
            onReopenIssue={onReopenIssue}
          />
        ))}

        {otherActionItems.map((item) => (
          <ActionCard
            key={item.id}
            item={item}
            isActionSubmitting={isActionSubmitting}
            activeActionIssueId={activeActionIssueId}
            projectMap={projectMap}
            onConfirmClose={onConfirmClose}
            onReopenIssue={onReopenIssue}
          />
        ))}
      </div>
    </section>
  );
};

interface ActionCardProps {
  item: ActionCenterItem;
  isActionSubmitting: boolean;
  activeActionIssueId?: number | null;
  projectMap?: Map<number, Project>;
  onConfirmClose: (issueId: number) => void;
  onReopenIssue: (issue: Issue) => void;
}

const ActionCard: React.FC<ActionCardProps> = ({
  item,
  isActionSubmitting,
  activeActionIssueId,
  projectMap,
  onConfirmClose,
  onReopenIssue,
}) => {
  const isResolvingThis = isActionSubmitting && activeActionIssueId === item.issue?.id;
  const project = item.issue ? projectMap?.get(item.issue.project_id) : undefined;

  const isVerification = item.type === 'confirm_resolution';
  const isReopened = item.type === 'reopened';

  const cardBorder = isVerification
    ? '1px solid rgba(16, 185, 129, 0.35)'
    : item.urgent
    ? '1px solid rgba(245, 158, 11, 0.35)'
    : '1px solid var(--border-subtle)';

  const cardGlow = isVerification
    ? '0 0 15px rgba(16, 185, 129, 0.05)'
    : 'none';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface-elevated)',
        border: cardBorder,
        boxShadow: cardGlow,
        borderRadius: 'var(--radius-md, 8px)',
        padding: '1.1rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '0.75rem',
        position: 'relative',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Card Header Tag Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {isVerification && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(16, 185, 129, 0.16)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <CheckCircle2 size={11} /> Verification Required
            </span>
          )}
          {isReopened && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(239, 68, 68, 0.14)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <AlertCircle size={11} /> Reopened
            </span>
          )}
          {item.type === 'notification' && item.notification && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(99, 102, 241, 0.14)',
                color: notifColor(item.notification.notification_type),
              }}
            >
              {notifIcon(item.notification.notification_type)}
              <span>{item.notification.notification_type.replace('ISSUE_', '')}</span>
            </span>
          )}

          {/* Issue Key */}
          <Link
            to={item.issue ? `/issues/${item.issue.id}` : '#'}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              fontWeight: 800,
              color: 'var(--primary)',
              textDecoration: 'none',
            }}
          >
            {item.issue?.issue_key || item.notification?.entity_key}
          </Link>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {item.issue && <StatusBadge status={item.issue.status} />}
          {item.issue && <SeverityBadge severity={item.issue.severity} />}
        </div>
      </div>

      {/* Title & Project */}
      <div>
        {project && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
            {project.name}
          </div>
        )}
        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: '0.35rem' }}>
          {item.title}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
          {item.description}
        </p>
      </div>

      {/* Resolution Details Box (For Verification Items) */}
      {isVerification && (
        <div
          style={{
            padding: '0.65rem 0.8rem',
            backgroundColor: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '6px',
            fontSize: '0.78rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: '#34d399',
              fontWeight: 700,
              fontSize: '0.72rem',
              marginBottom: '0.2rem',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            <Sparkles size={12} />
            <span>Developer Resolution Notes</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {item.resolutionDetails ? (
              item.resolutionDetails
            ) : (
              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                Developer marked this issue as resolved. Ready for acceptance testing.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timestamp & Meta Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          paddingTop: '0.35rem',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} title={formatDate(item.timestamp)}>
          <Clock size={12} />
          <span>Updated {formatRelativeTime(item.timestamp)}</span>
        </span>
        {item.issue && <PriorityBadge priority={item.issue.priority} />}
      </div>

      {/* Action Buttons Row */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          paddingTop: '0.65rem',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {isVerification && item.issue && (
          <>
            <button
              onClick={() => onConfirmClose(item.issue!.id)}
              disabled={isActionSubmitting}
              className="btn btn-primary btn-sm"
              style={{
                backgroundColor: '#10b981',
                borderColor: '#10b981',
                flex: '1 1 120px',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
              title="Confirm that the fix works and close this defect"
            >
              <CheckCircle2 size={13} className={isResolvingThis ? 'animate-spin' : ''} />
              <span>{isResolvingThis ? 'Confirming…' : 'Confirm Resolution'}</span>
            </button>

            <button
              onClick={() => onReopenIssue(item.issue!)}
              disabled={isActionSubmitting}
              className="btn btn-outline-danger btn-sm"
              style={{
                flex: '1 1 100px',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
              title="Reopen this defect if the issue still persists"
            >
              <RotateCcw size={13} />
              <span>Reopen Issue</span>
            </button>

            <Link
              to={`/issues/${item.issue.id}`}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'center', fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
              title="View full defect details"
            >
              <Eye size={13} />
            </Link>
          </>
        )}

        {(!isVerification) && (
          <Link
            to={
              item.issue
                ? `/issues/${item.issue.id}`
                : item.notification?.entity_id
                ? `/issues/${item.notification.entity_id}`
                : '/issues'
            }
            className="btn btn-secondary btn-sm"
            style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem' }}
          >
            <Eye size={13} />
            <span>View Issue Details</span>
          </Link>
        )}
      </div>
    </div>
  );
};
