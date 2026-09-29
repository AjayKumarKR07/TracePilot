/**
 * IssueQualityCard — Calculates a quality score from real IssueDetail fields.
 *
 * Scoring (only uses fields that actually exist in IssueDetail):
 *   title              20pts  — present and longer than 10 chars
 *   description        20pts  — present and longer than 30 chars
 *   steps_to_reproduce 20pts  — present and longer than 10 chars
 *   expected_result    15pts  — present and longer than 5 chars
 *   actual_result      15pts  — present and longer than 5 chars
 *   severity           5pts   — always selected (required field)
 *   priority           5pts   — always selected (required field)
 *   environment        0→5pts — bonus if present
 *
 * Total max: 100 (with environment bonus capped at 5 extra points)
 *
 * AI integration: "Improve with AI" sends the issue to aiApi.analyzeIssue()
 * as a suggestion only. No automatic modifications.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import { issuesApi } from '../../api/issues';
import { aiApi } from '../../api/ai';
import { getApiErrorMessage } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { Issue, IssueDetail } from '../../types/issue';

// ─────────────────────────────────────────────────────────────────────────────
// Scoring Logic
// ─────────────────────────────────────────────────────────────────────────────
interface ScoreCriterion {
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  suggestion?: string;
}

function scoreIssue(detail: IssueDetail): { score: number; maxScore: number; criteria: ScoreCriterion[] } {
  const criteria: ScoreCriterion[] = [
    {
      label: 'Clear, descriptive title',
      passed: detail.title?.trim().length > 10,
      points: detail.title?.trim().length > 10 ? 20 : 0,
      maxPoints: 20,
      suggestion: 'Make the title more descriptive (at least 10 characters).',
    },
    {
      label: 'Detailed description',
      passed: detail.description?.trim().length > 30,
      points: detail.description?.trim().length > 30 ? 20 : 0,
      maxPoints: 20,
      suggestion: 'Add a thorough description (at least 30 characters) explaining the problem.',
    },
    {
      label: 'Steps to reproduce',
      passed: !!(detail.steps_to_reproduce?.trim().length ?? 0 > 10),
      points: !!(detail.steps_to_reproduce?.trim().length ?? 0 > 10) ? 20 : 0,
      maxPoints: 20,
      suggestion: 'Add numbered steps to reproduce the issue for faster investigation.',
    },
    {
      label: 'Expected result',
      passed: !!(detail.expected_result?.trim().length ?? 0 > 5),
      points: !!(detail.expected_result?.trim().length ?? 0 > 5) ? 15 : 0,
      maxPoints: 15,
      suggestion: 'Describe what you expected to happen.',
    },
    {
      label: 'Actual result',
      passed: !!(detail.actual_result?.trim().length ?? 0 > 5),
      points: !!(detail.actual_result?.trim().length ?? 0 > 5) ? 15 : 0,
      maxPoints: 15,
      suggestion: 'Describe what actually happened instead.',
    },
    {
      label: 'Severity selected',
      passed: !!detail.severity,
      points: !!detail.severity ? 5 : 0,
      maxPoints: 5,
      suggestion: 'Select the severity level of this issue.',
    },
    {
      label: 'Priority selected',
      passed: !!detail.priority,
      points: !!detail.priority ? 5 : 0,
      maxPoints: 5,
      suggestion: 'Select the priority level of this issue.',
    },
    {
      label: 'Environment information',
      passed: !!(detail.environment?.trim().length ?? 0 > 3),
      points: !!(detail.environment?.trim().length ?? 0 > 3) ? 5 : 0,
      maxPoints: 5,
      suggestion: 'Add OS, browser, or app version where the issue occurs.',
    },
  ];

  const score = criteria.reduce((sum, c) => sum + c.points, 0);
  const maxScore = criteria.reduce((sum, c) => sum + c.maxPoints, 0);

  return { score, maxScore, criteria };
}

function scoreColor(pct: number): string {
  if (pct >= 80) return '#34d399';
  if (pct >= 55) return '#f59e0b';
  return '#f87171';
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  userIssues: Issue[];
}

export const IssueQualityCard: React.FC<Props> = ({ userIssues }) => {
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [detail, setDetail] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Auto-select most recent issue on first mount
  useEffect(() => {
    if (userIssues.length > 0 && selectedIssueId === null) {
      const sorted = [...userIssues].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setSelectedIssueId(sorted[0].id);
    }
  }, [userIssues, selectedIssueId]);

  // Fetch IssueDetail when selection changes
  useEffect(() => {
    if (selectedIssueId === null) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    setAiResult(null);
    setAiError(null);
    issuesApi
      .getById(selectedIssueId)
      .then((d) => setDetail(d))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [selectedIssueId]);

  const scoring = useMemo(() => (detail ? scoreIssue(detail) : null), [detail]);
  const pct = scoring ? Math.round((scoring.score / scoring.maxScore) * 100) : 0;
  const missingCriteria = scoring?.criteria.filter((c) => !c.passed) ?? [];

  const handleImproveWithAI = useCallback(async () => {
    if (!detail) return;
    setAiLoading(true);
    setAiResult(null);
    setAiError(null);
    try {
      const res = await aiApi.chat({
        message:
          `Review this issue and suggest improvements to its quality (title, description, reproduction steps, expected result, actual result). ` +
          `Do NOT make any changes — only provide written suggestions.\n\n` +
          `Issue Key: ${detail.issue_key}\n` +
          `Title: ${detail.title}\n` +
          `Description: ${detail.description || 'Not provided'}\n` +
          `Steps to Reproduce: ${detail.steps_to_reproduce || 'Not provided'}\n` +
          `Expected Result: ${detail.expected_result || 'Not provided'}\n` +
          `Actual Result: ${detail.actual_result || 'Not provided'}\n` +
          `Environment: ${detail.environment || 'Not provided'}`,
        issue_id: detail.id,
      });
      setAiResult(res.message);
    } catch (err) {
      setAiError(getApiErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  }, [detail]);

  if (userIssues.length === 0) {
    return (
      <section className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <ClipboardCheck size={18} color="#818cf8" />
          <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Issue Quality
          </span>
        </div>
        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <ClipboardCheck size={28} style={{ opacity: 0.25, display: 'block', margin: '0 auto 0.5rem' }} />
          Report an issue to see its quality score.
        </div>
      </section>
    );
  }

  return (
    <section className="card" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <ClipboardCheck size={18} color="#818cf8" />
        <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          Issue Quality
        </span>
      </div>

      {/* Issue Selector */}
      <select
        value={selectedIssueId ?? ''}
        onChange={(e) => setSelectedIssueId(Number(e.target.value))}
        style={{
          width: '100%',
          padding: '0.4rem 0.65rem',
          fontSize: '0.82rem',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-muted)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          marginBottom: '1rem',
        }}
      >
        {[...userIssues]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 30)
          .map((iss) => (
            <option key={iss.id} value={iss.id}>
              {iss.issue_key} — {iss.title.slice(0, 40)}{iss.title.length > 40 ? '…' : ''}
            </option>
          ))}
      </select>

      {/* Loading / Error */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}>
          <LoadingSpinner message="Analysing issue quality…" />
        </div>
      )}
      {error && (
        <p style={{ fontSize: '0.82rem', color: '#f87171', textAlign: 'center' }}>{error}</p>
      )}

      {/* Score */}
      {!loading && !error && detail && scoring && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Score Ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: `conic-gradient(${scoreColor(pct)} ${pct * 3.6}deg, var(--border-subtle) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: '800', color: scoreColor(pct) }}>
                  {pct}%
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {pct >= 80 ? 'Excellent quality' : pct >= 55 ? 'Needs improvement' : 'Incomplete report'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {scoring.score}/{scoring.maxScore} points
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                {detail.issue_key}
              </div>
            </div>
          </div>

          {/* Criteria list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {scoring.criteria.map((c) => (
              <div
                key={c.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.78rem',
                  color: c.passed ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {c.passed ? (
                  <CheckCircle2 size={13} color="#34d399" style={{ flexShrink: 0 }} />
                ) : (
                  <AlertCircle size={13} color="#f87171" style={{ flexShrink: 0 }} />
                )}
                <span>{c.label}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600, color: c.passed ? '#34d399' : '#f87171' }}>
                  {c.points}/{c.maxPoints}
                </span>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {missingCriteria.length > 0 && (
            <div
              style={{
                backgroundColor: 'rgba(245,158,11,0.07)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.65rem 0.85rem',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.35rem' }}>
                Suggestions
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {missingCriteria.map((c) => (
                  <li key={c.label} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {c.suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improve with AI button */}
          <button
            onClick={handleImproveWithAI}
            disabled={aiLoading}
            className="btn btn-secondary btn-sm"
            style={{ justifyContent: 'center', gap: '0.4rem' }}
          >
            <Sparkles size={13} />
            <span>{aiLoading ? 'Analysing…' : 'Improve with AI'}</span>
          </button>

          {/* AI result */}
          {aiError && (
            <p style={{ fontSize: '0.78rem', color: '#f87171' }}>{aiError}</p>
          )}
          {aiResult && (
            <div
              style={{
                backgroundColor: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 0.9rem',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#818cf8', marginBottom: '0.4rem' }}>
                AI Suggestions (Advisory Only — No Changes Made)
              </div>
              {aiResult}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
