'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch } from 'lucide-react';

import { colors, typography, spacing, effects, animation } from '@/lib/design-tokens';
import { getTextStyles } from '@/lib/language-utils';
import { useCanvasStore } from '@/stores/canvas-store';
import { usePreferencesStore, selectBranchingPreferences } from '@/stores/preferences-store';
import type { Conversation, Message } from '@/types';

// =============================================================================
// MESSAGE THREAD COMPONENT
// =============================================================================

interface MessageThreadProps {
  conversation: Conversation;
}

export function MessageThread({ conversation }: MessageThreadProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null);
  
  const messages = conversation.content;
  
  // Branch actions
  const openBranchDialog = useCanvasStore((s) => s.openBranchDialog);
  const branchFromMessage = useCanvasStore((s) => s.branchFromMessage);
  const branchingPrefs = usePreferencesStore(selectBranchingPreferences);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Handle branch from specific message
  const handleBranchClick = useCallback((messageIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (branchingPrefs.alwaysAskOnBranch) {
      openBranchDialog(conversation.id, messageIndex);
    } else {
      branchFromMessage({
        sourceCardId: conversation.id,
        messageIndex,
        inheritanceMode: branchingPrefs.defaultInheritanceMode,
        customMessageIds: undefined,
        branchReason: 'Quick branch',
      });
    }
  }, [conversation.id, openBranchDialog, branchFromMessage, branchingPrefs]);

  // Memoized handlers to prevent child re-renders
  const handleMouseEnter = useCallback((index: number) => {
    setHoveredMessageIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredMessageIndex(null);
  }, []);

  return (
    <div ref={scrollContainerRef} style={threadStyles.container}>
      <AnimatePresence mode="sync">
        {messages
          .filter((m): m is Message => m != null && typeof m.id === 'string')
          .map((message: Message, index: number) => (
            <MessageBubble
              key={message.id}
              message={message}
              index={index}
              isHovered={hoveredMessageIndex === index}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onBranchClick={handleBranchClick}
            />
          ))}
      </AnimatePresence>
      
      {/* Empty state */}
      {messages.length === 0 && (
        <div style={threadStyles.emptyState}>
          <p>No messages yet. Start the conversation!</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MESSAGE BUBBLE COMPONENT (memoized for performance)
// =============================================================================

interface MessageBubbleProps {
  message: Message;
  index: number;
  isHovered: boolean;
  onMouseEnter: (index: number) => void;
  onMouseLeave: () => void;
  onBranchClick: (index: number, e: React.MouseEvent) => void;
}

const MessageBubble = memo(function MessageBubble({ 
  message, 
  index, 
  isHovered, 
  onMouseEnter, 
  onMouseLeave,
  onBranchClick,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';

  // Get text styles for language-aware rendering
  const textStyles = useMemo(
    () => getTextStyles(message.content),
    [message.content]
  );

  // Format timestamp with validation
  const timestamp = useMemo(() => {
    const date = new Date(message.timestamp);
    // Handle invalid dates
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, [message.timestamp]);

  // Create stable callbacks that use index
  const handleMouseEnterLocal = useCallback(() => {
    onMouseEnter(index);
  }, [index, onMouseEnter]);

  const handleBranchClickLocal = useCallback((e: React.MouseEvent) => {
    onBranchClick(index, e);
  }, [index, onBranchClick]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      style={{
        ...bubbleStyles.wrapper,
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
      onMouseEnter={handleMouseEnterLocal}
      onMouseLeave={onMouseLeave}
    >
      {/* Branch icon for assistant messages (left side) */}
      {isAssistant && (
        <AnimatePresence>
          {isHovered && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.1 }}
              onClick={handleBranchClickLocal}
              style={bubbleStyles.branchIcon}
              title={`Branch from message ${index + 1}`}
              aria-label={`Branch from message ${index + 1}`}
            >
              <GitBranch size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      )}

      {/* Message bubble */}
      <div
        style={{
          ...bubbleStyles.bubble,
          backgroundColor: isUser 
            ? colors.navy.dark 
            : isSystem
              ? 'rgba(99, 102, 241, 0.1)'
              : 'transparent',
          borderLeft: isAssistant ? `3px solid ${colors.violet.primary}` : 'none',
          maxWidth: isUser ? '80%' : '100%',
        }}
      >
        {/* Role label for system messages */}
        {isSystem && (
          <span style={bubbleStyles.roleLabel}>System</span>
        )}

        {/* Message content */}
        <div
          style={{
            ...bubbleStyles.content,
            fontFamily: textStyles.fontFamily,
            direction: textStyles.direction,
            textAlign: textStyles.textAlign,
          }}
        >
          {message.content}
        </div>

        {/* Timestamp */}
        <span style={bubbleStyles.timestamp}>{timestamp}</span>
      </div>

      {/* Branch icon for user messages (right side) */}
      {isUser && (
        <AnimatePresence>
          {isHovered && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.1 }}
              onClick={handleBranchClickLocal}
              style={bubbleStyles.branchIcon}
              title={`Branch from message ${index + 1}`}
              aria-label={`Branch from message ${index + 1}`}
            >
              <GitBranch size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
});

// =============================================================================
// STYLES
// =============================================================================

const threadStyles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: spacing[4],
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[3],
    // Discrete scrollbar
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(156, 163, 175, 0.3) transparent',
  } as React.CSSProperties,

  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: colors.contrast.grayDark,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
  },
};

const bubbleStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing[2],
    width: '100%',
    position: 'relative',
  } as React.CSSProperties,

  bubble: {
    padding: spacing[3],
    borderRadius: effects.border.radius.default,
    position: 'relative',
  },

  roleLabel: {
    fontSize: typography.sizes.xs,
    color: colors.violet.light,
    fontFamily: typography.fonts.code,
    marginBottom: spacing[1],
    display: 'block',
  },

  content: {
    fontSize: typography.sizes.sm,
    color: colors.contrast.white,
    lineHeight: typography.lineHeights.relaxed,
    fontFamily: typography.fonts.body,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  },

  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.contrast.grayDark,
    fontFamily: typography.fonts.body,
    marginTop: spacing[1],
    display: 'block',
    textAlign: 'right',
  } as React.CSSProperties,

  branchIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    borderRadius: '50%',
    color: colors.amber.primary,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  } as React.CSSProperties,
};

export default MessageThread;
