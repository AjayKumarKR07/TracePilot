/**
 * TracePilotWorkflowStepper — Compact Defect Resolution Workflow Visualization.
 *
 * PURPOSE:
 * Visually communicates the operational lifecycle of a defect from initial
 * reporting/import through admin triage, developer resolution, review,
 * and final verification.
 *
 * CONSTRAINTS:
 * - Compact horizontal stepper (~120–180px height on desktop)
 * - Single concise description per step
 * - Fully responsive (horizontal on desktop, vertical stepper on mobile)
 * - Matches TracePilot SaaS aesthetic (subtle borders, muted progression)
 */

import React from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCheck,
  Code2,
  Database,
  GitBranch,
  Send,
  UserCheck,
} from 'lucide-react';

interface WorkflowStep {
  step: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  accentColor: string;
  bgLight: string;
  borderLight: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    step: '01',
    title: 'USER / DATASET',
    description: 'Reports or imports a defect',
    icon: Database,
    accentColor: '#0ea5e9',
    bgLight: 'rgba(14, 165, 233, 0.07)',
    borderLight: 'rgba(14, 165, 233, 0.22)',
  },
  {
    step: '02',
    title: 'ADMIN TRIAGE & ASSIGN',
    description: 'Reviews, prioritizes & assigns developer',
    icon: UserCheck,
    accentColor: '#6366f1',
    bgLight: 'rgba(99, 102, 241, 0.07)',
    borderLight: 'rgba(99, 102, 241, 0.22)',
  },
  {
    step: '03',
    title: 'DEVELOPER RESOLUTION',
    description: 'Investigates, fixes & retests code',
    icon: Code2,
    accentColor: '#8b5cf6',
    bgLight: 'rgba(139, 92, 246, 0.07)',
    borderLight: 'rgba(139, 92, 246, 0.22)',
  },
  {
    step: '04',
    title: 'RESOLUTION / REVIEW',
    description: 'Submits completed work for review',
    icon: Send,
    accentColor: '#06b6d4',
    bgLight: 'rgba(6, 182, 212, 0.07)',
    borderLight: 'rgba(6, 182, 212, 0.22)',
  },
  {
    step: '05',
    title: 'ADMIN / USER VERIFICATION',
    description: 'Verifies fix, approves or requests rework',
    icon: CheckCheck,
    accentColor: '#10b981',
    bgLight: 'rgba(16, 185, 129, 0.07)',
    borderLight: 'rgba(16, 185, 129, 0.22)',
  },
];

export const TracePilotWorkflowStepper: React.FC = () => {
  return (
    <section
      className="card tp-workflow-card"
      style={{
        marginBottom: '1.75rem',
        padding: '1rem 1.25rem',
        borderRadius: '12px',
        backgroundColor: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      aria-label="TracePilot Defect Resolution Workflow"
    >
      <style>{`
        .tp-stepper-row {
          display: flex;
          align-items: stretch;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }
        .tp-step-item {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          padding: 0.75rem 0.85rem;
          border-radius: 9px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .tp-step-item:hover {
          transform: translateY(-1px);
        }
        .tp-connector-h {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted, #94a3b8);
          flex-shrink: 0;
          padding: 0 0.15rem;
        }
        .tp-connector-v {
          display: none;
        }
        @media (max-width: 900px) {
          .tp-stepper-row {
            flex-direction: column;
            gap: 0.35rem;
          }
          .tp-connector-h {
            display: none;
          }
          .tp-connector-v {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted, #94a3b8);
            height: 14px;
          }
          .tp-step-item {
            flex-direction: row;
            align-items: center;
            gap: 0.75rem;
            padding: 0.6rem 0.85rem;
          }
          .tp-step-header {
            margin-bottom: 0 !important;
            flex-shrink: 0;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--primary-color, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GitBranch size={15} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--text-primary, #0f172a)',
                letterSpacing: '-0.01em',
              }}
            >
              TracePilot Defect Resolution Workflow
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '0.75rem',
                color: 'var(--text-muted, #64748b)',
              }}
            >
              From defect reporting to verified resolution
            </p>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '0.18rem 0.55rem',
            borderRadius: '999px',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            color: 'var(--primary-color, #6366f1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          5-Stage Lifecycle
        </span>
      </div>

      {/* Horizontal / Vertical Stepper Container */}
      <div className="tp-stepper-row">
        {WORKFLOW_STEPS.map((step, idx) => {
          const IconComp = step.icon;
          const isLast = idx === WORKFLOW_STEPS.length - 1;

          return (
            <React.Fragment key={step.step}>
              <div
                className="tp-step-item"
                style={{
                  backgroundColor: step.bgLight,
                  border: `1px solid ${step.borderLight}`,
                }}
              >
                {/* Step Top Row: Number pill + Icon */}
                <div
                  className="tp-step-header"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.45rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: step.accentColor,
                      letterSpacing: '0.04em',
                    }}
                  >
                    STEP {step.step}
                  </span>
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: step.accentColor,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                  >
                    <IconComp size={13} />
                  </div>
                </div>

                {/* Step Content: Title & Short Description */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--text-primary, #0f172a)',
                      letterSpacing: '0.02em',
                      lineHeight: 1.25,
                      marginBottom: '0.2rem',
                    }}
                  >
                    {step.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary, #475569)',
                      lineHeight: 1.35,
                    }}
                  >
                    {step.description}
                  </div>
                </div>
              </div>

              {/* Inter-step connector arrows */}
              {!isLast && (
                <>
                  <div className="tp-connector-h">
                    <ArrowRight size={14} />
                  </div>
                  <div className="tp-connector-v">
                    <ArrowDown size={12} />
                  </div>
                </>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
};

export default TracePilotWorkflowStepper;
