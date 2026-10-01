/**
 * AdminApprovalCenter
 * Compact approval widget showing pending/recent sprint approvals.
 * Uses awaitingApproval and activeSprints props already loaded by AdminDashboardPage.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Clock, ExternalLink } from 'lucide-react';
import type { Sprint } from '../../types/Sprint';
import { formatRelativeTime } from '../../utils/formatters';

interface Props {
  awaitingApproval: Sprint[];
  recentlyCompleted: Sprint[];
}

export const AdminApprovalCenter: React.FC<Props> = ({ awaitingApproval, recentlyCompleted }) => {
  return (
    <section className="card" style={{ border: '1px solid var(--border-subtle)' }}>
      <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardCheck size={14} />
          </div>
          <div>
            <h2 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
              Approval Center
              {awaitingApproval.length > 0 && (
                <span style={{ marginLeft: '0.5rem', background: '#6366f1', color: '#fff', fontSize: '0.62rem', fontWeight: 800, borderRadius: '999px', padding: '0.1rem 0.4rem' }}>
                  {awaitingApproval.length}
                </span>
              )}
            </h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Sprint approval workflow</p>
          </div>
        </div>
        <Link to="/admin/sprint-approvals" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <ExternalLink size={12} /> Review All
        </Link>
      </div>

      <div className="card-body" style={{ padding: '0.85rem 1.25rem' }}>
        {awaitingApproval.length === 0 && recentlyCompleted.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            <CheckCircle2 size={24} style={{ color: '#10b981', marginBottom: '0.4rem' }} />
            <div>No pending approvals</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {awaitingApproval.length > 0 && (
              <>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Pending ({awaitingApproval.length})
                </div>
                {awaitingApproval.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <ClipboardCheck size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={10} />
                        {s.submitted_at ? formatRelativeTime(s.submitted_at) : 'Submitted'}
                        {s.assigned_tester_name && <span>&bull; by {s.assigned_tester_name}</span>}
                      </div>
                    </div>
                    <Link to="/admin/sprint-approvals" style={{ fontSize: '0.68rem', fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', padding: '0.25rem 0.6rem', borderRadius: '5px', textDecoration: 'none', flexShrink: 0 }}>
                      Review
                    </Link>
                  </div>
                ))}
              </>
            )}
            {recentlyCompleted.length > 0 && (
              <>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                  Recently Completed ({recentlyCompleted.length})
                </div>
                {recentlyCompleted.slice(0, 3).map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.85rem', borderRadius: '8px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '0.2rem 0.45rem', borderRadius: '4px' }}>COMPLETED</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminApprovalCenter;
