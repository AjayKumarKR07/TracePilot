/**
 * AdminSystemHealth
 * Displays compact health status for Projects, Issues, Sprints, Approvals, Assignments.
 * Calculated from real AdminDashboardResponse data passed as props.
 */
import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, FolderGit2, Layers, UserCheck, XCircle } from 'lucide-react';
import type { AdminDashboardResponse } from '../../types/admin';

interface Props { stats: AdminDashboardResponse; }

interface HealthDomain {
  label: string;
  status: 'healthy' | 'attention' | 'critical';
  detail: string;
  icon: React.ReactNode;
}

function computeHealth(stats: AdminDashboardResponse): HealthDomain[] {
  const totalIssues = stats.issues.total || 1;
  const resolutionRate = (stats.issues.resolved + stats.issues.closed) / totalIssues;
  const reopenRate = stats.issues.reopened / totalIssues;
  const criticalCount = stats.severity.critical + stats.severity.blocker;

  const issueStatus: 'healthy' | 'attention' | 'critical' =
    criticalCount > 50 || reopenRate > 0.15 ? 'critical'
    : criticalCount > 10 || reopenRate > 0.05 ? 'attention'
    : 'healthy';

  const sprintStatus: 'healthy' | 'attention' | 'critical' =
    (stats.sprints?.ready_for_approval || 0) > 5 ? 'critical'
    : (stats.sprints?.ready_for_approval || 0) > 0 ? 'attention'
    : 'healthy';

  const approvalStatus: 'healthy' | 'attention' | 'critical' =
    (stats.sprints?.ready_for_approval || 0) >= 3 ? 'critical'
    : (stats.sprints?.ready_for_approval || 0) > 0 ? 'attention'
    : 'healthy';

  const projectStatus: 'healthy' | 'attention' | 'critical' =
    stats.projects.inactive > stats.projects.active ? 'attention' : 'healthy';

  const assignmentStatus: 'healthy' | 'attention' | 'critical' =
    (stats.backlog?.unassigned || 0) > 100 ? 'critical'
    : (stats.backlog?.unassigned || 0) > 20 ? 'attention'
    : 'healthy';

  return [
    {
      label: 'Project Health',
      status: projectStatus,
      detail: `${stats.projects.active} active / ${stats.projects.inactive} inactive`,
      icon: <FolderGit2 size={15} />,
    },
    {
      label: 'Issue Health',
      status: issueStatus,
      detail: `${Math.round(resolutionRate * 100)}% resolved, ${stats.severity.blocker} blockers`,
      icon: <Activity size={15} />,
    },
    {
      label: 'Sprint Health',
      status: sprintStatus,
      detail: `${(stats.sprints?.active || 0) + (stats.sprints?.in_progress || 0)} running, ${stats.sprints?.planned || 0} planned`,
      icon: <Layers size={15} />,
    },
    {
      label: 'Approval Health',
      status: approvalStatus,
      detail: `${stats.sprints?.ready_for_approval || 0} awaiting review`,
      icon: <CheckCircle2 size={15} />,
    },
    {
      label: 'Assignment Health',
      status: assignmentStatus,
      detail: `${stats.backlog?.unassigned || 0} unassigned backlog items`,
      icon: <UserCheck size={15} />,
    },
  ];
}

const STATUS_META = {
  healthy: { label: 'Healthy', color: '#10b981', bg: 'rgba(16,185,129,0.10)', icon: <CheckCircle2 size={13} /> },
  attention: { label: 'Needs Attention', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', icon: <AlertTriangle size={13} /> },
  critical: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.10)', icon: <XCircle size={13} /> },
};

export const AdminSystemHealth: React.FC<Props> = ({ stats }) => {
  const domains = computeHealth(stats);
  const overallCritical = domains.filter((d) => d.status === 'critical').length;
  const overallAttention = domains.filter((d) => d.status === 'attention').length;
  const overallColor =
    overallCritical > 0 ? '#ef4444' : overallAttention > 0 ? '#f59e0b' : '#10b981';

  return (
    <section className="card" style={{ border: '1px solid var(--border-subtle)' }}>
      <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={14} />
          </div>
          <h2 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>System Health</h2>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: overallColor, background: `${overallColor}18`, padding: '0.2rem 0.65rem', borderRadius: '999px', border: `1px solid ${overallColor}30` }}>
          {overallCritical > 0 ? `${overallCritical} Critical` : overallAttention > 0 ? `${overallAttention} Need Attention` : 'All Healthy'}
        </span>
      </div>
      <div className="card-body" style={{ padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {domains.map((d) => {
            const meta = STATUS_META[d.status];
            return (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.85rem', borderRadius: '8px', background: meta.bg, border: `1px solid ${meta.color}22` }}>
                <div style={{ color: meta.color, display: 'flex' }}>{d.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{d.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{d.detail}</div>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: meta.color, whiteSpace: 'nowrap' }}>
                  {meta.icon}{meta.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AdminSystemHealth;
