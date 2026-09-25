/**
 * AIChatbot – main AI Testing Assistant panel for the TracePilot Tester Dashboard.
 *
 * Features:
 * - Conversation history (frontend-managed, sent with each request)
 * - Issue and sprint context awareness
 * - Loading/error/retry states
 * - Auto-scroll to latest message
 * - Clear conversation
 * - Markdown rendering via AIMessage
 * - Quick action buttons
 * - AI service health check on mount
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { aiApi } from '../../api/ai';
import type { ConversationMessage } from '../../api/ai';
import { getApiErrorMessage } from '../../api/client';
import { AIInput } from './AIInput';
import { AIMessage } from './AIMessage';
import type { ChatMessage } from './AIMessage';
import { AIQuickActions } from './AIQuickActions';
import { AIThinkingIndicator } from './AIThinkingIndicator';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AIChatbotProps {
  /** Optional issue ID — used to automatically add context to AI requests */
  contextIssueId?: number;
  /** Optional issue key displayed in quick action messages */
  contextIssueKey?: string;
  /** Optional sprint ID — used to automatically add context to AI requests */
  contextSprintId?: number;
  /** Optional sprint name displayed in quick action messages */
  contextSprintName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let _msgCounter = 0;
function generateId() {
  return `msg-${Date.now()}-${_msgCounter++}`;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `## Welcome to TracePilot AI 👋

I'm your AI Testing Assistant, here to help you with:

- **Defect analysis** — understanding bugs and their root causes
- **Test case generation** — positive, negative, boundary & regression cases
- **Reproduction steps** — detailed, step-by-step guides
- **Sprint summaries** — analysis of sprint health and risks
- **QA best practices** — general testing guidance

Use the **Quick Actions** below to get started, or type your own question.

> *I am advisory only. Any actions recommended must be performed through the TracePilot UI.*`,
  timestamp: new Date(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const AIChatbot: React.FC<AIChatbotProps> = ({
  contextIssueId,
  contextIssueKey,
  contextSprintId,
  contextSprintName,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Check AI availability on mount
  useEffect(() => {
    aiApi.health()
      .then((health) => setAiAvailable(health.status === 'available'))
      .catch(() => setAiAvailable(false));
  }, []);

  // Build conversation history for backend (exclude welcome message)
  const buildHistory = useCallback((): ConversationMessage[] => {
    const MAX_HISTORY = 14; // 7 exchanges
    const relevant = messages
      .filter((m) => m.id !== 'welcome' && !m.isError)
      .slice(-MAX_HISTORY);
    return relevant.map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  // Core send function
  const sendMessage = useCallback(
    async (messageText: string) => {
      const trimmed = messageText.trim();
      if (!trimmed || isLoading) return;

      setLastUserMessage(trimmed);

      // Add user bubble immediately
      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');
      setIsLoading(true);

      try {
        const history = buildHistory();

        const response = await aiApi.chat({
          message: trimmed,
          conversation_id: conversationId,
          issue_id: contextIssueId,
          sprint_id: contextSprintId,
          conversation: history,
        });

        // Persist conversation ID for continuity
        if (response.conversation_id) {
          setConversationId(response.conversation_id);
        }

        const aiMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
          isError: !response.success,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const errorText = getApiErrorMessage(err);
        const errMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `AI service is temporarily unavailable. ${errorText}`,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, buildHistory, conversationId, contextIssueId, contextSprintId],
  );

  const handleSend = useCallback(() => {
    sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  const handleQuickAction = useCallback(
    (message: string) => {
      setInputValue(message);
    },
    [],
  );

  const handleRetry = useCallback(() => {
    if (lastUserMessage) {
      // Remove the last error message first
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.isError) return prev.slice(0, -1);
        return prev;
      });
      sendMessage(lastUserMessage);
    }
  }, [lastUserMessage, sendMessage]);

  const handleClear = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setConversationId(undefined);
    setLastUserMessage('');
    setInputValue('');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <section
      className="card"
      style={{
        border: '1px solid rgba(99,102,241,0.3)',
        padding: '0',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.9rem 1.15rem',
          borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
          background: 'rgba(99,102,241,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'rgba(99,102,241,0.2)',
              border: '1px solid rgba(99,102,241,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bot size={15} color="#818cf8" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                AI Testing Assistant
              </h2>
              {/* Status dot */}
              {aiAvailable !== null && (
                <span
                  title={aiAvailable ? 'AI service available' : 'AI service unavailable'}
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: aiAvailable ? '#10b981' : '#ef4444',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
            <p
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                margin: 0,
              }}
            >
              {contextIssueKey
                ? `Context: ${contextIssueKey}`
                : contextSprintName
                ? `Context: ${contextSprintName}`
                : 'Ask anything about testing, defects, or sprints'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Powered by badge */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              padding: '0.15rem 0.5rem',
              border: '1px solid var(--border-subtle)',
              borderRadius: '999px',
              background: 'var(--bg-surface-elevated)',
            }}
          >
            <Sparkles size={9} /> Gemini
          </span>

          {/* Clear button */}
          {messages.length > 1 && (
            <button
              onClick={handleClear}
              title="Clear conversation"
              style={{
                background: 'none',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.5rem',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)';
                (e.currentTarget as HTMLElement).style.color = '#f87171';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }}
            >
              <Trash2 size={11} /> Clear
            </button>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setIsCollapsed((c) => !c)}
            title={isCollapsed ? 'Expand AI Assistant' : 'Collapse AI Assistant'}
            style={{
              background: 'none',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.25rem 0.4rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.12s ease',
            }}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* ── Body (collapsible) ── */}
      {!isCollapsed && (
        <div style={{ padding: '0.85rem 1.15rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Unavailable banner */}
          {aiAvailable === false && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 0.85rem',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                color: '#fbbf24',
              }}
            >
              <WifiOff size={14} />
              AI service is not configured or currently unavailable. Check backend
              environment variables (AI_ENABLED, GEMINI_API_KEY).
            </div>
          )}

          {/* Messages area */}
          <div
            id="ai-messages-area"
            style={{
              minHeight: '200px',
              maxHeight: '420px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              paddingRight: '0.25rem',
            }}
          >
            {messages.map((msg) => (
              <AIMessage
                key={msg.id}
                message={msg}
                onRetry={msg.isError ? handleRetry : undefined}
              />
            ))}
            {isLoading && <AIThinkingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <AIInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            isLoading={isLoading}
          />

          {/* Quick Actions */}
          <AIQuickActions
            onSelectAction={handleQuickAction}
            issueKey={contextIssueKey}
            sprintName={contextSprintName}
          />
        </div>
      )}
    </section>
  );
};
