import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { auditApi } from '../../api/audit';
import { getApiErrorMessage } from '../../api/client';
import type { AuditLogItem } from '../../types/audit';
import { formatDate, formatRelativeTime } from '../../utils/formatters';

interface AdminAuditActivityProps {
  refreshTrigger?: number;
}

export const AdminAuditActivity: React.FC<AdminAuditActivityProps> = ({ refreshTrigger }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await auditApi.list({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        action: actionFilter || undefined,
      });
      setLogs(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshTrigger]);

  const getActionBadge = (action: string) => {
    if (action.includes('AUTH_LOGIN')) {
      return { label: 'Login', bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399', icon: <CheckCircle2 size={12} /> };
    }
    if (action.includes('AUTH_LOGOUT')) {
      return { label: 'Logout', bg: 'rgba(100, 116, 139, 0.12)', color: '#94a3b8', icon: <Clock size={12} /> };
    }
    if (action.includes('USER_ROLE')) {
      return { label: 'Role Changed', bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', icon: <ShieldCheck size={12} /> };
    }
    if (action.includes('DEACTIVATE')) {
      return { label: 'User Deactivated', bg: 'rgba(239, 68, 68, 0.12)', color: '#f87171', icon: <AlertCircle size={12} /> };
    }
    if (action.includes('ACTIVATE')) {
      return { label: 'User Activated', bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399', icon: <CheckCircle2 size={12} /> };
    }
    if (action.includes('ASSIGN')) {
      return { label: 'Issue Assigned', bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', icon: <UserCheck size={12} /> };
    }
    if (action.includes('RESOLVED')) {
      return { label: 'Issue Resolved', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', icon: <CheckCircle2 size={12} /> };
    }
    if (action.includes('REOPENED')) {
      return { label: 'Issue Reopened', bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', icon: <RotateCcw size={12} /> };
    }
    if (action.includes('STATUS')) {
      return { label: 'Status Changed', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', icon: <Wrench size={12} /> };
    }
    if (action.includes('SPRINT_APPROV')) {
      return { label: 'Sprint Approved', bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', icon: <CheckCircle2 size={12} /> };
    }
    if (action.includes('SPRINT')) {
      return { label: 'Sprint Update', bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', icon: <Layers size={12} /> };
    }
    return {
      label: action.replace(/_/g, ' '),
      bg: 'rgba(100, 116, 139, 0.12)',
      color: 'var(--text-secondary)',
      icon: <Activity size={12} />,
    };
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.25rem 1.5rem',
        borderRadius: 'var(--radius-lg, 12px)',
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.12)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Audit Log &amp; Activity Trail
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Immutable real-time audit entries recorded by TracePilot security governance
            </span>
          </div>
        </div>

        <button
          onClick={() => fetchLogs()}
          disabled={isLoading}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Audit Logs</span>
        </button>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '200px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.7rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search audit trail by actor, entity key, details…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2.1rem',
              fontSize: '0.82rem',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          style={{
            padding: '0.45rem 0.75rem',
            fontSize: '0.8rem',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-input, #0f172a)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Audit Actions</option>
          <option value="AUTH_LOGIN">User Logins (AUTH_LOGIN)</option>
          <option value="AUTH_LOGOUT">User Logouts (AUTH_LOGOUT)</option>
          <option value="USER_ROLE_CHANGED">Role Changes (USER_ROLE_CHANGED)</option>
          <option value="USER_ACTIVATED">User Activations (USER_ACTIVATED)</option>
          <option value="USER_DEACTIVATED">User Deactivations (USER_DEACTIVATED)</option>
          <option value="ISSUE_ASSIGNED">Issue Assignments (ISSUE_ASSIGNED)</option>
          <option value="ISSUE_STATUS_CHANGED">Status Transitions (ISSUE_STATUS_CHANGED)</option>
          <option value="ISSUE_RESOLVED">Issue Resolutions (ISSUE_RESOLVED)</option>
          <option value="ISSUE_REOPENED">Issue Reopenings (ISSUE_REOPENED)</option>
          <option value="SPRINT_APPROVED">Sprint Approvals (SPRINT_APPROVED)</option>
          <option value="ADMIN_SWITCH_ROLE">Admin Role Switches (ADMIN_SWITCH_ROLE)</option>
        </select>
      </div>

      {error && <div style={{ color: '#f87171', fontSize: '0.84rem' }}>{error}</div>}

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr
              style={{
                background: 'var(--bg-surface-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
              }}
            >
              <th style={{ padding: '0.75rem 1rem' }}>Action</th>
              <th style={{ padding: '0.75rem 1rem' }}>Actor</th>
              <th style={{ padding: '0.75rem 1rem' }}>Entity</th>
              <th style={{ padding: '0.75rem 1rem' }}>Details / Changes</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                  <p style={{ margin: 0, fontSize: '0.84rem' }}>Loading audit logs…</p>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <ShieldCheck size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>No audit logs found</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const badge = getActionBadge(log.action);
                return (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* Action Badge */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                    </td>

                    {/* Actor */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {log.actor ? (
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {log.actor.full_name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {log.actor.email}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>System Service</span>
                      )}
                    </td>

                    {/* Entity */}
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem' }}>
                      {log.entity_type && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.4rem',
                            borderRadius: '4px',
                            background: 'var(--bg-surface-elevated)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                            marginRight: '0.35rem',
                          }}
                        >
                          {log.entity_type}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, color: '#818cf8' }}>
                        {log.entity_key || (log.entity_id ? `#${log.entity_id}` : '—')}
                      </span>
                    </td>

                    {/* Change Details */}
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <div>{log.description}</div>
                      {log.old_values && log.new_values && (
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            marginTop: '0.2rem',
                            fontFamily: 'monospace',
                          }}
                        >
                          {JSON.stringify(log.old_values)} &rarr; {JSON.stringify(log.new_values)}
                        </div>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      <div title={formatDate(log.created_at)}>{formatRelativeTime(log.created_at)}</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} events
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.76rem', padding: '0.25rem 0.6rem' }}
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.4rem', fontWeight: 600 }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.76rem', padding: '0.25rem 0.6rem' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
