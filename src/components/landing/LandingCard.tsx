'use client';

import React from 'react';
import { motion, type TargetAndTransition, type VariantLabels, type Transition } from 'framer-motion';
import { GitBranch } from 'lucide-react';
import { colors, typography, spacing, effects, card } from '@/lib/design-tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface LandingCardData {
  title: string;
  preview: string;
  timestamp: string;
  isBranch?: boolean;
}

interface LandingCardProps {
  data: LandingCardData;
  style?: React.CSSProperties;
  /** Framer Motion animation variants */
  initial?: TargetAndTransition | VariantLabels | boolean;
  animate?: TargetAndTransition | VariantLabels | boolean;
  exit?: TargetAndTransition | VariantLabels;
  transition?: Transition;
}

// =============================================================================
// LANDING CARD COMPONENT
// =============================================================================

/**
 * Read-only card that exactly replicates ConversationCard's collapsed visual:
 * same dimensions (280 × 160), same DOM structure, same design tokens.
 * No React Flow handles, no Zustand, no interactivity.
 */
export function LandingCard({ data, style, initial, animate, exit, transition }: LandingCardProps) {
  const borderStyle: React.CSSProperties = data.isBranch
    ? { borderColor: colors.accent.emphasis, borderWidth: 2, boxShadow: effects.shadow.card }
    : {};

  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
      style={{ ...cardStyles.container, ...borderStyle, ...style }}
    >
      {/* Header: icon + title */}
      <div style={cardStyles.header}>
        {data.isBranch && (
          <span style={cardStyles.branchIcon}>
            <GitBranch size={14} color={colors.accent.emphasis} />
          </span>
        )}
        <h3 style={cardStyles.title}>{data.title}</h3>
      </div>

      {/* Content: preview text */}
      <div style={cardStyles.content}>
        <div style={cardStyles.preview}>
          <p style={cardStyles.previewText}>{data.preview}</p>
        </div>
      </div>

      {/* Footer: timestamp */}
      <div style={cardStyles.footer}>
        <span style={cardStyles.timestamp}>{data.timestamp}</span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// STYLES — mirrors cardStyles in ConversationCard.tsx exactly
// =============================================================================

const cardStyles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: colors.bg.secondary,
    borderRadius: effects.border.radius.md,   // 12px
    border: `1px solid ${colors.border.default}`,
    padding: spacing.card.padding,            // 16px
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.card.gap,                    // 12px
    width: card.size.minWidth,               // 280px
    height: card.size.collapsedHeight,       // 160px
    boxSizing: 'border-box',
    pointerEvents: 'none',
    userSelect: 'none',
    // lifted shadow like the real card hover state
    boxShadow: effects.shadow.card,
  },

  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],                          // 8px
  },

  branchIcon: {
    display: 'flex',
    alignItems: 'center',
    marginRight: spacing[1],                  // 4px
    flexShrink: 0,
  },

  title: {
    fontSize: typography.sizes.base,          // 1rem
    fontWeight: typography.weights.semibold,  // 600
    color: 'var(--fg-primary)',
    fontFamily: typography.fonts.heading,
    margin: 0,
    lineHeight: 1.3,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    flex: 1,
  },

  content: {
    flex: 1,
    overflow: 'hidden',
    minHeight: '40px',
  },

  preview: {
    paddingTop: spacing[2],                   // 8px
    paddingBottom: spacing[1],               // 4px
  },

  previewText: {
    fontSize: typography.sizes.sm,            // 0.875rem
    color: 'var(--fg-secondary)',
    lineHeight: 1.5,
    margin: 0,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  },

  footer: {
    marginTop: 'auto',
  },

  timestamp: {
    fontSize: typography.sizes.xs,            // 0.75rem
    color: colors.fg.tertiary,
    fontFamily: typography.fonts.body,
  },
};
