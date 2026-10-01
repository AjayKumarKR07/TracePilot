/**
 * AdminIssueDistribution
 * Shows severity and priority breakdown from real backend data.
 * Props-driven (from AdminDashboardResponse stats).
 */
import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { AdminDashboardResponse } from '../../types/admin';

interface Props { stats: AdminDashboardResponse; }

const Bar: React.FC<{ label: string; count: number; total: number; color: string }> = ({ label, count, total, color }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.78rem' }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{count.toLocaleString()} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s' }} />
      </div>
    </div>
  );
};

export const AdminIssueDistribution: React.FC<Props> = ({ stats }) => {
  const totalSev = stats.severity.minor + stats.severity.major + stats.severity.critical + stats.severity.blocker;
  const totalPri = stats.priority.low + stats.priority.medium + stats.priority.high + stats.priority.urgent;

  return (
    <section className="card" style={{ border: '1px solid var(--border-subtle)' }}>
      <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={14} />
          </div>
          <h2 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Issue Distribution</h2>
        </div>
      </div>
      <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              By Severity
            </div>
            <Bar label="Blocker" count={stats.severity.blocker} total={totalSev} color="#ef4444" />
            <Bar label="Critical" count={stats.severity.critical} total={totalSev} color="#f97316" />
            <Bar label="Major" count={stats.severity.major} total={totalSev} color="#f59e0b" />
            <Bar label="Minor" count={stats.severity.minor} total={totalSev} color="#6366f1" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              By Priority
            </div>
            <Bar label="Urgent" count={stats.priority.urgent} total={totalPri} color="#ef4444" />
            <Bar label="High" count={stats.priority.high} total={totalPri} color="#f97316" />
            <Bar label="Medium" count={stats.priority.medium} total={totalPri} color="#f59e0b" />
            <Bar label="Low" count={stats.priority.low} total={totalPri} color="#64748b" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminIssueDistribution;
