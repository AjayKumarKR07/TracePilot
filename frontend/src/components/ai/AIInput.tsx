/**
 * AIInput – textarea + Send button for the AI chatbot.
 * - Enter to send, Shift+Enter for newline
 * - Disabled while AI is thinking
 * - Character count with soft limit warning
 */
import React, { useRef } from 'react';
import { Send } from 'lucide-react';

const MAX_CHARS = 4000;

interface AIInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  placeholder?: string;
}

export const AIInput: React.FC<AIInputProps> = ({
  value,
  onChange,
  onSend,
  isLoading,
  placeholder = 'Ask TracePilot AI anything about testing, defects, or sprints…',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSend();
      }
    }
  };

  const charCount = value.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isNearLimit = charCount > MAX_CHARS * 0.85;

  const canSend = value.trim().length > 0 && !isLoading && !isOverLimit;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: '0.75rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={textareaRef}
          id="ai-chat-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            padding: '0.6rem 0.85rem',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            background: 'var(--bg-input)',
            border: isOverLimit
              ? '1px solid rgba(239,68,68,0.5)'
              : '1px solid var(--border-muted)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            transition: 'border-color 0.15s ease',
            minHeight: '60px',
            maxHeight: '140px',
            overflowY: 'auto',
          }}
          onFocus={(e) => {
            if (!isOverLimit) {
              e.target.style.borderColor = 'rgba(99,102,241,0.6)';
            }
          }}
          onBlur={(e) => {
            e.target.style.borderColor = isOverLimit
              ? 'rgba(239,68,68,0.5)'
              : 'var(--border-muted)';
          }}
        />

        <button
          onClick={onSend}
          disabled={!canSend}
          title="Send message (Enter)"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: canSend ? 'var(--primary)' : 'var(--bg-surface-elevated)',
            color: canSend ? '#fff' : 'var(--text-muted)',
            cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s ease, transform 0.1s ease',
          }}
          onMouseDown={(e) => {
            if (canSend) (e.currentTarget as HTMLElement).style.transform = 'scale(0.93)';
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          <Send size={15} />
        </button>
      </div>

      {/* Helper row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Enter to send · Shift+Enter for new line
        </span>
        <span
          style={{
            fontSize: '0.7rem',
            color: isOverLimit ? '#f87171' : isNearLimit ? '#fbbf24' : 'var(--text-muted)',
          }}
        >
          {charCount}/{MAX_CHARS}
        </span>
      </div>
    </div>
  );
};
