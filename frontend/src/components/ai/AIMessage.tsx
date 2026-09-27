/**
 * AIMessage – renders a single chat message (user or AI).
 *
 * AI messages support lightweight markdown rendering without any extra library:
 *   - **bold**
 *   - `inline code`
 *   - ```code blocks```
 *   - ## headings
 *   - bullet lists (- / *)
 *   - numbered lists (1.)
 *   - horizontal rules (---)
 *   - line breaks
 */
import React, { useMemo } from 'react';
import { AlertCircle, Bot, RefreshCw, User } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

interface AIMessageProps {
  message: ChatMessage;
  onRetry?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight markdown → React elements
// ─────────────────────────────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let keyCounter = 0;
  const nextKey = () => `md-${keyCounter++}`;

  const flushCode = () => {
    if (codeLines.length > 0) {
      elements.push(
        <pre
          key={nextKey()}
          style={{
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid var(--border-muted)',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            overflowX: 'auto',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            color: '#a5f3fc',
            margin: '0.5rem 0',
            lineHeight: 1.5,
          }}
        >
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
    }
    codeLines = [];
    inCodeBlock = false;
  };

  const renderInline = (raw: string, key: string): React.ReactNode => {
    // Process bold **text**, inline code `code`
    const parts: React.ReactNode[] = [];
    let remaining = raw;
    let partKey = 0;

    while (remaining.length > 0) {
      const boldIdx = remaining.indexOf('**');
      const codeIdx = remaining.indexOf('`');

      if (boldIdx === -1 && codeIdx === -1) {
        parts.push(<span key={`${key}-${partKey++}`}>{remaining}</span>);
        break;
      }

      const nextSpecial =
        boldIdx === -1 ? codeIdx : codeIdx === -1 ? boldIdx : Math.min(boldIdx, codeIdx);

      if (nextSpecial > 0) {
        parts.push(
          <span key={`${key}-${partKey++}`}>{remaining.slice(0, nextSpecial)}</span>,
        );
        remaining = remaining.slice(nextSpecial);
        continue;
      }

      if (remaining.startsWith('**')) {
        const endIdx = remaining.indexOf('**', 2);
        if (endIdx !== -1) {
          parts.push(
            <strong
              key={`${key}-${partKey++}`}
              style={{ color: 'var(--text-primary)', fontWeight: 700 }}
            >
              {remaining.slice(2, endIdx)}
            </strong>,
          );
          remaining = remaining.slice(endIdx + 2);
          continue;
        }
      }

      if (remaining.startsWith('`')) {
        const endIdx = remaining.indexOf('`', 1);
        if (endIdx !== -1) {
          parts.push(
            <code
              key={`${key}-${partKey++}`}
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid var(--border-muted)',
                borderRadius: '3px',
                padding: '0.1rem 0.35rem',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                color: '#a5f3fc',
              }}
            >
              {remaining.slice(1, endIdx)}
            </code>,
          );
          remaining = remaining.slice(endIdx + 1);
          continue;
        }
      }

      // No valid pair found — treat char as literal
      parts.push(<span key={`${key}-${partKey++}`}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }

    return <>{parts}</>;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block fence
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCode();
      } else {
        inCodeBlock = true;
        // code-fence language tag captured but not yet used for syntax highlighting
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Heading ##
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})/)?.[1].length ?? 2;
      const content = line.replace(/^#{1,3}\s+/, '');
      elements.push(
        <p
          key={nextKey()}
          style={{
            fontSize: level === 1 ? '1rem' : level === 2 ? '0.92rem' : '0.88rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0.65rem 0 0.2rem 0',
          }}
        >
          {renderInline(content, `h${level}-${i}`)}
        </p>,
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      elements.push(
        <hr
          key={nextKey()}
          style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '0.5rem 0' }}
        />,
      );
      continue;
    }

    // Bullet list
    if (/^(\s*[-*])\s/.test(line)) {
      const content = line.replace(/^\s*[-*]\s+/, '');
      const indent = (line.match(/^(\s+)/)?.[1].length ?? 0) > 0;
      elements.push(
        <div
          key={nextKey()}
          style={{
            display: 'flex',
            gap: '0.5rem',
            margin: '0.1rem 0',
            paddingLeft: indent ? '1.5rem' : '0.5rem',
          }}
        >
          <span style={{ color: '#818cf8', flexShrink: 0, marginTop: '0.05rem' }}>•</span>
          <span style={{ fontSize: '0.875rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
            {renderInline(content, `bullet-${i}`)}
          </span>
        </div>,
      );
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^(\s*\d+)\.\s(.*)/);
    if (numberedMatch) {
      const num = numberedMatch[1].trim();
      const content = numberedMatch[2];
      const indent = (line.match(/^(\s+)/)?.[1].length ?? 0) > 0;
      elements.push(
        <div
          key={nextKey()}
          style={{
            display: 'flex',
            gap: '0.5rem',
            margin: '0.1rem 0',
            paddingLeft: indent ? '1.5rem' : '0.5rem',
          }}
        >
          <span
            style={{
              color: '#818cf8',
              flexShrink: 0,
              fontWeight: 600,
              fontSize: '0.8rem',
              minWidth: '1.4rem',
            }}
          >
            {num}.
          </span>
          <span style={{ fontSize: '0.875rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
            {renderInline(content, `num-${i}`)}
          </span>
        </div>,
      );
      continue;
    }

    // Empty line → spacer
    if (line.trim() === '') {
      elements.push(<div key={nextKey()} style={{ height: '0.35rem' }} />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p
        key={nextKey()}
        style={{
          fontSize: '0.875rem',
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
          margin: '0.1rem 0',
        }}
      >
        {renderInline(line, `p-${i}`)}
      </p>,
    );
  }

  if (inCodeBlock) flushCode();

  return elements;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const AIMessage: React.FC<AIMessageProps> = ({ message, onRetry }) => {
  const isUser = message.role === 'user';
  const rendered = useMemo(
    () => (isUser ? null : renderMarkdown(message.content)),
    [isUser, message.content],
  );

  const timeStr = message.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.3rem 0.1rem',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: isUser
            ? 'rgba(16,185,129,0.18)'
            : 'rgba(99,102,241,0.18)',
          border: isUser
            ? '1px solid rgba(16,185,129,0.35)'
            : '1px solid rgba(99,102,241,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        {isUser ? (
          <User size={13} color="#34d399" />
        ) : (
          <Bot size={13} color="#818cf8" />
        )}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '86%', minWidth: '80px' }}>
        <div
          style={{
            padding: '0.6rem 0.9rem',
            borderRadius: isUser ? '8px 0 8px 8px' : '0 8px 8px 8px',
            background: isUser
              ? 'rgba(16,185,129,0.1)'
              : message.isError
              ? 'rgba(239,68,68,0.08)'
              : 'var(--bg-surface-elevated)',
            border: isUser
              ? '1px solid rgba(16,185,129,0.25)'
              : message.isError
              ? '1px solid rgba(239,68,68,0.25)'
              : '1px solid var(--border-subtle)',
          }}
        >
          {isUser ? (
            <p
              style={{
                fontSize: '0.875rem',
                lineHeight: 1.55,
                color: 'var(--text-primary)',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.content}
            </p>
          ) : message.isError ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p
                  style={{
                    fontSize: '0.875rem',
                    lineHeight: 1.55,
                    color: '#f87171',
                    margin: 0,
                  }}
                >
                  {message.content}
                </p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    style={{
                      marginTop: '0.5rem',
                      background: 'none',
                      border: '1px solid rgba(239,68,68,0.4)',
                      borderRadius: '4px',
                      padding: '0.2rem 0.55rem',
                      fontSize: '0.75rem',
                      color: '#f87171',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <RefreshCw size={11} /> Retry
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>{rendered}</div>
          )}
        </div>

        {/* Timestamp */}
        <span
          style={{
            display: 'block',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            marginTop: '0.2rem',
            textAlign: isUser ? 'right' : 'left',
            paddingLeft: isUser ? 0 : '0.15rem',
            paddingRight: isUser ? '0.15rem' : 0,
          }}
        >
          {timeStr}
        </span>
      </div>
    </div>
  );
};
