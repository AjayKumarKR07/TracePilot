import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  History,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { issuesApi } from '../../api/issues';
import { getApiErrorMessage } from '../../api/client';
import { Modal } from '../common/Modal';
import { PriorityBadge } from '../common/PriorityBadge';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import type { Issue, IssueDetail } from '../../types/issue';
import type { AuditLogItem } from '../../types/audit';
import { formatDate, formatRelativeTime } from '../../utils/formatters';

interface DefectVerificationModalProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

type TabType = 'VERIFY_PASS' | 'VERIFY_FAIL' | 'HISTORY';

export const DefectVerificationModal: React.FC<DefectVerificationModalProps> = ({
  issue,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('VERIFY_PASS');
  const [issueDetail, setIssueDetail] = useState<IssueDetail | null>(null);
  const [activity, setActivity] = useState<AuditLogItem[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form fields for Verification Pass
  const [resolutionSummary, setResolutionSummary] = useState<string>('Defect fix verified and validated');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  // Form fields for Verification Fail
  const [failureReason, setFailureReason] = useState<string>('');

  // Load issue detail & activity when modal opens
  useEffect(() => {
    if (!isOpen || !issue) {
      setIssueDetail(null);
      setActivity([]);
      setErrorMsg(null);
      setActiveTab('VERIFY_PASS');
      setResolutionSummary('Defect fix verified and validated');
      setResolutionNotes('');
      setFailureReason('');
      return;
    }

    setIsLoadingDetail(true);
    setErrorMsg(null);

    Promise.all([
      issuesApi.getById(issue.id).catch(() => null),
      issuesApi.getActivity(issue.id).catch(() => []),
    ])
      .then(([detail, acts]) => {
        if (detail) setIssueDetail(detail);
        if (acts) setActivity(acts);
      })
      .catch((err) => {
        setErrorMsg(getApiErrorMessage(err));
      })
      .finally(() => {
        setIsLoadingDetail(false);
      });
  }, [isOpen, issue]);

  if (!isOpen || !issue) return null;

  // Handle Mark as Verified (Pass)
  const handleVerifyPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await issuesApi.resolve(issue.id, {
        resolution_summary: resolutionSummary.trim() || 'Defect verified and resolved',
        resolution_notes: resolutionNotes.trim() || undefined,
      });
      onSuccess(`Issue ${issue.issue_key} successfully verified and marked as RESOLVED!`);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Fail Verification & Reopen (Fail)
  const handleVerifyFail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue) return;
    if (!failureReason.trim()) {
      setErrorMsg('Please provide a failure reason explaining why the defect failed testing.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await issuesApi.reopen(issue.id, {
        reason: failureReason.trim(),
      });
      onSuccess(`Issue ${issue.issue_key} marked as failed verification and REOPENED for developer rework.`);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submit Defect Resolution: ${issue.issue_key}`}
      maxWidth="780px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.86rem',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Issue Overview Header */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: 'var(--primary)',
                  }}
                >
                  {issue.issue_key}
                </span>
                <StatusBadge status={issue.status} />
                <SeverityBadge severity={issue.severity} />
                <PriorityBadge priority={issue.priority} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {issue.title}
              </h4>
            </div>

            <Link
              to={`/issues/${issue.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <ExternalLink size={13} />
              <span>Full Details</span>
            </Link>
          </div>

          {/* Defect Context Meta */}
          {isLoadingDetail ? (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Loading defect reproduction steps and specifications…
            </div>
          ) : (
            issueDetail && (
              <div
                style={{
                  marginTop: '0.85rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.65rem',
                  fontSize: '0.78rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Reporter</span>
                  <span style={{ color: 'var(--text-primary)' }}>{issueDetail.reporter.full_name}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Project</span>
                  <span style={{ color: 'var(--text-primary)' }}>{issueDetail.project.name}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Environment</span>
                  <span style={{ color: 'var(--text-primary)' }}>{issueDetail.environment || 'Not specified'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Reported Date</span>
                  <span style={{ color: 'var(--text-primary)' }}>{formatDate(issueDetail.created_at)}</span>
                </div>
              </div>
            )
          )}
        </div>

        {/* Defect Description & Reproduction Steps Accordion */}
        {issueDetail && (
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.85rem 1.15rem',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div>
              <strong style={{ color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Defect Description:
              </strong>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                {issueDetail.description || 'No description provided.'}
              </p>
            </div>

            {issueDetail.steps_to_reproduce && (
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Steps to Reproduce:
                </strong>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  {issueDetail.steps_to_reproduce}
                </p>
              </div>
            )}

            {(issueDetail.expected_result || issueDetail.actual_result) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                {issueDetail.expected_result && (
                  <div>
                    <strong style={{ color: '#34d399', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Expected Result:
                    </strong>
                    <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)' }}>
                      {issueDetail.expected_result}
                    </p>
                  </div>
                )}
                {issueDetail.actual_result && (
                  <div>
                    <strong style={{ color: '#f87171', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Actual Result:
                    </strong>
                    <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)' }}>
                      {issueDetail.actual_result}
                    </p>
                  </div>
                )}
              </div>
            )}

            {issueDetail.resolution_summary && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '6px',
                  borderLeft: '3px solid #818cf8',
                }}
              >
                <strong style={{ color: '#818cf8', fontSize: '0.75rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sparkles size={12} /> Developer Resolution Notes:
                </strong>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {issueDetail.resolution_summary}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Verification Action Tabs */}
        <div>
          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              background: 'var(--bg-surface-elevated)',
              padding: '0.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '1rem',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('VERIFY_PASS')}
              style={{
                flex: 1,
                padding: '0.45rem 0.75rem',
                fontSize: '0.82rem',
                fontWeight: activeTab === 'VERIFY_PASS' ? 700 : 500,
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'VERIFY_PASS' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                color: activeTab === 'VERIFY_PASS' ? '#34d399' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              <CheckCircle2 size={15} />
              <span>Submit Resolution (Pass)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('VERIFY_FAIL')}
              style={{
                flex: 1,
                padding: '0.45rem 0.75rem',
                fontSize: '0.82rem',
                fontWeight: activeTab === 'VERIFY_FAIL' ? 700 : 500,
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'VERIFY_FAIL' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                color: activeTab === 'VERIFY_FAIL' ? '#f87171' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              <RotateCcw size={15} />
              <span>Return to Rework (Fail)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              style={{
                flex: 1,
                padding: '0.45rem 0.75rem',
                fontSize: '0.82rem',
                fontWeight: activeTab === 'HISTORY' ? 700 : 500,
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'HISTORY' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: activeTab === 'HISTORY' ? '#818cf8' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              <History size={15} />
              <span>Issue History ({activity.length})</span>
            </button>
          </div>

          {/* TAB 1: PASS */}
          {activeTab === 'VERIFY_PASS' && (
            <form onSubmit={handleVerifyPass} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <CheckCircle2 size={16} color="#34d399" />
                <span>
                  Submitting resolution will record testing observations and transition the issue to <strong>RESOLVED</strong> for user verification.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Resolution Summary <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  type="text"
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="e.g. Defect fix verified on staging environment v2.4"
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.84rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Testing Observations / Notes (Optional)
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Record testing environment, test matrix, edge cases checked, and test run outcomes…"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.84rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary btn-sm"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-success btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.84rem',
                    padding: '0.45rem 1rem',
                  }}
                >
                  <ClipboardCheck size={15} />
                  <span>{isSubmitting ? 'Submitting Resolution…' : 'Submit Resolution & Mark RESOLVED'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: FAIL */}
          {activeTab === 'VERIFY_FAIL' && (
            <form onSubmit={handleVerifyFail} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle size={16} color="#f87171" />
                <span>
                  Marking test as failed transitions this issue to <strong>REOPENED</strong> for developer rework.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Failure Feedback &amp; Defect Observations <span style={{ color: '#f87171' }}>*</span>
                </label>
                <textarea
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  placeholder="Detail the failure scenario: reproduction steps that still fail, unexpected behaviors, logs, or regression test failures…"
                  rows={4}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.84rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary btn-sm"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !failureReason.trim()}
                  className="btn btn-danger btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.84rem',
                    padding: '0.45rem 1rem',
                  }}
                >
                  <RotateCcw size={15} />
                  <span>{isSubmitting ? 'Reopening Issue…' : 'Return to Rework & Reopen Defect'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'HISTORY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '280px', overflowY: 'auto' }}>
              {activity.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  No prior activity or audit history found for this issue.
                </div>
              ) : (
                activity.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {event.actor?.full_name || 'System'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        {formatRelativeTime(event.created_at)}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {event.description}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
