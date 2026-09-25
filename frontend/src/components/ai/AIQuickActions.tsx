/**
 * AIQuickActions – a row of quick-access prompt buttons for the AI chatbot.
 *
 * Each button populates the chat input (and optionally fires the request
 * immediately) with a pre-built prompt, using the selected issue/sprint
 * context when available.
 */
import React from 'react';
import {
  AlertTriangle,
  Bug,
  ClipboardList,
  Code2,
  Layers,
  RotateCcw,
  SearchCode,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  buildMessage: (issueKey?: string, sprintName?: string) => string;
  /** If true, fires the request immediately instead of just pre-filling */
  autoSend?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'analyze-issue',
    label: 'Analyze Issue',
    icon: <Bug size={13} />,
    buildMessage: (key) =>
      key
        ? `Please analyze defect ${key} and provide your assessment of the root cause, test scenarios, and edge cases.`
        : 'Please analyze this defect and provide your assessment of the root cause, test scenarios, and edge cases.',
    autoSend: false,
  },
  {
    id: 'test-cases',
    label: 'Generate Test Cases',
    icon: <ClipboardList size={13} />,
    buildMessage: (key) =>
      key
        ? `Generate comprehensive test cases for defect ${key}, including positive, negative, boundary, and regression cases.`
        : 'Generate comprehensive test cases for this defect, including positive, negative, boundary, and regression cases.',
    autoSend: false,
  },
  {
    id: 'repro-steps',
    label: 'Reproduction Steps',
    icon: <RotateCcw size={13} />,
    buildMessage: (key) =>
      key
        ? `Provide detailed step-by-step reproduction steps for defect ${key}, including preconditions and evidence to collect.`
        : 'Provide detailed step-by-step reproduction steps for this defect, including preconditions and evidence to collect.',
    autoSend: false,
  },
  {
    id: 'root-cause',
    label: 'Root Cause',
    icon: <SearchCode size={13} />,
    buildMessage: (key) =>
      key
        ? `Perform root cause analysis for defect ${key}. List possible causes, affected layers, and investigation steps.`
        : 'Perform root cause analysis for this defect. List possible causes, affected layers, and investigation steps.',
    autoSend: false,
  },
  {
    id: 'sprint-summary',
    label: 'Sprint Summary',
    icon: <Layers size={13} />,
    buildMessage: (_, sprintName) =>
      sprintName
        ? `Summarize the current state of sprint "${sprintName}", highlight risks, and recommend testing focus areas.`
        : 'Summarize the current sprint, highlight risks, and recommend testing focus areas.',
    autoSend: false,
  },
  {
    id: 'defect-trend',
    label: 'Defect Trend',
    icon: <TrendingUp size={13} />,
    buildMessage: () =>
      'Explain what the current defect trend means for this sprint and the overall project quality.',
    autoSend: false,
  },
  {
    id: 'debug-api',
    label: 'Debug API',
    icon: <Code2 size={13} />,
    buildMessage: () =>
      'Help me debug an API issue. I will describe the problem and you can guide me through the investigation.',
    autoSend: false,
  },
  {
    id: 'regression',
    label: 'Regression Test',
    icon: <Sparkles size={13} />,
    buildMessage: (key) =>
      key
        ? `Help me write a regression test strategy for defect ${key} to ensure the fix does not break existing functionality.`
        : 'Help me write a regression test strategy to ensure recent fixes do not break existing functionality.',
    autoSend: false,
  },
  {
    id: 'severity-priority',
    label: 'Severity & Priority',
    icon: <AlertTriangle size={13} />,
    buildMessage: (key) =>
      key
        ? `Explain the recommended severity and priority classification for defect ${key} and justify the reasoning.`
        : 'Explain how to correctly classify defect severity and priority, and provide reasoning for this defect.',
    autoSend: false,
  },
];

interface AIQuickActionsProps {
  onSelectAction: (message: string) => void;
  issueKey?: string;
  sprintName?: string;
}

export const AIQuickActions: React.FC<AIQuickActionsProps> = ({
  onSelectAction,
  issueKey,
  sprintName,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.4rem',
        paddingTop: '0.5rem',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <span
        style={{
          width: '100%',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          fontWeight: 500,
          marginBottom: '0.15rem',
        }}
      >
        Quick Actions
      </span>

      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.id}
          onClick={() => onSelectAction(action.buildMessage(issueKey, sprintName))}
          title={action.buildMessage(issueKey, sprintName)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.65rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-elevated)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.12s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.5)';
            (e.currentTarget as HTMLElement).style.color = '#818cf8';
            (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface-elevated)';
          }}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
};
