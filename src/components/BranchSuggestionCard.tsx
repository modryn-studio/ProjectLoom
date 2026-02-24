/**
 * Branch Suggestion Card
 *
 * Inline component rendered at the bottom of MessageThread when the AI
 * classifier detects a genuine decision fork. Shows branch titles with
 * a CTA to open all branches, or dismiss.
 *
 * Design: accent-muted background, branch icons, distinct from AI messages.
 * Appears with a gentle spring animation to draw attention without jarring.
 *
 * @version 1.0.0
 */

'use client';

import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, X, ArrowRight } from 'lucide-react';
import { colors, typography, spacing, effects, animation } from '@/lib/design-tokens';
import { useCanvasStore } from '@/stores/canvas-store';
import { useBranchSuggestionStore } from '@/stores/branch-suggestion-store';
import type { BranchSuggestion } from '@/stores/branch-suggestion-store';
import { track } from '@/lib/analytics';

// =============================================================================
// TYPES
// =============================================================================

interface BranchSuggestionCardProps {
  conversationId: string;
  messageIndex: number;
  branches: BranchSuggestion[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export const BranchSuggestionCard = memo(function BranchSuggestionCard({
  conversationId,
  messageIndex,
  branches,
}: BranchSuggestionCardProps) {
  const branchFromMessage = useCanvasStore((s) => s.branchFromMessage);
  const openChatPanel = useCanvasStore((s) => s.openChatPanel);
  const requestFocusNode = useCanvasStore((s) => s.requestFocusNode);
  const setDraftMessage = useCanvasStore((s) => s.setDraftMessage);
  const clearSuggestion = useBranchSuggestionStore((s) => s.clearSuggestion);

  const handleAccept = useCallback(() => {
    // Create all branch cards
    const createdIds: string[] = [];
    for (const branch of branches) {
      const newConversation = branchFromMessage({
        sourceCardId: conversationId,
        messageIndex,
        branchReason: branch.title,
      });

      if (newConversation) {
        createdIds.push(newConversation.id);

        // Pre-fill the seed prompt as a draft so the user sees it ready to send
        setDraftMessage(newConversation.id, branch.seedPrompt);
      }
    }

    // Focus the first created branch
    if (createdIds.length > 0) {
      openChatPanel(createdIds[0]);
      requestFocusNode(createdIds[0]);
    }

    // Clear the suggestion
    clearSuggestion(conversationId);

    // Track
    track('branch_suggestion_accepted', {
      branchCount: branches.length,
    });
  }, [branches, branchFromMessage, conversationId, messageIndex, openChatPanel, requestFocusNode, setDraftMessage, clearSuggestion]);

  const handleDismiss = useCallback(() => {
    clearSuggestion(conversationId);
    track('branch_suggestion_dismissed', {
      branchCount: branches.length,
    });
  }, [clearSuggestion, conversationId, branches.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ ...animation.spring.gentle, duration: 0.3 }}
      style={styles.container}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        style={styles.dismissBtn}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = colors.fg.primary;
          e.currentTarget.style.backgroundColor = colors.bg.inset;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = colors.fg.quaternary;
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        aria-label="Dismiss branch suggestion"
      >
        <X size={14} />
      </button>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.iconWrap}>
          <GitBranch size={16} />
        </div>
        <span style={styles.headerText}>
          {branches.length === 2
            ? 'Two paths worth exploring separately'
            : `${branches.length} paths worth exploring separately`}
        </span>
      </div>

      {/* Branch list */}
      <div style={styles.branchList}>
        {branches.map((branch, i) => (
          <div key={i} style={styles.branchItem}>
            <span style={styles.branchLabel}>{String.fromCharCode(65 + i)}</span>
            <div style={styles.branchText}>
              <span style={styles.branchTitle}>{branch.title}</span>
              <span style={styles.branchSeed}>{branch.seedPrompt}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <motion.button
          onClick={handleAccept}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={styles.acceptBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.accent.secondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.accent.primary;
          }}
        >
          Open {branches.length === 2 ? 'both' : 'all'} branches
          <ArrowRight size={14} style={{ marginLeft: 6 }} />
        </motion.button>
        <button
          onClick={handleDismiss}
          style={styles.notNowBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = colors.fg.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.fg.tertiary;
          }}
        >
          Not now
        </button>
      </div>
    </motion.div>
  );
});

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    margin: `${spacing[3]} ${spacing[4]}`,
    padding: `${spacing[4]} ${spacing[4]} ${spacing[3]}`,
    backgroundColor: colors.accent.muted,
    border: `1px solid ${colors.accent.emphasis}`,
    borderRadius: effects.border.radius.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[3],
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'transparent',
    border: 'none',
    color: colors.fg.quaternary,
    cursor: 'pointer',
    padding: 4,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    paddingRight: spacing[4],
  },
  iconWrap: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.accent.primary,
    color: colors.accent.contrast,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.heading,
    letterSpacing: '-0.01em',
    color: colors.fg.primary,
  },
  branchList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
  },
  branchItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[3]}`,
    backgroundColor: colors.bg.primary,
    border: `1px solid ${colors.border.muted}`,
    borderRadius: effects.border.radius.md,
  },
  branchLabel: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: '50%',
    backgroundColor: colors.accent.muted,
    color: colors.accent.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.code,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  branchText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  branchTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    fontFamily: typography.fonts.body,
    color: colors.fg.primary,
  },
  branchSeed: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
    color: colors.fg.tertiary,
    lineHeight: typography.lineHeights.comfortable,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    paddingTop: spacing[1],
  },
  acceptBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing[2]} ${spacing[4]}`,
    backgroundColor: colors.accent.primary,
    color: colors.accent.contrast,
    border: 'none',
    borderRadius: effects.border.radius.md,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    fontFamily: typography.fonts.body,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  notNowBtn: {
    background: 'transparent',
    border: 'none',
    color: colors.fg.tertiary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    cursor: 'pointer',
    padding: `${spacing[2]} ${spacing[2]}`,
    transition: 'color 0.15s ease',
  },
};
