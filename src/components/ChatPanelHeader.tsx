'use client';

import React, { useCallback, memo } from 'react';
import { X, GitBranch, Zap, Maximize2 } from 'lucide-react';

import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { useCanvasStore } from '@/stores/canvas-store';
import { usePreferencesStore, selectBranchingPreferences } from '@/stores/preferences-store';
import type { Conversation } from '@/types';

// =============================================================================
// CHAT PANEL HEADER COMPONENT
// =============================================================================

interface ChatPanelHeaderProps {
  conversation: Conversation;
  onClose: () => void;
  onMaximize?: () => void;
}

export const ChatPanelHeader = memo(function ChatPanelHeader({ 
  conversation, 
  onClose,
  onMaximize,
}: ChatPanelHeaderProps) {
  const openBranchDialog = useCanvasStore((s) => s.openBranchDialog);
  const branchFromMessage = useCanvasStore((s) => s.branchFromMessage);
  const branchingPrefs = usePreferencesStore(selectBranchingPreferences);

  // v4: Detect merge and branch state for visual styling
  const isMergeNode = conversation.isMergeNode;
  const isBranchedCard = conversation.parentCardIds.length > 0 && !isMergeNode;
  const mergeSourceCount = isMergeNode ? conversation.parentCardIds.length : 0;
  const isComplexMerge = mergeSourceCount >= 3; // WARNING_THRESHOLD
  const isAtMaxMerge = mergeSourceCount >= 5; // MAX_PARENTS

  // Handle branch action
  const handleBranch = useCallback(() => {
    // Guard against undefined or empty content array
    const messageCount = Array.isArray(conversation.content) ? conversation.content.length : 0;
    if (messageCount === 0) return;

    if (branchingPrefs.alwaysAskOnBranch) {
      openBranchDialog(conversation.id);
    } else {
      branchFromMessage({
        sourceCardId: conversation.id,
        messageIndex: messageCount - 1,
        inheritanceMode: branchingPrefs.defaultInheritanceMode,
        branchReason: 'Quick branch',
      });
    }
  }, [conversation.id, conversation.content, openBranchDialog, branchFromMessage, branchingPrefs]);

  return (
    <div style={headerStyles.container}>
      {/* Left side: Title and indicators */}
      <div style={headerStyles.titleSection}>
        {/* Merge indicator icon */}
        {isMergeNode && (
          <span
            style={headerStyles.indicator}
            title={`Merged from ${mergeSourceCount} cards`}
          >
            <Zap 
              size={16} 
              color={isAtMaxMerge 
                ? colors.semantic.error 
                : isComplexMerge 
                  ? colors.semantic.warning 
                  : colors.semantic.success
              } 
            />
          </span>
        )}
        
        {/* Branch indicator icon */}
        {isBranchedCard && !isMergeNode && (
          <span style={headerStyles.indicator} title="Branched card">
            <GitBranch size={16} color={colors.accent.emphasis} />
          </span>
        )}

        <h2 style={headerStyles.title}>{conversation.metadata.title}</h2>
      </div>

      {/* Right side: Actions */}
      <div style={headerStyles.actions}>
        {/* Maximize button */}
        {onMaximize && (
          <button
            onClick={onMaximize}
            style={headerStyles.actionButton}
            title="Maximize chat (fullscreen)"
            aria-label="Maximize chat"
          >
            <Maximize2 size={16} />
          </button>
        )}

        {/* Branch button */}
        <button
          onClick={handleBranch}
          style={headerStyles.actionButton}
          title="Branch from this conversation (Ctrl+B)"
          aria-label="Branch from this conversation"
        >
          <GitBranch size={16} />
        </button>

        {/* Close button */}
        <button
          onClick={onClose}
          style={headerStyles.closeButton}
          title="Close panel (Escape)"
          aria-label="Close chat panel"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
});

// =============================================================================
// STYLES
// =============================================================================

const headerStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing[2]} ${spacing[3]}`,
    borderBottom: '1px solid var(--border-secondary)',
    backgroundColor: colors.bg.secondary,
    flexShrink: 0,
    gap: spacing[2],
  },

  titleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
    minWidth: 0, // Allow text truncation
  },

  indicator: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },

  title: {
    fontSize: typography.sizes.sm,
    fontWeight: 600,
    color: colors.fg.primary,
    fontFamily: typography.fonts.heading,
    margin: 0,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },

  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[1],
    flexShrink: 0,
  },

  actionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[2],
    backgroundColor: 'transparent',
    border: '1px solid var(--border-primary)',
    borderRadius: effects.border.radius.default,
    color: colors.fg.secondary,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[2],
    backgroundColor: 'transparent',
    border: '1px solid var(--border-primary)',
    borderRadius: effects.border.radius.default,
    color: colors.fg.quaternary,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};

export default ChatPanelHeader;
