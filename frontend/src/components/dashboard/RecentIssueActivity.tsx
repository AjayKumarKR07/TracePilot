/**
 * RecentIssueActivity — Tabbed Comments / Attachments panel.
 *
 * Data loading strategy:
 * - Loads lazily on first tab open (performance optimization)
 * - Fetches comments/attachments for each of the user's issues in batches
 * - RBAC: GET /issues/{id}/comments and GET /issues/{id}/attachments both
 *   enforce issue-level access control in the backend service layer.
 *   Users can only access their own reported issues (already filtered by
 *   DashboardPage which only loads reporter_id = current_user).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Eye,
  MessageSquare,
  Paperclip,
} from 'lucide-react';
import { commentsApi } from '../../api/comments';
import { attachmentsApi } from '../../api/attachments';
import { getApiErrorMessage } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { Comment } from '../../types/comment';
import type { Attachment } from '../../types/attachment';
import type { Issue } from '../../types/issue';
import { formatRelativeTime } from '../../utils/formatters';

type Tab = 'comments' | 'attachments';

interface CommentWithKey extends Comment {
  issue_key: string;
  issue_id_val: number;
}

interface AttachmentWithKey extends Attachment {
  issue_key: string;
}

interface Props {
  userIssues: Issue[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const RecentIssueActivity: React.FC<Props> = ({ userIssues }) => {
  const [tab, setTab] = useState<Tab>('comments');
  const [comments, setComments] = useState<CommentWithKey[]>([]);
  const [attachments, setAttachments] = useState<AttachmentWithKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef<Set<Tab>>(new Set());

  const loadTab = useCallback(
    async (t: Tab) => {
      if (loadedRef.current.has(t)) return;
      if (userIssues.length === 0) return;
      setLoading(true);
      setError(null);

      // Fetch from at most 10 most recent issues to avoid too many requests
      const recentIssues = [...userIssues]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      try {
        if (t === 'comments') {
          const results = await Promise.allSettled(
            recentIssues.map((iss) =>
              commentsApi
                .listByIssue(iss.id, 1, 5)
                .then((res) =>
                  res.items.map((c) => ({
                    ...c,
                    issue_key: iss.issue_key,
                    issue_id_val: iss.id,
                  }))
                )
            )
          );
          const all: CommentWithKey[] = results
            .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 15);
          setComments(all);
        } else {
          const results = await Promise.allSettled(
            recentIssues.map((iss) =>
              attachmentsApi
                .listByIssue(iss.id, 1, 5)
                .then((res) =>
                  res.items.map((a) => ({
                    ...a,
                    issue_key: iss.issue_key,
                  }))
                )
            )
          );
          const all: AttachmentWithKey[] = results
            .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 15);
          setAttachments(all);
        }
        loadedRef.current.add(t);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [userIssues]
  );

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  const tabBtn = (t: Tab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.35rem 0.85rem',
        borderRadius: 'var(--radius-sm)',
        border: tab === t ? '1px solid rgba(129,140,248,0.5)' : '1px solid transparent',
        backgroundColor: tab === t ? 'rgba(129,140,248,0.12)' : 'transparent',
        color: tab === t ? '#818cf8' : 'var(--text-secondary)',
        fontSize: '0.82rem',
        fontWeight: tab === t ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <section className="card" style={{ padding: '1.25rem' }}>
      {/* Header + Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          Recent Issue Activity
        </span>
        <div style={{ display: 'flex', gap: '0.3rem', backgroundColor: 'var(--bg-surface-elevated)', padding: '0.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          {tabBtn('comments', <MessageSquare size={13} />, 'Comments')}
          {tabBtn('attachments', <Paperclip size={13} />, 'Attachments')}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}>
          <LoadingSpinner message={`Loading ${tab}…`} />
        </div>
      ) : error ? (
        <p style={{ fontSize: '0.82rem', color: '#f87171', textAlign: 'center' }}>{error}</p>
      ) : tab === 'comments' ? (
        <CommentsList comments={comments} issueMap={Object.fromEntries(userIssues.map((i) => [i.id, i]))} />
      ) : (
        <AttachmentsList attachments={attachments} />
      )}
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Comments List
// ─────────────────────────────────────────────────────────────────────────────
interface CommentsListProps {
  comments: CommentWithKey[];
  issueMap: Record<number, Issue>;
}

const CommentsList: React.FC<CommentsListProps> = ({ comments }) => {
  if (comments.length === 0) {
    return (
      <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <MessageSquare size={28} style={{ opacity: 0.25, display: 'block', margin: '0 auto 0.5rem' }} />
        No recent comments on your issues.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {comments.map((comment, idx) => (
        <div
          key={comment.id}
          style={{
            padding: '0.75rem 0',
            borderBottom: idx < comments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            display: 'flex',
            gap: '0.65rem',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: 'rgba(56,189,248,0.15)',
              border: '1px solid rgba(56,189,248,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#38bdf8',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {comment.author.full_name.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
              <Link
                to={`/issues/${comment.issue_id_val}`}
                style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}
              >
                {comment.issue_key}
              </Link>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {comment.author.full_name}
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '0.05rem 0.35rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(129,140,248,0.12)',
                  color: '#818cf8',
                }}
              >
                {comment.author.role}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              "{comment.body}"
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{formatRelativeTime(comment.created_at)}</span>
              <Link to={`/issues/${comment.issue_id_val}`} style={{ color: 'var(--text-muted)' }}>
                <Eye size={12} />
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Attachments List
// ─────────────────────────────────────────────────────────────────────────────
interface AttachmentsListProps {
  attachments: AttachmentWithKey[];
}

const AttachmentsList: React.FC<AttachmentsListProps> = ({ attachments }) => {
  const [downloading, setDownloading] = useState<number | null>(null);

  const handleDownload = async (att: AttachmentWithKey) => {
    setDownloading(att.id);
    try {
      await attachmentsApi.download(att.id, att.original_filename);
    } catch {
      // error swallowed — file download
    } finally {
      setDownloading(null);
    }
  };

  if (attachments.length === 0) {
    return (
      <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <Paperclip size={28} style={{ opacity: 0.25, display: 'block', margin: '0 auto 0.5rem' }} />
        No recent attachments on your issues.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {attachments.map((att, idx) => (
        <div
          key={att.id}
          style={{
            padding: '0.65rem 0',
            borderBottom: idx < attachments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(167,139,250,0.12)',
              border: '1px solid rgba(167,139,250,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Paperclip size={14} color="#a78bfa" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.1rem' }}>
              <Link
                to={`/issues/${att.issue_id}`}
                style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}
              >
                {att.issue_key}
              </Link>
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {att.original_filename}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
              {formatBytes(att.file_size)} · {formatRelativeTime(att.created_at)}
            </div>
          </div>
          <button
            onClick={() => handleDownload(att)}
            disabled={downloading === att.id}
            className="btn btn-secondary btn-sm"
            style={{ flexShrink: 0, padding: '0.25rem 0.5rem' }}
            title="Download"
          >
            <Download size={13} />
          </button>
        </div>
      ))}
    </div>
  );
};
