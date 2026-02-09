'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Loader, Image as ImageIcon, Copy, Edit2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message as ChatMessage } from 'ai';

import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { getTextStyles } from '@/lib/language-utils';
import { useCanvasStore } from '@/stores/canvas-store';
import { usePreferencesStore, selectBranchingPreferences } from '@/stores/preferences-store';
import { useToast } from '@/stores/toast-store';
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
  const isPinnedToBottomRef = useRef(true);
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null);
  const [isTouchDevice] = useState(() => (
    typeof window !== 'undefined'
    && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  ));
  
  // Use streaming messages when actively streaming, otherwise use store messages
  // Store messages (conversation.content) preserve attachments and metadata;
  // useChat messages are only needed during active streaming for real-time display.
  const displayMessages = useMemo(() => {
    if (isStreaming && streamingMessages.length > 0) {
      // During active streaming, convert useChat messages to our format
      // Pre-index store messages by ID for O(1) lookups instead of O(n) find per message
      const storeMessages = conversation.content;
      const storeIndex = new Map<string, Message>();
      for (const sm of storeMessages) {
        storeIndex.set(sm.id, sm);
      }
      
      // Stable fallback timestamp to avoid creating new Date objects per render
      const firstTimestamp = storeMessages[0]?.timestamp;
      const fallbackTimestamp = (firstTimestamp && !isNaN(new Date(firstTimestamp).getTime()))
        ? firstTimestamp
        : new Date();
      
      return streamingMessages.map((msg, idx) => {
        // O(1) lookup by ID
        const storeMsg = storeIndex.get(msg.id);
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
  // The last streaming message content triggers scroll during active streaming.
  const lastStreamingContent = isStreaming && streamingMessages.length > 0
    ? streamingMessages[streamingMessages.length - 1]?.content ?? ''
    : '';

  useEffect(() => {
    if (scrollContainerRef.current && isPinnedToBottomRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [displayMessages.length, streamingMessages.length, lastStreamingContent]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const bottomThreshold = 24;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isPinnedToBottomRef.current = distanceFromBottom <= bottomThreshold;
  }, []);

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
    <div ref={scrollContainerRef} style={threadStyles.container} onScroll={handleScroll}>
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
              isTouchDevice={isTouchDevice}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onBranchClick={handleBranchClick}
            />
          ))}
      </AnimatePresence>
      
      {/* Empty state */}
      {displayMessages.length === 0 && (
        <div style={threadStyles.emptyState}>
          <p style={threadStyles.emptyStateTitle}>No messages yet. Start the conversation!</p>
          <p style={threadStyles.emptyStateDisclaimer}>AI responses may be inaccurate. Please double-check.</p>
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
  isTouchDevice?: boolean;
  onMouseEnter: (index: number) => void;
  onMouseLeave: () => void;
  onBranchClick: (index: number, e: React.MouseEvent) => void;
}

const MessageBubble = memo(function MessageBubble({
  message,
  index,
  isHovered,
  isStreamingMessage = false,
  isTouchDevice = false,
  onMouseEnter,
  onMouseLeave,
  onBranchClick,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Toast for feedback
  const toast = useToast();

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

  const handleCopyClickLocal = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('Copied to clipboard');
    } catch (err) {
      console.error('[MessageBubble] Failed to copy:', err);
      toast.error('Failed to copy');
    }
  }, [message.content, toast]);

  const handleEditClickLocal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info('Edit feature coming soon');
  }, [toast]);

  const markdownComponents = useMemo(() => ({
    p: ({ children }: { children?: React.ReactNode }) => (
      <p style={bubbleStyles.markdownParagraph}>{children}</p>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong style={bubbleStyles.markdownStrong}>{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em style={bubbleStyles.markdownEm}>{children}</em>
    ),
    code: ({ inline = false, children }: { inline?: boolean; children?: React.ReactNode }) => (
      <code style={inline ? bubbleStyles.markdownInlineCode : bubbleStyles.markdownCodeBlock}>
        {children}
      </code>
    ),
    pre: ({ children }: { children?: React.ReactNode }) => (
      <pre style={bubbleStyles.markdownPre}>{children}</pre>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul style={bubbleStyles.markdownList}>{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol style={bubbleStyles.markdownList}>{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li style={bubbleStyles.markdownListItem}>{children}</li>
    ),
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a
        href={href}
        target={href ? '_blank' : undefined}
        rel={href ? 'noopener noreferrer' : undefined}
        style={bubbleStyles.markdownLink}
      >
        {children}
      </a>
    ),
  }), []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      style={{
        ...bubbleStyles.wrapper,
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
      onMouseEnter={handleMouseEnterLocal}
      onMouseLeave={onMouseLeave}
    >
      {/* Message content */}
      <div
        style={{
          ...bubbleStyles.message,
          ...(isUser ? bubbleStyles.userBubble : {}),
        }}
      >

        {/* Message content */}
        <div
          style={{
            ...bubbleStyles.content,
            fontFamily: textStyles.fontFamily,
            direction: textStyles.direction,
            textAlign: textStyles.textAlign,
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
      </div>

      {/* Timestamp row - outside bubble */}
      {!isStreamingMessage && !isSystem && (
        <div 
          style={{
            ...bubbleStyles.timestampRow,
            opacity: isUser ? (isHovered || isTouchDevice ? 1 : 0) : 1,
            width: isUser ? 'auto' : '100%',
          }}
        >
          {/* Timestamp - only shown for user messages */}
          {isUser && (
            <span style={bubbleStyles.timestamp}>{timestamp}</span>
          )}

          {/* Action buttons - always rendered to preserve space */}
          <div style={{ 
            opacity: (isHovered || isTouchDevice) ? 1 : 0,
            pointerEvents: (isHovered || isTouchDevice) ? 'auto' : 'none',
            transition: 'opacity 0.15s ease',
          }}>
            <MessageActionButtons
              messageIndex={index}
              isUserMessage={isUser}
              onCopyClick={handleCopyClickLocal}
              onEditClick={handleEditClickLocal}
              onBranchClick={handleBranchClickLocal}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
});

// =============================================================================
// MESSAGE ACTION BUTTONS COMPONENT
// =============================================================================

interface MessageActionButtonsProps {
  messageIndex: number;
  isUserMessage: boolean;
  onCopyClick: (e: React.MouseEvent) => void;
  onEditClick: (e: React.MouseEvent) => void;
  onBranchClick: (e: React.MouseEvent) => void;
}

const MessageActionButtons = memo(function MessageActionButtons({
  messageIndex,
  isUserMessage,
  onCopyClick,
  onEditClick,
  onBranchClick,
}: MessageActionButtonsProps) {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  return (
    <div style={actionButtonGroupStyles.container}>
      <button
        onClick={onCopyClick}
        onMouseEnter={() => setHoveredButton('copy')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          ...actionButtonGroupStyles.button,
          color: hoveredButton === 'copy' ? colors.fg.secondary : colors.fg.tertiary,
        }}
        title="Copy message"
        aria-label="Copy message"
      >
        <Copy size={12} />
      </button>
      {isUserMessage && (
        <button
          onClick={onEditClick}
          onMouseEnter={() => setHoveredButton('edit')}
          onMouseLeave={() => setHoveredButton(null)}
          style={{
            ...actionButtonGroupStyles.button,
            color: hoveredButton === 'edit' ? colors.fg.secondary : colors.fg.tertiary,
          }}
          title="Edit message"
          aria-label="Edit message"
        >
          <Edit2 size={12} />
        </button>
      )}
      <button
        onClick={onBranchClick}
        onMouseEnter={() => setHoveredButton('branch')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          ...actionButtonGroupStyles.button,
          color: hoveredButton === 'branch' ? colors.accent.emphasis : colors.accent.primary,
        }}
        title={`Branch from message ${messageIndex + 1}`}
        aria-label={`Branch from message ${messageIndex + 1}`}
      >
        <GitBranch size={12} />
      </button>
    </div>
  );
});

// =============================================================================
// HELPERS
// =============================================================================

// =============================================================================
// STYLES
// =============================================================================

const threadStyles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[5],
    // Discrete scrollbar
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(156, 163, 175, 0.3) transparent',
  } as React.CSSProperties,

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    flex: 1,
    textAlign: 'center',
    padding: spacing[4],
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.bg.secondary,
    border: `1px solid ${colors.border.muted}`,
    borderRadius: effects.border.radius.default,
    boxShadow: effects.shadow?.sm ?? 'none',
    color: colors.fg.tertiary,
    fontFamily: typography.fonts.body,
  },
  emptyStateTitle: {
    margin: 0,
    fontSize: typography.sizes.sm,
    color: colors.fg.secondary,
  },
  emptyStateDisclaimer: {
    margin: 0,
    fontSize: typography.sizes.xs,
    color: colors.fg.quaternary,
  },
};

const bubbleStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
    position: 'relative',
  } as React.CSSProperties,

  message: {
    padding: '12px 16px',
    position: 'relative',
    width: '100%',
  },

  userBubble: {
    backgroundColor: colors.bg.inset,
    borderRadius: effects.border.radius.default,
    marginLeft: 'auto',
    width: 'fit-content',
    maxWidth: '75%',
    minWidth: '100px',
  },

  content: {
    fontSize: typography.sizes.sm,
    color: colors.fg.primary,
    lineHeight: typography.lineHeights.relaxed,
    fontFamily: typography.fonts.body,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  },
  markdownParagraph: {
    margin: 0,
    marginBottom: spacing[2],
  },
  markdownStrong: {
    fontWeight: 700,
  },
  markdownEm: {
    fontStyle: 'italic',
  },
  markdownInlineCode: {
    fontFamily: typography.fonts.code || 'monospace',
    backgroundColor: colors.bg.inset,
    border: `1px solid ${colors.border.muted}`,
    borderRadius: effects.border.radius.sm || '4px',
    padding: '0 4px',
  },
  markdownPre: {
    margin: `${spacing[2]} 0`,
    padding: `${spacing[2]} ${spacing[3]}`,
    backgroundColor: colors.bg.inset,
    border: `1px solid ${colors.border.muted}`,
    borderRadius: effects.border.radius.default,
    overflowX: 'auto',
  },
  markdownCodeBlock: {
    fontFamily: typography.fonts.code || 'monospace',
    fontSize: typography.sizes.xs,
  },
  markdownList: {
    margin: `${spacing[2]} 0`,
    paddingLeft: spacing[4],
  },
  markdownListItem: {
    marginBottom: spacing[1],
  },
  markdownLink: {
    color: colors.accent.primary,
    textDecoration: 'underline',
  },

  streamingIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: spacing[1],
    color: colors.accent.primary,
  },

  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.fg.tertiary,
    fontFamily: typography.fonts.body,
  } as React.CSSProperties,

  timestampRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    marginTop: spacing[1],
    minHeight: 20,
    transition: 'opacity 0.15s ease',
    paddingTop: '2px',
  } as React.CSSProperties,

  timestampBranchIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
    color: colors.fg.tertiary,
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
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
    border: `1px solid ${colors.border.default}`,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,

  attachmentLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
    color: colors.fg.tertiary,
    fontFamily: typography.fonts.body,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
};

const actionButtonGroupStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[1],
  } as React.CSSProperties,

  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: effects.border.radius.sm || '4px',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease, color 0.15s ease',
  } as React.CSSProperties,
};

export default MessageThread;
