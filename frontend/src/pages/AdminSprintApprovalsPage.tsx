import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  ThumbsUp,
} from 'lucide-react';
import { SprintService } from '../services/SprintService';
import { issuesApi } from '../api/issues';
import { useNotifications } from '../hooks/useNotifications';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Modal } from '../components/common/Modal';
import { SprintLifecycleIndicator } from '../components/sprints/SprintLifecycleIndicator';
import type { Sprint } from '../types/Sprint';
import { formatDate, formatRelativeTime } from '../utils/formatters';

export const AdminSprintApprovalsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const targetSprintId = searchParams.get('sprintId');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [awaitingApproval, setAwaitingApproval] = useState<Sprint[]>([]);
  const [allSprints, setAllSprints] = useState<Sprint[]>([]);
  const [sprintIssues, setSprintIssues] = useState<Record<number, any[]>>({});

  // Action states
  const [requestChangesSprintId, setRequestChangesSprintId] = useState<number | null>(null);
  const [requestChangesComment, setRequestChangesComment] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [resolvingIssueId, setResolvingIssueId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [pending, all] = await Promise.all([
        SprintService.getAwaitingApprovalSprints(),
        SprintService.getAllSprints(),
      ]);
      setAwaitingApproval(pending || []);
      setAllSprints(all || []);

      if (pending && pending.length > 0) {
        const issueMap: Record<number, any[]> = {};
        await Promise.all(
          pending.map(async (s) => {
            try {
              const res = await issuesApi.list({ sprint_id: s.id, page_size: 50 });
              issueMap[s.id] = res.items || [];
            } catch {
              issueMap[s.id] = [];
            }
          })
        );
        setSprintIssues(issueMap);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load approval requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const { wsStatus, notifications: liveNotifications } = useNotifications();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time WebSocket refresh
  const isInitialMount = useRef(true);
  const latestNotificationId = liveNotifications[0]?.id;

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (latestNotificationId) {
      fetchData(true);
    }
  }, [latestNotificationId, fetchData]);

  // Refetch when WebSocket reconnects
  useEffect(() => {
    if (wsStatus === 'connected') {
      fetchData(true);
    }
  }, [wsStatus, fetchData]);

  // Listen for broadcasted app-level realtime events
  useEffect(() => {
    const handleRealtime = () => {
      fetchData(true);
    };
    window.addEventListener('app:realtime_notification', handleRealtime);
    window.addEventListener('app:ws_reconnected', handleRealtime);
    return () => {
      window.removeEventListener('app:realtime_notification', handleRealtime);
      window.removeEventListener('app:ws_reconnected', handleRealtime);
    };
  }, [fetchData]);

  // Handle notification deep-link: scroll to targeted sprint
  useEffect(() => {
    if (targetSprintId) {
      const sId = parseInt(targetSprintId, 10);
      if (!isNaN(sId)) {
        setTimeout(() => {
          const el = document.getElementById(`approval-sprint-${sId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      }
    }
  }, [targetSprintId, awaitingApproval, allSprints]);

  const handleApproveSprint = async (sprintId: number) => {
    setActionLoadingId(sprintId);
    try {
      await SprintService.approveSprint(sprintId);
      setToastMessage({ type: 'success', text: 'Sprint approved! Status updated to COMPLETED.' });
      fetchData(true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to approve sprint' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResolveIssue = async (_sprintId: number, issueId: number) => {
    setResolvingIssueId(issueId);
    try {
      await issuesApi.updateStatus(issueId, { status: 'RESOLVED' as any });
      setToastMessage({ type: 'success', text: 'Issue marked as RESOLVED! Sprint is now ready for approval.' });
      await fetchData(true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to update issue status' });
    } finally {
      setResolvingIssueId(null);
    }
  };

  const handleRequestChanges = async () => {
    if (!requestChangesSprintId) return;
    if (!requestChangesComment.trim()) {
      setToastMessage({ type: 'error', text: 'Please enter a review comment explaining what changes are requested.' });
      return;
    }
    setActionLoadingId(requestChangesSprintId);
    try {
      await SprintService.requestChanges(requestChangesSprintId, requestChangesComment.trim());
      setToastMessage({ type: 'success', text: 'Changes requested. Sprint returned to IN_PROGRESS.' });
      setRequestChangesSprintId(null);
      setRequestChangesComment('');
      fetchData(true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to request changes' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Recently approved/completed sprints for history
  const recentlyCompleted = allSprints
    .filter((s) => s.status === 'COMPLETED')
    .slice(0, 10);

  if (loading && awaitingApproval.length === 0) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <LoadingSpinner message="Loading Sprint Approval Requests..." />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            background: toastMessage.type === 'success' ? '#059669' : '#dc2626',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.88rem',
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '0.5rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <ClipboardCheck size={28} style={{ color: 'var(--primary)' }} />
            Sprint Approvals &amp; Governance
          </h1>
          <p className="page-subtitle">
            Review completed sprint deliverables submitted by Developers and grant official completion sign-off.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Workflow Explainer Ribbon */}
      <div
        style={{
          background: 'linear-gradient(90deg, rgba(99,102,241,0.12), rgba(16,185,129,0.08))',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '10px',
          padding: '0.85rem 1.25rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          fontSize: '0.85rem',
        }}
      >
        <span style={{ fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
          Sprint Approval Gateway Process
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <span style={{ padding: '0.15rem 0.5rem', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
            READY_FOR_APPROVAL
          </span>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span>Admin Review</span>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ padding: '0.15rem 0.5rem', background: 'rgba(16,185,129,0.2)', color: '#34d399', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
            ✓ APPROVE → COMPLETED
          </span>
          <span style={{ color: 'var(--text-muted)' }}>or</span>
          <span style={{ padding: '0.15rem 0.5rem', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
            ↺ REQUEST CHANGES → IN_PROGRESS (Developer Rework)
          </span>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => fetchData()} />}

      {/* Pending Sprints Section */}
      <section className="card" style={{ marginBottom: '2.5rem' }}>
        <div
          className="card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: awaitingApproval.length > 0 ? 'rgba(99,102,241,0.06)' : undefined,
          }}
        >
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardCheck size={18} style={{ color: awaitingApproval.length > 0 ? '#818cf8' : 'var(--text-muted)' }} />
            Pending Approval ({awaitingApproval.length})
          </h2>
          {awaitingApproval.length > 0 && (
            <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#6366f1', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
              ACTION REQUIRED
            </span>
          )}
        </div>

        <div className="card-body">
          {awaitingApproval.length === 0 ? (
            <div className="empty-state" style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(16,185,129,0.1)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                }}
              >
                <CheckCircle2 size={30} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                All Sprint Submissions Reviewed
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto' }}>
                No sprints are currently waiting for admin sign-off. When a developer completes work and submits a sprint, it will appear here for review.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {awaitingApproval.map((sprint) => {
                const totalIssues = sprint.total_issues ?? 0;
                const completedIssues = sprint.completed_issues ?? 0;
                const pct = sprint.progress_percentage ?? (totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0);
                const isApprovable = totalIssues > 0 && completedIssues >= totalIssues;
                const issues = sprintIssues[sprint.id] || [];

                const isTargeted = targetSprintId ? sprint.id === parseInt(targetSprintId, 10) : false;

                return (
                  <div
                    key={sprint.id}
                    id={`approval-sprint-${sprint.id}`}
                    style={{
                      padding: '1.5rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: isTargeted ? '2px solid var(--primary)' : '1px solid rgba(99,102,241,0.3)',
                      boxShadow: isTargeted
                        ? '0 0 0 2px var(--primary), 0 8px 25px -5px rgba(99, 102, 241, 0.4)'
                        : '0 4px 12px rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {/* Lifecycle Indicator */}
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                        Sprint Lifecycle Stage
                      </div>
                      <SprintLifecycleIndicator
                        status={sprint.status}
                        hasReviewComment={Boolean(sprint.review_comment)}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {sprint.name}
                          </span>
                          {sprint.project_name && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                              {sprint.project_key ? `[${sprint.project_key}] ` : ''}{sprint.project_name}
                            </span>
                          )}
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(99,102,241,0.25)', color: '#818cf8', padding: '0.15rem 0.55rem', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.4)' }}>
                            AWAITING ADMIN APPROVAL
                          </span>
                        </div>

                        {sprint.goal && (
                          <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
                            <strong>Goal:</strong> {sprint.goal}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>
                            Assigned Developer: <strong style={{ color: '#34d399' }}>{sprint.assigned_tester_name || '—'}</strong>
                          </span>
                          <span>
                            Sprint Window: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(sprint.start_date)}</strong> to <strong style={{ color: 'var(--text-primary)' }}>{formatDate(sprint.end_date)}</strong>
                          </span>
                          {sprint.submitted_at && (
                            <span>
                              Submitted: <strong style={{ color: '#818cf8' }}>{formatRelativeTime(sprint.submitted_at)}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Approval Actions */}
                      <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0, alignItems: 'center' }}>
                        <Link
                          to={`/projects/${sprint.project_id}/sprints`}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.82rem', padding: '0.5rem 0.95rem' }}
                        >
                          <ExternalLink size={15} /> View Sprint
                        </Link>
                        <button
                          className="btn btn-success"
                          disabled={actionLoadingId === sprint.id || !isApprovable}
                          onClick={() => handleApproveSprint(sprint.id)}
                          style={{
                            fontSize: '0.82rem',
                            padding: '0.5rem 1.1rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            backgroundColor: isApprovable ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
                            borderColor: isApprovable ? '#10b981' : 'rgba(16, 185, 129, 0.4)',
                            color: isApprovable ? '#ffffff' : '#6ee7b7',
                            cursor: isApprovable ? 'pointer' : 'not-allowed',
                            boxShadow: isApprovable ? '0 2px 10px rgba(16, 185, 129, 0.35)' : 'none',
                          }}
                          title={
                            totalIssues === 0
                              ? 'Sprint has no issues assigned. Add backlog issues before approving this sprint.'
                              : completedIssues < totalIssues
                              ? `Cannot approve: ${totalIssues - completedIssues} of ${totalIssues} defect(s) are still unresolved. Resolve all defects to approve.`
                              : 'Approve Sprint → Transitions to COMPLETED'
                          }
                        >
                          <ThumbsUp size={15} />
                          <span>Approve Sprint</span>
                          {!isApprovable && totalIssues > 0 && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '4px',
                                background: 'rgba(239, 68, 68, 0.25)',
                                color: '#fca5a5',
                                fontWeight: 800,
                                marginLeft: '0.25rem',
                              }}
                            >
                              {completedIssues}/{totalIssues} Done
                            </span>
                          )}
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={actionLoadingId === sprint.id}
                          onClick={() => {
                            setRequestChangesSprintId(sprint.id);
                            setRequestChangesComment('');
                          }}
                          style={{ fontSize: '0.82rem', padding: '0.5rem 0.95rem' }}
                          title="Request changes → Returns to IN_PROGRESS for developer rework"
                        >
                          <RotateCcw size={15} /> Request Changes
                        </button>
                      </div>
                    </div>

                    {/* Warning if sprint cannot be approved */}
                    {!isApprovable && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#f87171',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                      >
                        <AlertCircle size={18} style={{ flexShrink: 0, color: '#ef4444' }} />
                        <span>
                          {totalIssues === 0
                            ? '⚠ Sprint has no issues assigned. Add backlog issues before starting/approving this sprint.'
                            : `Sprint cannot be completed. ${totalIssues - completedIssues} of ${totalIssues} assigned defect(s) are still unresolved. Resolve all issues before approval.`}
                        </span>
                      </div>
                    )}

                    {/* Progress Bar and Agile Metrics Grid */}
                    <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.65rem', marginBottom: '0.85rem' }}>
                        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Issues</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>{totalIssues}</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completed</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{completedIssues}</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (totalIssues - completedIssues) > 0 ? '#f59e0b' : '#94a3b8' }}>{Math.max(0, totalIssues - completedIssues)}</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Progress %</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: pct >= 100 ? '#10b981' : '#818cf8' }}>{pct}%</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estimated Effort</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#a78bfa' }}>{totalIssues * 5} pts</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.4rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Issue Completion: <strong>{completedIssues} / {totalIssues}</strong> issues closed
                        </span>
                        <span style={{ fontWeight: 800, color: pct >= 80 ? '#10b981' : '#f59e0b' }}>
                          {pct}% Complete
                        </span>
                      </div>
                      <div style={{ height: '7px', borderRadius: '4px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: pct >= 80 ? '#10b981' : '#f59e0b',
                            borderRadius: '4px',
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Assigned Sprint Defect List */}
                    {issues.length > 0 && (
                      <div style={{ background: 'var(--bg-surface)', padding: '0.9rem 1.1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Sprint Defects / Issues ({issues.length})
                          </span>
                          <span style={{ fontSize: '0.75rem', color: completedIssues === totalIssues && totalIssues > 0 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                            {completedIssues === totalIssues && totalIssues > 0 ? '✓ All Defects Resolved' : `${totalIssues - completedIssues} Unresolved`}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {issues.map((iss) => {
                            const isResolved = iss.status === 'RESOLVED' || iss.status === 'CLOSED';
                            return (
                              <div
                                key={iss.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '0.6rem',
                                  padding: '0.55rem 0.85rem',
                                  background: 'var(--bg-surface-elevated)',
                                  borderRadius: '8px',
                                  border: isResolved ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: '220px' }}>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary)' }}>
                                    {iss.issue_key}
                                  </span>
                                  <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    {iss.title}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '4px',
                                      backgroundColor: isResolved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                      color: isResolved ? '#34d399' : '#fbbf24',
                                      border: `1px solid ${isResolved ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                    }}
                                  >
                                    {iss.status}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Link
                                    to={`/issues/${iss.id}`}
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                                    title="View issue details"
                                  >
                                    <ExternalLink size={12} /> View
                                  </Link>
                                  {!isResolved && (
                                    <button
                                      className="btn btn-success btn-sm"
                                      disabled={resolvingIssueId === iss.id}
                                      onClick={() => handleResolveIssue(sprint.id, iss.id)}
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '0.25rem 0.65rem',
                                        fontWeight: 700,
                                        backgroundColor: '#10b981',
                                        borderColor: '#10b981',
                                        color: '#ffffff',
                                      }}
                                      title="Mark issue as RESOLVED so sprint can be approved"
                                    >
                                      <CheckCircle2 size={13} />
                                      <span>{resolvingIssueId === iss.id ? 'Resolving…' : 'Mark Resolved'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Recently Approved / Completed Sprints */}
      <section className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 700 }}>
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
            Recently Approved Sprints ({recentlyCompleted.length})
          </h2>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {recentlyCompleted.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No completed sprints found.
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sprint Name</th>
                    <th>Project</th>
                    <th>Developer</th>
                    <th>Issues Resolved</th>
                    <th>Velocity</th>
                    <th>Completed At</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentlyCompleted.map((s) => {
                    const isTargeted = targetSprintId ? s.id === parseInt(targetSprintId, 10) : false;
                    const comp = s.completed_issues ?? 0;
                    const tot = s.total_issues ?? 0;
                    return (
                      <tr
                        key={s.id}
                        id={`approval-sprint-${s.id}`}
                        style={
                          isTargeted
                            ? {
                                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                outline: '2px solid var(--primary)',
                                transition: 'all 0.3s ease',
                              }
                            : undefined
                        }
                      >
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {s.project_name || `Project #${s.project_id}`}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 600 }}>
                          {s.assigned_tester_name || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>
                          {comp} / {tot} ({tot > 0 ? Math.round((comp / tot) * 100) : 100}%)
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                          {comp} pts
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {s.completed_at ? formatRelativeTime(s.completed_at) : '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                          ✓ COMPLETED
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/projects/${s.project_id}/sprints`}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        >
                          View Sprint
                        </Link>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Request Changes Modal */}
      <Modal
        isOpen={requestChangesSprintId !== null}
        onClose={() => {
          setRequestChangesSprintId(null);
          setRequestChangesComment('');
        }}
        title="Request Changes on Sprint"
      >
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          The sprint will be returned to the assigned developer with status <strong>IN_PROGRESS</strong>.
        </p>
        <div className="form-group">
          <label className="form-label">Review Comment / Feedback (Required) *</label>
          <textarea
            className="form-textarea"
            required
            rows={4}
            value={requestChangesComment}
            onChange={(e) => setRequestChangesComment(e.target.value)}
            placeholder="Describe what defects need to be resolved, retested, or updated before final sign-off..."
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setRequestChangesSprintId(null);
              setRequestChangesComment('');
            }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!requestChangesComment.trim() || actionLoadingId !== null}
            onClick={handleRequestChanges}
          >
            Send Back to Developer
          </button>
        </div>
      </Modal>

      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            background: 'var(--bg-surface-elevated)',
            border: `1px solid ${toastMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
            padding: '0.9rem 1.25rem',
            borderRadius: '10px',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            zIndex: 9999,
          }}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          ) : (
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
          )}
          <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {toastMessage.text}
          </span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', marginLeft: '0.5rem' }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
