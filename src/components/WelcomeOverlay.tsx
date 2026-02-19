'use client';

import { useEffect, useState } from 'react';
import { colors, effects, animation } from '@/lib/design-tokens';

const STORAGE_KEY = 'projectloom:welcome-dismissed';

// =============================================================================
// WELCOME OVERLAY
// =============================================================================

/**
 * One-time welcome card shown on first visit.
 * Dismissed permanently via localStorage — never shown again after that.
 */
export function WelcomeOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Short delay so the canvas renders first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={styles.backdrop} onClick={dismiss}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.badge}>Welcome</div>

        <h1 style={styles.heading}>Branching AI conversations,<br />on an infinite canvas.</h1>

        <p style={styles.body}>
          Each card is a conversation thread. Branch any message to explore a different angle,
          merge threads together, and build up a map of your thinking — all without losing context.
        </p>

        <p style={styles.hint}>
          You&rsquo;re looking at a live example canvas. Add your API keys to start chatting.
        </p>

        <div style={styles.actions}>
          <button style={styles.primaryBtn} onClick={dismiss}>
            Get started →
          </button>
          <button style={styles.secondaryBtn} onClick={dismiss}>
            Just explore for now
          </button>
        </div>

        <p style={styles.byok}>
          BYOK — your Anthropic or OpenAI key, stored only in your browser.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000,
    padding: '16px',
    animation: `fadeIn ${animation.duration.normal} ${animation.easing.smooth}`,
  },

  card: {
    backgroundColor: colors.bg.secondary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: '16px',
    boxShadow: effects.shadow.cardExpanded,
    padding: '40px 44px',
    maxWidth: '520px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    animation: `slideUp ${animation.duration.normal} ${animation.easing.smooth}`,
  },

  badge: {
    display: 'inline-block',
    alignSelf: 'flex-start',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: colors.accent.primary,
    backgroundColor: colors.accent.muted,
    border: `1px solid ${colors.accent.muted}`,
    borderRadius: '6px',
    padding: '3px 10px',
  },

  heading: {
    fontSize: '22px',
    fontWeight: 600,
    lineHeight: 1.3,
    color: colors.fg.primary,
    margin: 0,
  },

  body: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: colors.fg.secondary,
    margin: 0,
  },

  hint: {
    fontSize: '13px',
    lineHeight: 1.5,
    color: colors.fg.tertiary,
    margin: 0,
    padding: '12px 14px',
    backgroundColor: colors.bg.inset,
    border: `1px solid ${colors.border.muted}`,
    borderRadius: '8px',
  },

  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
    marginTop: '4px',
  },

  primaryBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: colors.accent.primary,
    color: colors.accent.contrast,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: `opacity ${animation.duration.fast} ease`,
  },

  secondaryBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: `1px solid ${colors.border.default}`,
    backgroundColor: 'transparent',
    color: colors.fg.secondary,
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: `background-color ${animation.duration.fast} ease`,
  },

  byok: {
    fontSize: '12px',
    color: colors.fg.quaternary,
    margin: 0,
    textAlign: 'center' as const,
  },
};
