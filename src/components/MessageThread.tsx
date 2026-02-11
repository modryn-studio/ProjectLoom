'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Loader, Image as ImageIcon, Copy, Edit2, ArrowRight, ChevronDown, ChevronRight, FileText, RefreshCcw } from 'lucide-react';
import { SimpleChatMarkdown } from './SimpleChatMarkdown';
import type { Message as ChatMessage } from 'ai';

import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { getTextStyles } from '@/lib/language-utils';
import { useCanvasStore } from '@/stores/canvas-store';
import { useToast } from '@/stores/toast-store';
import type { Conversation, InheritedContextEntry, Message, MessageAttachment } from '@/types';

// =============================================================================
// INHERITED FROM BANNER COMPONENT
// =============================================================================

interface InheritedFromBannerProps {
  parentCardIds: string[];
  inheritedContext: Record<string, InheritedContextEntry>;
}

const InheritedFromBanner = memo(function InheritedFromBanner({
  parentCardIds,
  inheritedContext,
}: InheritedFromBannerProps) {
  const conversations = useCanvasStore((s) => s.conversations);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const openChatPanel = useCanvasStore((s) => s.openChatPanel);
  const requestFocusNode = useCanvasStore((s) => s.requestFocusNode);

  const inheritedSourceIds = useMemo(() => {
    const contextIds = Object.keys(inheritedContext || {});
    return Array.from(new Set([...parentCardIds, ...contextIds]));
  }, [parentCardIds, inheritedContext]);

  const parentConversations = useMemo(() => {
    return inheritedSourceIds
      .map(id => conversations.get(id))
      .filter((c): c is Conversation => c !== undefined);
  }, [inheritedSourceIds, conversations]);

  const handleParentClick = useCallback((parentId: string) => {
    setSelected([parentId]);
    openChatPanel(parentId);
    requestFocusNode(parentId);
  }, [openChatPanel, requestFocusNode, setSelected]);

  if (parentConversations.length === 0) return null;

  return (
    <div style={inheritedBannerStyles.container}>
      {parentConversations.map((parent) => (
        <button
          key={parent.id}
          onClick={() => handleParentClick(parent.id)}
          style={inheritedBannerStyles.button}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.bg.inset;
            e.currentTarget.style.borderColor = colors.accent.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = colors.border.muted;
          }}
        >
          <ArrowRight size={14} style={inheritedBannerStyles.icon} />
          <span style={inheritedBannerStyles.label}>Inherited from</span>
          <span style={inheritedBannerStyles.title}>{parent.metadata.title}</span>
        </button>
      ))}
    </div>
  );
});

const inheritedBannerStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
    padding: `${spacing[4]} ${spacing[4]} ${spacing[2]} ${spacing[4]}`,
    borderBottom: `1px solid ${colors.border.muted}`,
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[3]}`,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.border.muted}`,
    borderRadius: '6px',
    color: colors.fg.secondary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'left',
  },
  icon: {
    color: colors.accent.primary,
    flexShrink: 0,
  },
  label: {
    color: colors.fg.tertiary,
    flexShrink: 0,
  },
  title: {
    color: colors.fg.primary,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

// =============================================================================
// WEB SEARCH TYPES
// =============================================================================

interface WebSource {
  title: string;
  url: string;
}

// =============================================================================
// MESSAGE THREAD COMPONENT
// =============================================================================

interface MessageThreadProps {
  conversation: Conversation;
  /** Messages from useChat hook during streaming */
  streamingMessages?: ChatMessage[];
  /** Whether AI is currently streaming a response */
  isStreaming?: boolean;
  /** Notify parent of scroll container height changes */
  onHeightChange?: (height: number) => void;
  /** Whether chat panel is maximized (fullscreen) */
  isMaximized?: boolean;
  /** Callback to retry a user message (removes subsequent messages and re-sends) */
  onRetry?: (messageIndex: number) => void;
}

export function MessageThread({
  conversation,
  streamingMessages = [],
  isStreaming = false,
  onHeightChange,
  isMaximized = false,
  onRetry,
}: MessageThreadProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPinnedToBottomRef = useRef(true);
  const prevIsStreamingRef = useRef(isStreaming);
  const prevDisplayLengthRef = useRef(0);
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null);
  const [isTouchDevice] = useState(() => (
    typeof window !== 'undefined'
    && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  ));

  // Always use conversation.content as the display source of truth.
  // During streaming, append ONLY the actively-streaming assistant response.
  //
  // Why: streamingMessages (from useChat) includes inherited parent messages
  // loaded for LLM context. Displaying them causes parent messages to flash
  // in branched cards. Using conversation.content keeps IDs stable (nanoid)
  // across streaming/non-streaming transitions, preventing AnimatePresence
  // from tearing down and rebuilding the entire message list (which caused
  // scroll position to reset to top).
  const displayMessages = useMemo(() => {
    if (isStreaming && streamingMessages.length > 0) {
      const lastStreaming = streamingMessages[streamingMessages.length - 1];

      // AI has started responding — append the streaming assistant message
      if (lastStreaming?.role === 'assistant') {
        const lastContent = conversation.content[conversation.content.length - 1];

        // If the store already has this exact response (onFinish fired but
        // isStreaming hasn't flipped yet), just use conversation.content as-is
        if (
          lastContent?.role === 'assistant' &&
          lastContent.content === lastStreaming.content
        ) {
          return conversation.content;
        }

        // Graft the in-flight assistant message onto the persisted messages
        return [
          ...conversation.content,
          {
            id: lastStreaming.id ?? `streaming-${conversation.id}`,
            role: 'assistant' as const,
            content: lastStreaming.content,
            timestamp: new Date(),
            metadata: { isStreaming: true },
          },
        ];
      }

      // Last streaming message is user → AI hasn't started responding yet.
      // User message is already in conversation.content (added by sendMessage
      // before append), so just show persisted messages.
    }

    return conversation.content;
  }, [streamingMessages, conversation.content, conversation.id, isStreaming]);

  const showPendingResponse = useMemo(() => {
    if (!isStreaming) return false;
    // Check whether the AI has begun streaming an assistant message.
    // Don't use streamingMessages.length — it includes inherited parent
    // messages loaded for LLM context and is never truly empty.
    const hasStreamingAssistant =
      streamingMessages.length > 0 &&
      streamingMessages[streamingMessages.length - 1]?.role === 'assistant';
    if (hasStreamingAssistant) return false;
    if (displayMessages.length === 0) return false;
    return displayMessages[displayMessages.length - 1]?.role === 'user';
  }, [isStreaming, streamingMessages, displayMessages]);
  
  // Branch actions
  const branchFromMessage = useCanvasStore((s) => s.branchFromMessage);
  const openChatPanel = useCanvasStore((s) => s.openChatPanel);
  const requestFocusNode = useCanvasStore((s) => s.requestFocusNode);

  // Reset scroll state when switching to a different conversation.
  // Without this, isPinnedToBottomRef retains the previous card's scroll
  // position, causing auto-scroll to not work in the new card.
  useEffect(() => {
    isPinnedToBottomRef.current = true;
    if (scrollContainerRef.current) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      });
    }
  }, [conversation.id]);

  // Auto-scroll to bottom when new messages arrive or streaming content updates.
  // Only track streaming content when actively streaming — when streaming ends,
  // lastStreamingContent changes to '', which should NOT trigger auto-scroll.
  const lastStreamingContent = isStreaming && streamingMessages.length > 0
    ? streamingMessages[streamingMessages.length - 1]?.content ?? ''
    : '';

  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    const isNowStreaming = isStreaming;
    const prevLength = prevDisplayLengthRef.current;
    const currentLength = displayMessages.length;
    
    // Update refs for next render
    prevIsStreamingRef.current = isStreaming;
    prevDisplayLengthRef.current = currentLength;
    
    // Detect if a new message was added (user sent a message, or AI response was persisted)
    const messageWasAdded = currentLength > prevLength;
    
    // Don't auto-scroll when streaming just finished OR just after it finished.
    // The lastStreamingContent dependency changes from content→'' when streaming
    // ends, triggering this effect again. We must block scrolling for that second
    // trigger too, otherwise users reading the message get auto-scrolled to bottom.
    if (wasStreaming && !isNowStreaming) {
      return; // Streaming just ended this render
    }
    if (!wasStreaming && !isNowStreaming && lastStreamingContent === '' && !messageWasAdded) {
      return; // Streaming ended previously, no new message, don't scroll on stale triggers
    }
    
    // Auto-scroll if pinned to bottom OR if a new message was just added
    // (new messages should always scroll into view so user sees the response)
    if (scrollContainerRef.current && (isPinnedToBottomRef.current || messageWasAdded)) {
      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      });
    }
  }, [displayMessages.length, streamingMessages.length, lastStreamingContent, isStreaming]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !onHeightChange) return;

    const updateHeight = () => {
      onHeightChange(container.clientHeight);
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(container);

    return () => observer.disconnect();
  }, [onHeightChange]);

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
    
    const newConversation = branchFromMessage({
      sourceCardId: conversation.id,
      messageIndex,
      branchReason: 'Branch from message',
    });
    
    // Open chat panel and focus the new card for immediate interaction
    if (newConversation) {
      openChatPanel(newConversation.id);
      requestFocusNode(newConversation.id);
    }
  }, [conversation.id, branchFromMessage, openChatPanel, requestFocusNode]);

  // Handle retry from specific message
  const handleRetryClick = useCallback((messageIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRetry) {
      onRetry(messageIndex);
    }
  }, [onRetry]);

  // Memoized handlers to prevent child re-renders
  const handleMouseEnter = useCallback((index: number) => {
    setHoveredMessageIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredMessageIndex(null);
  }, []);

  return (
    <div ref={scrollContainerRef} style={threadStyles.container} onScroll={handleScroll}>
      <div style={isMaximized ? threadStyles.maximizedContent : threadStyles.normalContent}>
        {/* Inherited From Banner */}
        {conversation.parentCardIds.length > 0 && (
          <InheritedFromBanner
            parentCardIds={conversation.parentCardIds}
            inheritedContext={conversation.inheritedContext}
          />
        )}
        
        <AnimatePresence mode="sync">
        {displayMessages
          .map((message, originalIndex) => ({ message, originalIndex }))
          .filter((item): item is { message: Message; originalIndex: number } => 
            item.message != null && 
            typeof item.message.id === 'string' && 
            item.message.role !== 'system'
          )
          .map(({ message, originalIndex }) => {
            return (
              <MessageBubble
                key={message.id}
                message={message}
                index={originalIndex}
                isHovered={hoveredMessageIndex === originalIndex}
                isStreamingMessage={!!(message.metadata as { isStreaming?: boolean } | undefined)?.isStreaming}
                isTouchDevice={isTouchDevice}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onBranchClick={handleBranchClick}
                onRetryClick={handleRetryClick}
              />
            );
          })}
      </AnimatePresence>
      
      {/* Pending response indicator - shown before streaming starts */}
      {showPendingResponse && (
        <div style={bubbleStyles.pendingWrapper}>
          <div style={bubbleStyles.pendingBubble}>
            <Loader size={14} className="animate-spin" />
            <span style={bubbleStyles.pendingText}>Thinking...</span>
          </div>
        </div>
      )}
      
        {/* Empty state */}
        {displayMessages.length === 0 && (
        <div style={threadStyles.emptyState}>
          <p style={threadStyles.emptyStateTitle}>No messages yet. Start the conversation!</p>
          <p style={threadStyles.emptyStateDisclaimer}>AI responses may be inaccurate. Please double-check.</p>
        </div>
      )}
      </div>
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
  onRetryClick: (index: number, e: React.MouseEvent) => void;
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
  onRetryClick,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Toast for feedback
  const toast = useToast();
  
  // Collapsed state for sources
  const [sourcesCollapsed, setSourcesCollapsed] = useState(true);

  const webSearchMetadata = useMemo(() => {
    if (isUser || isSystem) return null;

    const custom = message.metadata?.custom as { webSearch?: { used?: boolean; sources?: WebSource[] } } | undefined;
    const metadata = custom?.webSearch;
    if (!metadata) return null;

    const sources = Array.isArray(metadata.sources)
      ? metadata.sources.filter((source) => source && source.url && source.title)
      : [];

    return {
      used: Boolean(metadata.used ?? sources.length > 0),
      sources,
    };
  }, [message.metadata, isUser, isSystem]);

  const webSearchData = useMemo(() => {
    if (isUser || isSystem) {
      return { content: message.content, sources: [], used: false };
    }

    if (webSearchMetadata) {
      return {
        content: message.content,
        sources: webSearchMetadata.sources,
        used: webSearchMetadata.used,
      };
    }

    return { content: message.content, sources: [], used: false };
  }, [message.content, isUser, isSystem, webSearchMetadata]);

  // Get text styles for language-aware rendering
  const textStyles = useMemo(
    () => getTextStyles(webSearchData.content),
    [webSearchData.content]
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

  const [isCopied, setIsCopied] = useState(false);

  const handleBranchClickLocal = useCallback((e: React.MouseEvent) => {
    onBranchClick(index, e);
  }, [index, onBranchClick]);

  const handleCopyClickLocal = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(message.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('[MessageBubble] Failed to copy:', err);
      toast.error('Failed to copy');
    }
  }, [message.content, toast]);

  const handleEditClickLocal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info('Edit feature coming soon');
  }, [toast]);

  const handleRetryClickLocal = useCallback((e: React.MouseEvent) => {
    onRetryClick(index, e);
  }, [onRetryClick, index]);

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

        {!isUser && webSearchData.used && (
          <div style={bubbleStyles.webSearchBadgeRow}>
            <span style={bubbleStyles.webSearchBadge}>Web search</span>
          </div>
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
          <SimpleChatMarkdown content={webSearchData.content} />
          {/* Streaming indicator */}
          {isStreamingMessage && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={bubbleStyles.streamingIndicator}
            >
              <Loader size={12} style={{ display: 'inline', marginLeft: spacing[1] }} className="animate-spin" />
            </motion.span>
          )}
        </div>

        {!isUser && webSearchData.sources.length > 0 && (
          <div style={bubbleStyles.citations}>
            <div 
              style={{
                ...bubbleStyles.citationsTitle,
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1],
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => setSourcesCollapsed(!sourcesCollapsed)}
            >
              {sourcesCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span>{webSearchData.sources.length} {webSearchData.sources.length === 1 ? 'source' : 'sources'}</span>
            </div>
            {!sourcesCollapsed && (
              <ol style={bubbleStyles.citationsList}>
                {webSearchData.sources.map((source) => (
                  <li key={source.url} style={bubbleStyles.citationItem}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={bubbleStyles.citationLink}
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {!isUser && webSearchData.used && webSearchData.sources.length === 0 && (
          <div style={{
            ...bubbleStyles.citationsEmpty,
            fontSize: typography.sizes.xs,
            color: colors.fg.tertiary,
          }}>
            Search performed (no sources available)
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div style={bubbleStyles.attachmentRow}>
            {message.attachments.map((att: MessageAttachment) => {
              const isImage = att.contentType.startsWith('image/');
              
              if (isImage) {
                // Image attachment
                return (
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
                );
              } else {
                // Text file attachment
                return (
                  <div key={att.id} style={bubbleStyles.attachmentTextBadge}>
                    <FileText size={14} style={{ flexShrink: 0, color: colors.accent.primary }} />
                    <span style={bubbleStyles.attachmentTextName}>{att.name}</span>
                  </div>
                );
              }
            })}
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
              isCopied={isCopied}
              onCopyClick={handleCopyClickLocal}
              onEditClick={handleEditClickLocal}
              onBranchClick={handleBranchClickLocal}
              onRetryClick={handleRetryClickLocal}
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
  isCopied: boolean;
  onCopyClick: (e: React.MouseEvent) => void;
  onEditClick: (e: React.MouseEvent) => void;
  onBranchClick: (e: React.MouseEvent) => void;
  onRetryClick: (e: React.MouseEvent) => void;
}

const MessageActionButtons = memo(function MessageActionButtons({
  messageIndex,
  isUserMessage,
  isCopied,
  onCopyClick,
  onEditClick,
  onBranchClick,
  onRetryClick,
}: MessageActionButtonsProps) {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  return (
    <div style={actionButtonGroupStyles.container}>
      {isUserMessage && (
        <button
          onClick={onRetryClick}
          onMouseEnter={() => setHoveredButton('retry')}
          onMouseLeave={() => setHoveredButton(null)}
          style={{
            ...actionButtonGroupStyles.button,
            color: hoveredButton === 'retry' ? colors.fg.secondary : colors.fg.tertiary,
          }}
          title="Retry this prompt"
          aria-label="Retry this prompt"
        >
          <RefreshCcw size={12} />
        </button>
      )}
      <button
        onClick={onCopyClick}
        onMouseEnter={() => setHoveredButton('copy')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          ...actionButtonGroupStyles.button,
          color: isCopied ? colors.semantic.success : (hoveredButton === 'copy' ? colors.fg.secondary : colors.fg.tertiary),
          fontSize: isCopied ? '10px' : undefined,
          fontWeight: isCopied ? 500 : undefined,
          pointerEvents: isCopied ? 'none' : 'auto',
        }}
        title={isCopied ? 'Copied!' : 'Copy message'}
        aria-label={isCopied ? 'Copied!' : 'Copy message'}
      >
        {isCopied ? 'Copied' : <Copy size={12} />}
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
    padding: spacing[4],
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
    // Discrete scrollbar
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(156, 163, 175, 0.3) transparent',
  } as React.CSSProperties,

  maximizedContent: {
    maxWidth: '900px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
    flex: 1,
  } as React.CSSProperties,

  normalContent: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
    flex: 1,
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
    maxWidth: '520px',
    width: 'calc(100% - 32px)',
    margin: '0 auto',
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

  pendingWrapper: {
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
  } as React.CSSProperties,

  pendingBubble: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[1]} ${spacing[3]}`,
    backgroundColor: colors.bg.tertiary,
    borderRadius: effects.border.radius.default,
    border: `1px solid ${colors.border.muted}`,
    color: colors.fg.secondary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
  } as React.CSSProperties,

  pendingText: {
    lineHeight: 1.2,
  } as React.CSSProperties,

  message: {
    padding: `${spacing[1]} ${spacing[3]}`,
    position: 'relative',
    width: '100%',
  },

  webSearchBadgeRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: '4px',
  },

  webSearchBadge: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.fg.secondary,
    backgroundColor: colors.bg.tertiary,
    border: `1px solid ${colors.border.muted}`,
    borderRadius: 999,
    padding: '2px 8px',
    fontFamily: typography.fonts.body,
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
    lineHeight: 1.6,
    fontFamily: typography.fonts.body,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  },
  markdownParagraph: {
    margin: 0,
    marginBlockStart: 0,
    marginBlockEnd: spacing[3],
    padding: 0,
    lineHeight: 1.6,
  },
  markdownStrong: {
    fontWeight: typography.weights.bold,
  },
  markdownEm: {
    fontStyle: 'italic',
  },
  markdownInlineCode: {
    fontFamily: typography.fonts.code || 'monospace',
    backgroundColor: colors.bg.inset,
    border: `1px solid ${colors.border.muted}`,
    borderRadius: effects.border.radius.sm || '4px',
    padding: `0 ${spacing[1]}`,
  },
  markdownPre: {
    margin: `${spacing[3]} 0`,
    padding: `${spacing[3]} ${spacing[3]}`,
    backgroundColor: colors.bg.inset,
    border: `1px solid ${colors.border.muted}`,
    borderRadius: effects.border.radius.default,
    overflowX: 'auto',
    lineHeight: 1.5,
  },
  markdownCodeBlock: {
    fontFamily: typography.fonts.code || 'monospace',
    fontSize: typography.sizes.xs,
  },
  markdownList: {
    margin: `${spacing[2]} 0`,
    paddingLeft: spacing[5],
    listStylePosition: 'outside',
  },
  markdownListItem: {
    margin: 0,
    marginBottom: spacing[1],
    paddingLeft: spacing[1],
  },
  markdownLink: {
    color: colors.accent.primary,
    textDecoration: 'underline',
  },

  // Headings
  markdownH1: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    margin: `${spacing[4]} 0 ${spacing[3]} 0`,
    lineHeight: 1.3,
    color: colors.fg.primary,
  },
  markdownH2: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    margin: `${spacing[4]} 0 ${spacing[2]} 0`,
    lineHeight: 1.3,
    color: colors.fg.primary,
  },
  markdownH3: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    margin: `${spacing[3]} 0 ${spacing[2]} 0`,
    lineHeight: 1.3,
    color: colors.fg.primary,
  },
  markdownH4: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    margin: `${spacing[3]} 0 ${spacing[2]} 0`,
    lineHeight: 1.3,
    color: colors.fg.primary,
  },
  markdownH5: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    margin: `${spacing[2]} 0 ${spacing[1]} 0`,
    lineHeight: 1.3,
    color: colors.fg.secondary,
  },
  markdownH6: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    margin: `${spacing[2]} 0 ${spacing[1]} 0`,
    lineHeight: 1.3,
    color: colors.fg.secondary,
  },

  // Blockquote
  markdownBlockquote: {
    margin: `${spacing[3]} 0`,
    paddingLeft: spacing[4],
    borderLeft: `3px solid ${colors.border.default}`,
    color: colors.fg.secondary,
    fontStyle: 'italic',
  },

  // Horizontal rule
  markdownHr: {
    margin: `${spacing[4]} 0`,
    border: 'none',
    borderTop: `1px solid ${colors.border.muted}`,
  },

  // Tables (GFM feature)
  markdownTableWrapper: {
    overflowX: 'auto',
    margin: `${spacing[3]} 0`,
  },
  markdownTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: typography.sizes.sm,
  },
  markdownThead: {
    backgroundColor: colors.bg.inset,
    borderBottom: `2px solid ${colors.border.default}`,
  },
  markdownTr: {
    borderBottom: `1px solid ${colors.border.muted}`,
  },
  markdownTh: {
    padding: `${spacing[2]} ${spacing[3]}`,
    textAlign: 'left',
    fontWeight: typography.weights.bold,
    color: colors.fg.primary,
  },
  markdownTd: {
    padding: `${spacing[2]} ${spacing[3]}`,
    color: colors.fg.primary,
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
    marginTop: spacing[0],
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
    fontSize: typography.sizes.xs,
    color: colors.fg.tertiary,
    fontFamily: typography.fonts.body,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  attachmentTextBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[1]} ${spacing[2]}`,
    backgroundColor: colors.bg.inset,
    border: `1px solid ${colors.border.default}`,
    borderRadius: effects.border.radius.default,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
  } as React.CSSProperties,

  attachmentTextName: {
    color: colors.fg.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200,
  } as React.CSSProperties,

  citations: {
    marginTop: '6px',
    borderTop: `1px solid ${colors.border.muted}`,
    paddingTop: '6px',
  },

  citationsEmpty: {
    marginTop: '6px',
    fontSize: typography.sizes.xs,
    color: colors.fg.quaternary,
    fontFamily: typography.fonts.body,
  },

  citationsTitle: {
    fontSize: typography.sizes.xs,
    color: colors.fg.quaternary,
    fontFamily: typography.fonts.body,
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },

  citationsList: {
    margin: 0,
    paddingLeft: spacing[3],
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  } as React.CSSProperties,

  citationItem: {
    fontSize: typography.sizes.xs,
    color: colors.fg.secondary,
    fontFamily: typography.fonts.body,
  },

  citationLink: {
    color: colors.accent.primary,
    textDecoration: 'none',
    wordBreak: 'break-word',
    cursor: 'pointer',
  },
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
