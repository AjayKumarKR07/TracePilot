/**
 * UserActionCenter — Shows issues that genuinely need the user's attention.
 *
 * Data sources (all user-scoped, no extra API calls):
 *   - userIssues: already loaded in DashboardPage (reporter_id = current_user)
 *   - notifications: already loaded (private to owner)
 *
 * Action categories:
 *   - RESOLVED issues → "Verify the fix"
 *   - REOPENED issues → "Under re-investigation"
 *   - Unread issue-related notifications
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Eye,
  ListChecks,
  MessageSquare,
  RotateCcw,
  Zap,
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { NotificationItem } from '../../types/notification';
import { StatusBadge } from '../common/StatusBadge';
import { formatRelativeTime } from '../../utils/formatters';

interface ActionItem {
  id: string;
  type: 'confirm_resolution' | 'reopened' | 'notification';
  issue?: Issue;
  notification?: NotificationItem;
  title: string;
  description: string;
  timestamp: string;
  urgent: boolean;
}

interface Props {
  userIssues: Issue[];
  notifications: NotificationItem[];
  isActionSubmitting: boolean;
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
  onConfirmClose,
  onReopenIssue,
}) => {
  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    userIssues
      .filter((i) => i.status === 'RESOLVED')
      .forEach((issue) => {
        items.push({
          id: `resolved-${issue.id}`,
          type: 'confirm_resolution',
          issue,
          title: `${issue.issue_key} — Verify the Fix`,
          description: 'The developer marked this resolved. Please verify in your environment and confirm or reopen.',
          timestamp: issue.updated_at,
          urgent: issue.severity === 'CRITICAL' || issue.severity === 'BLOCKER',
        });
      });

    userIssues
      .filter((i) => i.status === 'REOPENED')
      .forEach((issue) => {
        items.push({
          id: `reopened-${issue.id}`,
          type: 'reopened',
          issue,
          title: `${issue.issue_key} — Reopened`,
          description: 'This issue was reopened and is under renewed investigation.',
          timestamp: issue.updated_at,
          urgent: true,
        });
      });

    const coveredIssueIds = new Set(
      items.map((a) => a.issue?.id).filter(Boolean)
    );
    notifications
      .filter((n) => !n.is_read && n.entity_type === 'ISSUE')
      .filter((n) => !coveredIssueIds.has(n.entity_id ?? -1))
      .slice(0, 5)
      .forEach((notif) => {
        items.push({
          id: `notif-${notif.id}`,
          type: 'notification',
          notification: notif,
          title: notif.title,
          description: notif.message,
          timestamp: notif.created_at,
          urgent: notif.notification_type === 'ISSUE_REOPENED',
        });
      });

    return items.sort((a, b) => {
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [userIssues, notifications]);

  const urgentCount = actionItems.filter((a) => a.urgent).length;
  const totalCount = actionItems.length;

  if (totalCount === 0) {
    return (
      <section
        className="card"
        style={{
          border: '1px solid rgba(16,185,129,0.25)',
          backgroundColor: 'rgba(16,185,129,0.04)',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <CheckCircle2 size={20} color="#34d399" style={{ flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#34d399', display: 'block' }}>
            You're all caught up!
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            No issues currently require your attention.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      className="card"
      style={{
        border: urgentCount > 0 ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(99,102,241,0.25)',
        backgroundColor: urgentCount > 0 ? 'rgba(245,158,11,0.04)' : 'rgba(99,102,241,0.04)',
        padding: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <ListChecks size={18} color={urgentCount > 0 ? '#f59e0b' : '#818cf8'} />
        <h2 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          Action Center
        </h2>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '0.15rem 0.6rem',
            borderRadius: '999px',
            backgroundColor: urgentCount > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(99,102,241,0.18)',
            color: urgentCount > 0 ? '#f59e0b' : '#818cf8',
          }}
        >
          {totalCount} item{totalCount !== 1 ? 's' : ''} need{totalCount === 1 ? 's' : ''} attention
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {actionItems.map((item) => (
          <ActionCard
            key={item.id}
            item={item}
            isActionSubmitting={isActionSubmitting}
            onConfirmClose={onConfirmClose}
            onReopenIssue={onReopenIssue}
          />
        ))}
      </div>
    </section>
  );
};

interface ActionCardProps {
  item: ActionItem;
  isActionSubmitting: boolean;
  onConfirmClose: (issueId: number) => void;
  onReopenIssue: (issue: Issue) => void;
}

const ActionCard: React.FC<ActionCardProps> = ({ item, isActionSubmitting, onConfirmClose, onReopenIssue }) => {
  const borderColor =
    item.urgent
      ? 'rgba(245,158,11,0.35)'
      : item.type === 'confirm_resolution'
      ? 'rgba(16,185,129,0.28)'
      : 'var(--border-subtle)';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface-elevated)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {item.type === 'confirm_resolution' && <CheckCircle2 size={14} color="#34d399" />}
          {item.type === 'reopened' && <AlertCircle size={14} color="#f87171" />}
          {item.type === 'notification' && item.notification && (
            <span style={{ color: notifColor(item.notification.notification_type) }}>
              {notifIcon(item.notification.notification_type)}
            </span>
          )}
          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
            {item.issue?.issue_key || item.notification?.entity_key || '—'}
          </span>
        </div>
        {item.issue && <StatusBadge status={item.issue.status} />}
        {item.urgent && item.type === 'notification' && (
          <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
            Unread
          </span>
        )}
      </div>

      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
          {item.title}
        </div>
        <p style={{ fontSize: '0.77rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
          {item.description}
        </p>
      </div>

      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
        {formatRelativeTime(item.timestamp)}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
        {item.type === 'confirm_resolution' && item.issue && (
          <>
            <button
              onClick={() => onConfirmClose(item.issue!.id)}
              disabled={isActionSubmitting}
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: '#10b981', borderColor: '#10b981', flex: 1, justifyContent: 'center', fontSize: '0.75rem' }}
            >
              <CheckCircle2 size={12} />
              <span>Confirm</span>
            </button>
            <button
              onClick={() => onReopenIssue(item.issue!)}
              disabled={isActionSubmitting}
              className="btn btn-outline-danger btn-sm"
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem' }}
            >
              <RotateCcw size={12} />
              <span>Reopen</span>
            </button>
            <Link
              to={`/issues/${item.issue!.id}`}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'center', fontSize: '0.75rem' }}
            >
              <Eye size={12} />
            </Link>
          </>
        )}
        {(item.type === 'reopened' || item.type === 'notification') && (
          <Link
            to={
              item.issue
                ? `/issues/${item.issue.id}`
                : item.notification?.entity_id
                ? `/issues/${item.notification.entity_id}`
                : '/issues'
            }
            className="btn btn-secondary btn-sm"
            style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem' }}
          >
            <Eye size={12} />
            <span>View Issue</span>
          </Link>
        )}
      </div>
    </div>
  );
};
