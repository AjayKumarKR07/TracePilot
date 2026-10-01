/**
 * AdminRecentActivity
 * Shows recent audit log items from /activity endpoint.
 * Props-driven from AdminDashboardPage auditLogs state.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import type { AuditLogItem } from '../../types/audit';
import { formatRelativeTime } from '../../utils/formatters';

interface Props { auditLogs: AuditLogItem[]; }

const ACTION_COLORS: Record<string, string> = {
  ISSUE_CREATED: '#60a5fa',
  ISSUE_UPDATED: '#a78bfa',
  ISSUE_ASSIGNED: '#34d399',
  ISSUE_STATUS_CHANGED: '#f59e0b',
  ISSUE_RESOLVED: '#10b981',
  ISSUE_REOPENED: '#f87171',
  PROJECT_CREATED: '#38bdf8',
  PROJECT_UPDATED: '#818cf8',
  COMMENT_CREATED: '#94a3b8',
  ATTACHMENT_UPLOADED: '#6ee7b7',
  AUTH_LOGIN: '#64748b',
  AUTH_LOGOUT: '#475569',
  USER_UPDATED: '#a78bfa',
  USER_ROLE_CHANGED: '#fb923c',
};

function actionColor(action: string): string {
  return ACTION_COLORS[action] || '#6366f1';
}

function actionLabel(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function entityLink(log: AuditLogItem): string | null {
  if (log.entity_type === 'Issue' && log.entity_id) return `/issues/${log.entity_id}`;
  if (log.entity_type === 'Project' && log.entity_id) return `/projects`;
  return null;
}

export const AdminRecentActivity: React.FC<Props> = ({ auditLogs }) => {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? auditLogs : auditLogs.slice(0, 8);

  return (
    <section className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
      <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={14} />
          </div>
          <h2 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Recent System Activity</h2>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{auditLogs.length} recent events</span>
      </div>
      <div className="card-body" style={{ padding: '0.85rem 1.25rem' }}>
        {auditLogs.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No recent activity</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {visible.map((log) => {
              const color = actionColor(log.action);
              const link = entityLink(log);
              return (
                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0, marginTop: '0.4rem' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color, background: `${color}15`, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        {actionLabel(log.action)}
                      </span>
                      {log.entity_key && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{log.entity_key}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.description}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {log.actor && <span>{log.actor.full_name}</span>}
                      <span>&bull;</span>
                      <span>{formatRelativeTime(log.created_at)}</span>
                    </div>
                  </div>
                  {link && (
                    <Link to={link} style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                      <ExternalLink size={12} />
                    </Link>
                  )}
                </div>
              );
            })}
            {auditLogs.length > 8 && (
              <button onClick={() => setShowAll((v) => !v)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '0.3rem auto 0', padding: '0.3rem 0' }}>
                {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show {auditLogs.length - 8} more</>}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminRecentActivity;
