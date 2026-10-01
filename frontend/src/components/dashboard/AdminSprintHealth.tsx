/**
 * AdminSprintHealth
 * Shows active/recent sprint health from real sprint data.
 * Props-driven.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, ExternalLink, Layers, XCircle } from 'lucide-react';
import type { Sprint } from '../../types/Sprint';
import { formatDate } from '../../utils/formatters';

interface Props { sprints: Sprint[]; }

function sprintHealth(s: Sprint): 'on_track' | 'at_risk' | 'overdue' | 'completed' {
  if (s.status === 'COMPLETED' || s.status === 'ARCHIVED') return 'completed';
  const now = Date.now();
  const end = new Date(s.end_date).getTime();
  if (end < now) return 'overdue';
  const total = s.total_issues ?? 0;
  const completed = s.completed_issues ?? 0;
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const elapsed = s.actual_start_date ? (now - new Date(s.actual_start_date).getTime()) : 0;
  const duration = end - (s.actual_start_date ? new Date(s.actual_start_date).getTime() : now);
  const expectedProgress = duration > 0 ? (elapsed / duration) * 100 : 0;
  if (progress < expectedProgress - 20) return 'at_risk';
  return 'on_track';
}

const HEALTH_META = {
  on_track: { label: 'On Track', color: '#10b981', icon: <CheckCircle2 size={13} /> },
  at_risk: { label: 'At Risk', color: '#f59e0b', icon: <AlertTriangle size={13} /> },
  overdue: { label: 'Overdue', color: '#ef4444', icon: <XCircle size={13} /> },
  completed: { label: 'Completed', color: '#6366f1', icon: <CheckCircle2 size={13} /> },
};

export const AdminSprintHealth: React.FC<Props> = ({ sprints }) => {
  const [showAll, setShowAll] = useState(false);

  const activeSprints = sprints
    .filter((s) => ['ACTIVE', 'IN_PROGRESS', 'READY_FOR_APPROVAL', 'COMPLETED'].includes(s.status))
    .sort((a, b) => {
      const order: Record<string, number> = { READY_FOR_APPROVAL: 0, IN_PROGRESS: 1, ACTIVE: 2, COMPLETED: 3 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });

  const visible = showAll ? activeSprints : activeSprints.slice(0, 5);

  return (
    <section className="card" style={{ border: '1px solid var(--border-subtle)' }}>
      <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={14} />
          </div>
          <h2 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Sprint Health</h2>
        </div>
        <Link to="/admin/sprints" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <ExternalLink size={12} /> View All
        </Link>
      </div>
      <div className="card-body" style={{ padding: '0.85rem 1.25rem' }}>
        {activeSprints.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No active sprints</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {visible.map((s) => {
              const health = sprintHealth(s);
              const meta = HEALTH_META[health];
              const progress = s.progress_percentage ?? (s.total_issues && s.total_issues > 0 ? Math.round(((s.completed_issues ?? 0) / s.total_issues) * 100) : 0);
              return (
                <div key={s.id} style={{ padding: '0.7rem 0.9rem', borderRadius: '9px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      {s.project_name && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{s.project_name}</div>}
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: meta.color, flexShrink: 0, marginLeft: '0.5rem' }}>
                      {meta.icon}{meta.label}
                    </span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border-subtle)', overflow: 'hidden', marginBottom: '0.4rem' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: meta.color, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span>{s.completed_issues ?? 0}/{s.total_issues ?? 0} issues &bull; {progress}%</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={10} />{formatDate(s.end_date)}</span>
                  </div>
                </div>
              );
            })}
            {activeSprints.length > 5 && (
              <button onClick={() => setShowAll((v) => !v)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '0 auto', padding: '0.3rem 0' }}>
                {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show {activeSprints.length - 5} more</>}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminSprintHealth;
