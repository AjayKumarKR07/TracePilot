import React from 'react';
import { Check, ChevronRight, Play, Sparkles, Clock, CheckCircle2, CircleDot } from 'lucide-react';
import type { SprintStatus } from '../../types/Sprint';

interface SprintLifecycleIndicatorProps {
  status: SprintStatus | string;
  hasReviewComment?: boolean;
  compact?: boolean;
}

interface StepConfig {
  key: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
}

const LIFECYCLE_STEPS: StepConfig[] = [
  {
    key: 'PLANNED',
    label: 'PLANNED',
    sublabel: 'Scope & Developer',
    icon: CircleDot,
    activeColor: '#94a3b8',
    activeBg: 'rgba(148,163,184,0.14)',
    activeBorder: 'rgba(148,163,184,0.35)',
  },
  {
    key: 'ACTIVE',
    label: 'ACTIVE',
    sublabel: 'Ready to Begin',
    icon: Play,
    activeColor: '#38bdf8',
    activeBg: 'rgba(56,189,248,0.14)',
    activeBorder: 'rgba(56,189,248,0.4)',
  },
  {
    key: 'IN_PROGRESS',
    label: 'IN PROGRESS',
    sublabel: 'Testing & Defect Fixes',
    icon: Sparkles,
    activeColor: '#fbbf24',
    activeBg: 'rgba(251,191,36,0.14)',
    activeBorder: 'rgba(251,191,36,0.4)',
  },
  {
    key: 'READY_FOR_APPROVAL',
    label: 'AWAITING APPROVAL',
    sublabel: 'Admin Review Queue',
    icon: Clock,
    activeColor: '#818cf8',
    activeBg: 'rgba(129,140,248,0.14)',
    activeBorder: 'rgba(129,140,248,0.4)',
  },
  {
    key: 'COMPLETED',
    label: 'COMPLETED',
    sublabel: 'Signed Off',
    icon: CheckCircle2,
    activeColor: '#10b981',
    activeBg: 'rgba(16,185,129,0.14)',
    activeBorder: 'rgba(16,185,129,0.4)',
  },
];

export const SprintLifecycleIndicator: React.FC<SprintLifecycleIndicatorProps> = ({
  status,
  hasReviewComment = false,
  compact = false,
}) => {
  // Map status string to index
  const normalizedStatus = status === 'ARCHIVED' ? 'COMPLETED' : status;
  const currentStepIndex = LIFECYCLE_STEPS.findIndex((s) => s.key === normalizedStatus);
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '0.25rem' : '0.4rem',
        padding: compact ? '0.4rem 0.6rem' : '0.65rem 0.9rem',
        borderRadius: '8px',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        border: '1px solid var(--border-subtle)',
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'auto',
      }}
    >
      {LIFECYCLE_STEPS.map((step, idx) => {
        const isPast = idx < activeIndex;
        const isCurrent = idx === activeIndex;
        const isFuture = idx > activeIndex;

        const IconComponent = step.icon;

        let bg = 'transparent';
        let border = 'transparent';

        if (isCurrent) {
          bg = step.activeBg;
          border = step.activeBorder;
        } else if (isPast) {
          bg = 'rgba(16,185,129,0.08)';
          border = 'rgba(16,185,129,0.2)';
        }

        return (
          <React.Fragment key={step.key}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: compact ? '0.25rem 0.5rem' : '0.35rem 0.65rem',
                borderRadius: '6px',
                backgroundColor: bg,
                border: `1px solid ${border}`,
                flex: 1,
                minWidth: compact ? '70px' : '95px',
                transition: 'all 0.2s ease',
              }}
              title={`${step.label}: ${step.sublabel}`}
            >
              {/* Step indicator circle / icon */}
              <div
                style={{
                  width: compact ? '18px' : '22px',
                  height: compact ? '18px' : '22px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isCurrent
                    ? step.activeColor
                    : isPast
                    ? '#10b981'
                    : 'rgba(255,255,255,0.06)',
                  color: isCurrent || isPast ? '#0f172a' : 'var(--text-muted)',
                  fontSize: compact ? '0.65rem' : '0.72rem',
                  fontWeight: 800,
                  flexShrink: 0,
                  boxShadow: isCurrent ? `0 0 8px ${step.activeColor}55` : 'none',
                }}
              >
                {isPast ? (
                  <Check size={compact ? 11 : 13} strokeWidth={3} />
                ) : (
                  <IconComponent size={compact ? 11 : 12} />
                )}
              </div>

              {/* Step text */}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.2 }}>
                <span
                  style={{
                    fontSize: compact ? '0.65rem' : '0.74rem',
                    fontWeight: isCurrent ? 800 : isPast ? 700 : 600,
                    color: isCurrent ? step.activeColor : isPast ? '#e2e8f0' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    letterSpacing: '0.02em',
                  }}
                >
                  {step.label}
                  {isCurrent && isCurrent && hasReviewComment && step.key === 'IN_PROGRESS' && ' (REWORK)'}
                </span>
                {!compact && (
                  <span
                    style={{
                      fontSize: '0.64rem',
                      color: isCurrent ? 'var(--text-secondary)' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {isCurrent && hasReviewComment && step.key === 'IN_PROGRESS'
                      ? 'Changes requested'
                      : step.sublabel}
                  </span>
                )}
              </div>

              {/* Current Badge */}
              {isCurrent && (
                <span
                  style={{
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    backgroundColor: step.activeColor,
                    color: '#0f172a',
                    marginLeft: 'auto',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    display: compact ? 'none' : 'inline-block',
                  }}
                >
                  Current
                </span>
              )}
            </div>

            {/* Connecting Chevron */}
            {idx < LIFECYCLE_STEPS.length - 1 && (
              <ChevronRight
                size={compact ? 12 : 14}
                style={{
                  color: isPast ? '#10b981' : isCurrent ? step.activeColor : 'rgba(255,255,255,0.15)',
                  flexShrink: 0,
                  opacity: isFuture ? 0.4 : 0.8,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
