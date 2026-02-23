'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { typography, spacing, effects } from '@/lib/design-tokens';

// =============================================================================
// CYCLING MESSAGE DATA
// =============================================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** Each "step" is a user prompt + assistant reply that cycles in the panel */
const CHAT_STEPS: ChatMessage[][] = [
  [
    { role: 'user', text: 'Should I build a SaaS tool for tracking MRR?' },
    { role: 'assistant', text: 'If you use it yourself, that\'s a strong signal. The indie hacker market is small but loyal — ship a focused MVP and charge from day one.' },
  ],
  [
    { role: 'user', text: 'What tech stack should I use for the MVP?' },
    { role: 'assistant', text: 'Next.js + Stripe + Postgres. Keep it simple — a single table for subscriptions and a chart. Avoid over-engineering until you have 10 paying users.' },
  ],
  [
    { role: 'user', text: 'Where do I find my first users?' },
    { role: 'assistant', text: 'Indie Hackers, r/SideProject, and X. Share your build process openly — people root for makers who ship in public.' },
  ],
  [
    { role: 'user', text: 'Combine the build plan with validation feedback' },
    { role: 'assistant', text: 'Build a lightweight MVP in two weeks, but validate in parallel — collect 10 emails before launch, then iterate based on real usage patterns.' },
  ],
];

// =============================================================================
// LANDING CHAT PANEL COMPONENT
// =============================================================================

interface LandingChatPanelProps {
  /** Width in the ScaledStage coordinate space */
  width: number;
  /** Height in the ScaledStage coordinate space */
  height: number;
  /** x position in the ScaledStage coordinate space */
  x: number;
  /** y position in the ScaledStage coordinate space */
  y: number;
  /** Whether the panel should be visible (for fade-out sync) */
  visible?: boolean;
  /** Controlled chat step index (0-3) synchronized to canvas phases */
  messageIndex?: number;
}

export function LandingChatPanel({ width, height, x, y, visible = true, messageIndex = 0 }: LandingChatPanelProps) {
  const safeIndex = Math.max(0, Math.min(messageIndex, CHAT_STEPS.length - 1));
  const messages = CHAT_STEPS[safeIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: effects.border.radius.md,
        border: `1px solid var(--border-default)`,
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
        boxShadow: effects.shadow.card,
      }}
    >
      {/* ── Header ── */}
      <div style={panelStyles.header}>
        <span style={panelStyles.headerTitle}>Canvas Chat</span>
        <span style={panelStyles.headerClose}>
          <X size={14} color="var(--fg-tertiary)" />
        </span>
      </div>

      {/* ── Messages ── */}
      <div style={panelStyles.messageArea}>
        <AnimatePresence mode="wait">
          <motion.div
            key={safeIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  width: '100%',
                }}
              >
                <div
                  style={
                    msg.role === 'user'
                      ? panelStyles.userBubble
                      : panelStyles.assistantBubble
                  }
                >
                  <p style={panelStyles.messageText}>{msg.text}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Input stub ── */}
      <div style={panelStyles.inputArea}>
        <div style={panelStyles.inputSurface}>
          <span style={panelStyles.inputPlaceholder}>Type a message...</span>
          <span style={panelStyles.sendIcon}>
            <Send size={14} color="var(--accent-primary)" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const panelStyles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-secondary)',
    flexShrink: 0,
  },

  headerTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: 'var(--fg-primary)',
    fontFamily: typography.fonts.heading,
  },

  headerClose: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: effects.border.radius.sm,
    border: '1px solid var(--border-primary)',
  },

  messageArea: {
    flex: 1,
    overflow: 'hidden',
    padding: '12px 12px 8px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },

  userBubble: {
    backgroundColor: 'var(--bg-inset)',
    borderRadius: spacing.card.borderRadius,
    padding: '6px 10px',
    maxWidth: '80%',
    marginLeft: 'auto',
    width: 'fit-content',
  },

  assistantBubble: {
    padding: '4px 0',
    width: '100%',
  },

  messageText: {
    fontSize: typography.sizes.xs,
    lineHeight: 1.5,
    color: 'var(--fg-primary)',
    fontFamily: typography.fonts.body,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
  },

  inputArea: {
    padding: '6px 8px',
    borderTop: '1px solid var(--border-default)',
    flexShrink: 0,
  },

  inputSurface: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-default)',
    borderRadius: effects.border.radius.sm,
    padding: '6px 8px',
  },

  inputPlaceholder: {
    fontSize: typography.sizes.xs,
    color: 'var(--fg-tertiary)',
    fontFamily: typography.fonts.body,
  },

  sendIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
