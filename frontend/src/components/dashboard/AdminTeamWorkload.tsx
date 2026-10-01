/**
 * AdminTeamWorkload
 * Shows developer workload from /analytics/developers (reuses DeveloperAnalyticsResponse).
 * Props-driven from AdminDashboardPage workloads state.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import type { DeveloperAnalyticsItem } from '../../types/analytics';

interface Props { workloads: DeveloperAnalyticsItem[]; }

export const AdminTeamWorkload: React.FC<Props> = ({ workloads }) => {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...workloads].sort((a, b) => b.assigned_issues - a.assigned_issues);
  const visible = showAll ? sorted : sorted.slice(0, 6);

  function getInitials(name: string): string {
    return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
  }

  function workloadColor(rate: number): string {
    if (rate >= 80) return '#10b981';
    if (rate >= 50) return '#f59e0b';
    return '#ef4444';
  }

  return (
    <section className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
      <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(16,185,129,0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={14} />
          </div>
          <div>
            <h2 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Team Workload</h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{workloads.length} developer{workloads.length !== 1 ? 's' : ''} tracked</p>
          </div>
        </div>
      </div>
      <div className="card-body" style={{ padding: '0.85rem 1.25rem' }}>
        {workloads.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No developer data available</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {visible.map((dev) => {
              const name = dev.developer_name || dev.tester_name || 'Developer';
              const resRate = dev.resolution_rate;
              const rColor = workloadColor(resRate);
              return (
                <div key={dev.developer_id || dev.tester_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.85rem', borderRadius: '9px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4338ca)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>
                    {getInitials(name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      <span>Assigned: <strong style={{ color: 'var(--text-primary)' }}>{dev.assigned_issues}</strong></span>
                      <span>Open: <strong style={{ color: '#f59e0b' }}>{dev.open_issues}</strong></span>
                      <span>Resolved: <strong style={{ color: '#10b981' }}>{dev.resolved_issues}</strong></span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: rColor }}>{resRate.toFixed(0)}%</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Resolution</div>
                  </div>
                </div>
              );
            })}
            {sorted.length > 6 && (
              <button onClick={() => setShowAll((v) => !v)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '0 auto', padding: '0.3rem 0' }}>
                {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show {sorted.length - 6} more</>}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminTeamWorkload;
