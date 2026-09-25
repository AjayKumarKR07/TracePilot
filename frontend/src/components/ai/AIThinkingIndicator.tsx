/**
 * AIThinkingIndicator – animated dots shown while AI is generating a response.
 * Uses existing TracePilot CSS variables; no extra dependencies.
 */
import React from 'react';
import { Bot } from 'lucide-react';

export const AIThinkingIndicator: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.6rem',
      padding: '0.75rem 0.25rem',
    }}
  >
    {/* Avatar */}
    <div
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: 'rgba(99,102,241,0.18)',
        border: '1px solid rgba(99,102,241,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Bot size={14} color="#818cf8" />
    </div>

    {/* Dots */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.55rem 0.85rem',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '0 8px 8px 8px',
        minHeight: '36px',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#818cf8',
            display: 'inline-block',
            animation: `ai-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes ai-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  </div>
);
