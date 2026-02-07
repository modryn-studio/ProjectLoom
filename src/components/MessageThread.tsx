'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Loader, Image as ImageIcon } from 'lucide-react';
import type { Message as ChatMessage } from 'ai';

import { colors, typography, spacing, effects, animation } from '@/lib/design-tokens';
import { getTextStyles } from '@/lib/language-utils';
import { useCanvasStore } from '@/stores/canvas-store';
import { usePreferencesStore, selectBranchingPreferences } from '@/stores/preferences-store';
import type { Conversation, Message, MessageAttachment } from '@/types';

// =============================================================================
// MESSAGE THREAD COMPONENT
// =============================================================================

interface MessageThreadProps {
  conversation: Conversation;
  /** Messages from useChat hook during streaming */
  streamingMessages?: ChatMessage[];
  /** Whether AI is currently streaming a response */
  isStreaming?: boolean;
}

export function MessageThread({ 
  conversation, 
  streamingMessages = [],
  isStreaming = false,
}: MessageThreadProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null);
  
  // Use streaming messages when actively streaming, otherwise use store messages
  // Store messages (conversation.content) preserve attachments and metadata;
  // useChat messages are only needed during active streaming for real-time display.
  const displayMessages = useMemo(() => {
    if (isStreaming && streamingMessages.length > 0) {
      // During active streaming, convert useChat messages to our format
      // Pre-index store messages by content+role for O(1) lookups instead of O(n) find per message
      const storeMessages = conversation.content;
      const storeIndex = new Map<string, Message>();
      for (const sm of storeMessages) {
        storeIndex.set(`${sm.role}:${sm.content}`, sm);
      }
      
      // Stable fallback timestamp to avoid creating new Date objects per render
      const fallbackTimestamp = storeMessages[0]?.timestamp || new Date(0);
      
      return streamingMessages.map((msg, idx) => {
        // O(1) lookup instead of O(n) find
        const storeMsg = storeIndex.get(`${msg.role}:${msg.content}`);
        return {
          id: msg.id || `streaming-${idx}`,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: storeMsg?.timestamp || fallbackTimestamp,
          metadata: {
            ...storeMsg?.metadata,
            // Mark streaming message
            isStreaming: idx === streamingMessages.length - 1 && msg.role === 'assistant',
          },
          // Preserve attachments from store message
          attachments: storeMsg?.attachments,
        };
      });
    }
    return conversation.content;
  }, [streamingMessages, conversation.content, isStreaming]);
  
  // Branch actions
  const openBranchDialog = useCanvasStore((s) => s.openBranchDialog);
  const branchFromMessage = useCanvasStore((s) => s.branchFromMessage);
  const branchingPrefs = usePreferencesStore(selectBranchingPreferences);

  // Auto-scroll to bottom when new messages arrive or streaming content updates
  // Use displayMessages.length for new messages and streamingMessages.length for
  // "new streaming message added" (not content changes within existing messages).
  // The last streaming message content length triggers scroll during active streaming.
  const lastStreamingContent = isStreaming && streamingMessages.length > 0
    ? streamingMessages[streamingMessages.length - 1]?.content.length ?? 0
    : 0;

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [displayMessages.length, streamingMessages.length, lastStreamingContent]);

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
        {displayMessages
          .filter((m): m is Message => m != null && typeof m.id === 'string')
          .map((message: Message, index: number) => (
            <MessageBubble
              key={message.id}
              message={message}
              index={index}
              isHovered={hoveredMessageIndex === index}
              isStreamingMessage={!!(message.metadata as { isStreaming?: boolean } | undefined)?.isStreaming}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onBranchClick={handleBranchClick}
            />
          ))}
      </AnimatePresence>
      
      {/* Empty state */}
      {displayMessages.length === 0 && (
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
  isStreamingMessage?: boolean;
  onMouseEnter: (index: number) => void;
  onMouseLeave: () => void;
  onBranchClick: (index: number, e: React.MouseEvent) => void;
}

const MessageBubble = memo(function MessageBubble({ 
  message, 
  index, 
  isHovered,
  isStreamingMessage = false,
  onMouseEnter, 
  onMouseLeave,
  onBranchClick,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';

  // Get model from metadata if available
  const modelName = (message.metadata as { model?: string } | undefined)?.model;

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
      {isAssistant && !isStreamingMessage && (
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

        {/* Model badge for assistant messages */}
        {isAssistant && modelName && (
          <span style={bubbleStyles.modelBadge}>{formatModelName(modelName)}</span>
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
          {/* Streaming indicator */}
          {isStreamingMessage && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={bubbleStyles.streamingIndicator}
            >
              <Loader size={12} style={{ display: 'inline', marginLeft: 4 }} className="animate-spin" />
            </motion.span>
          )}
        </div>

        {/* Image attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div style={bubbleStyles.attachmentRow}>
            {message.attachments.map((att: MessageAttachment) => (
              <div key={att.id} style={bubbleStyles.attachmentContainer}>
                <img
                  src={att.url}
                  alt={att.name}
                  style={bubbleStyles.attachmentImage}
                  onClick={() => window.open(att.url, '_blank')}
                />
                <span style={bubbleStyles.attachmentLabel}>
                  <ImageIcon size={10} style={{ flexShrink: 0 }} />
                  {att.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Timestamp - hide during streaming */}
        {!isStreamingMessage && (
          <span style={bubbleStyles.timestamp}>{timestamp}</span>
        )}
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
// HELPERS
// =============================================================================

/** Format model ID to human-readable name */
function formatModelName(modelId: string): string {
  // Claude models
  if (modelId.includes('opus')) return 'Opus';
  if (modelId.includes('sonnet')) return 'Sonnet';
  if (modelId.includes('haiku')) return 'Haiku';
  // OpenAI models
  if (modelId.includes('gpt-4o-mini')) return 'GPT-4o Mini';
  if (modelId.includes('gpt-4o')) return 'GPT-4o';
  // Fallback
  return modelId.split('-').slice(0, 2).join(' ');
}

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

  modelBadge: {
    fontSize: '10px',
    color: colors.violet.primary,
    fontFamily: typography.fonts.code,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    padding: '2px 6px',
    borderRadius: '4px',
    marginBottom: spacing[1],
    display: 'inline-block',
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

  streamingIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: spacing[1],
    color: colors.violet.primary,
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

  attachmentRow: {
    display: 'flex',
    gap: spacing[2],
    marginTop: spacing[2],
    flexWrap: 'wrap',
  } as React.CSSProperties,

  attachmentContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    maxWidth: 200,
  } as React.CSSProperties,

  attachmentImage: {
    width: '100%',
    maxHeight: 180,
    objectFit: 'cover',
    borderRadius: effects.border.radius.default,
    border: `1px solid rgba(99, 102, 241, 0.2)`,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,

  attachmentLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
    color: colors.contrast.grayDark,
    fontFamily: typography.fonts.body,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
};

export default MessageThread;
