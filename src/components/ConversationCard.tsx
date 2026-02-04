'use client';

import React, { memo, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';

import { colors, typography, spacing, effects, animation, card } from '@/lib/design-tokens';
import { getCardZIndex } from '@/constants/zIndex';
import { getTextStyles } from '@/lib/language-utils';
import { useCanvasStore, selectIsAnyNodeDragging } from '@/stores/canvas-store';
import { usePreferencesStore, selectBranchingPreferences, selectUIPreferences } from '@/stores/preferences-store';
import { ContextMenu, useContextMenu, getConversationMenuItems } from './ContextMenu';
import { InlineBranchPanel } from './InlineBranchPanel';
import type { ConversationNodeData, Message } from '@/types';
import { GitBranch, Zap } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type ConversationCardNode = Node<ConversationNodeData>;
type ConversationCardProps = NodeProps<ConversationCardNode>;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format timestamp to relative or absolute time
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Truncate text to max characters with ellipsis
 */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trim() + '...';
}

/**
 * Get first non-empty message content
 */
function getPreviewContent(messages: Message[]): string {
  const firstUserMessage = messages.find((m) => m.role === 'user');
  const content = firstUserMessage?.content || messages[0]?.content || 'Empty conversation';
  return truncateText(content, card.preview.maxChars);
}

// =============================================================================
// CONVERSATION CARD COMPONENT
// =============================================================================

/**
 * Conversation Card Node for React Flow
 *
 * Features:
 * - Inline expansion with Framer Motion layout animations
 * - Language-aware font rendering
 * - Z-index elevation on expand
 * - Hover lift + glow effects
 * - Timestamp and message count badge
 */
function ConversationCardComponent({
  data,
  selected,
  dragging,
}: ConversationCardProps) {
  const conversation = data.conversation;
  const isExpanded = data.isExpanded;
  const isSelected = data.isSelected;
  const messages = conversation.content;
  const metadata = conversation.metadata;
  
  // v4: Detect merge and branch state for visual styling
  const isMergeNode = conversation.isMergeNode;
  const isBranchedCard = conversation.parentCardIds.length > 0 && !isMergeNode;
  const mergeSourceCount = isMergeNode ? conversation.parentCardIds.length : 0;
  const isComplexMerge = mergeSourceCount >= 3; // WARNING_THRESHOLD
  const isAtMaxMerge = mergeSourceCount >= 5; // MAX_PARENTS

  // Context menu state
  const { isOpen: isContextMenuOpen, position: menuPosition, openMenu, closeMenu, dynamicItems } = useContextMenu();

  // Store actions
  const openBranchDialog = useCanvasStore((s) => s.openBranchDialog);
  const branchFromMessage = useCanvasStore((s) => s.branchFromMessage);
  const deleteConversation = useCanvasStore((s) => s.deleteConversation);
  const toggleExpanded = useCanvasStore((s) => s.toggleExpanded);
  
  // Check if any node is being dragged (to disable hover effects)
  const isAnyNodeDragging = useCanvasStore(selectIsAnyNodeDragging);

  // Branching preferences
  const branchingPrefs = usePreferencesStore(selectBranchingPreferences);
  const uiPrefs = usePreferencesStore(selectUIPreferences);

  // Inline branch panel state (mouse workflow)
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null);
  const [pendingBranchMessageIndex, setPendingBranchMessageIndex] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Handle branch icon click - show inline panel
  const handleBranchClick = useCallback((messageIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingBranchMessageIndex(messageIndex);
  }, []);

  // Close inline branch panel
  const handleCloseBranchPanel = useCallback(() => {
    setPendingBranchMessageIndex(null);
  }, []);

  // Handle branch completion
  const handleBranchComplete = useCallback(() => {
    setPendingBranchMessageIndex(null);
    // Optionally select the new card or give feedback
  }, []);

  // Get text styles for language-aware rendering
  const textStyles = useMemo(
    () => getTextStyles(messages[0]?.content || ''),
    [messages]
  );

  // Calculate z-index based on state
  const cardZIndex = getCardZIndex({
    isExpanded,
    isDragging: Boolean(dragging),
    isHovered: false, // Handled by CSS :hover
    isSelected: isSelected || selected,
  });

  // Platform detection (cached at module level to avoid re-computation)
  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac/.test(navigator.platform);
  }, []);

  // Preview content
  const previewContent = useMemo(() => getPreviewContent(messages), [messages]);

  // Context menu items (excluding branch - it opens dialog directly)
  const menuItems = useMemo(() => getConversationMenuItems(conversation.id, {
    onDelete: () => {
      // Check if confirmation is required
      if (uiPrefs.confirmOnDelete) {
        if (window.confirm('Delete this conversation?')) {
          deleteConversation(conversation.id);
        }
      } else {
        deleteConversation(conversation.id);
      }
    },
    onExpand: () => toggleExpanded(conversation.id),
  }, isMac), [conversation.id, deleteConversation, toggleExpanded, isMac, uiPrefs.confirmOnDelete]);

  // Handle right-click: Check if clicked item is "Branch from here"
  // If so, open dialog directly (centered modal per phase_2.md spec)
  // Otherwise show context menu for other actions
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Handle branch action based on preferences
    const handleBranchAction = () => {
      closeMenu();
      
      // Check preference: should we show dialog or create instantly?
      if (branchingPrefs.alwaysAskOnBranch) {
        // Show dialog for user to configure
        openBranchDialog(conversation.id);
      } else {
        // Create branch instantly with default settings using v4 API
        branchFromMessage({
          sourceCardId: conversation.id,
          messageIndex: messages.length - 1,
          inheritanceMode: branchingPrefs.defaultInheritanceMode,
          customMessageIds: undefined,
          branchReason: 'Quick branch',
        });
      }
    };
    
    // Open context menu with Branch option that respects preferences
    const menuItemsWithBranch = [
      {
        id: 'branch',
        label: 'Branch from here',
        icon: <GitBranch size={14} />,
        shortcut: isMac ? '⌘B' : 'Ctrl+B',
        onClick: handleBranchAction,
      },
      ...menuItems,
    ];
    
    openMenu(e, menuItemsWithBranch);
  };

  return (
    <>
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle}
      />

      {/* Card container with layout animation */}
      <motion.div
        ref={cardRef}
        initial={false}
        animate={{
          scale: dragging ? 1.02 : 1,
          width: isExpanded ? card.size.maxWidth : card.size.minWidth,
          minHeight: isExpanded ? card.size.expandedMinHeight : card.size.collapsedHeight,
          maxHeight: isExpanded ? card.size.expandedMaxHeight : card.size.collapsedHeight,
          boxShadow: isExpanded
            ? effects.shadow.cardExpanded
            : selected || isSelected
            ? effects.glow.cardActive
            : effects.shadow.card,
        }}
        whileHover={
          // Disable hover effect when ANY node is being dragged
          isAnyNodeDragging ? {} : {
            y: card.hover.lift,
            boxShadow: effects.glow.cardHover,
          }
        }
        transition={{
          // Use smooth easing for dimensions instead of spring to prevent getting stuck
          width: { duration: 0.25, ease: 'easeInOut' },
          minHeight: { duration: 0.25, ease: 'easeInOut' },
          maxHeight: { duration: 0.25, ease: 'easeInOut' },
          scale: { duration: 0.2, ease: 'easeOut' },
          boxShadow: { duration: 0.2, ease: 'easeInOut' },
          y: { duration: 0.15, ease: 'easeOut' },
        }}
        style={{
          ...cardStyles.container,
          zIndex: cardZIndex,
          // v4: Visual indicators for merge nodes and branched cards
          borderColor: isMergeNode
            ? (isAtMaxMerge 
                ? colors.semantic.error     // Red at max (5 parents)
                : isComplexMerge 
                  ? colors.semantic.warning  // Amber warning at 3+ parents
                  : colors.semantic.success) // Green for healthy merge (2 parents)
            : isBranchedCard
            ? colors.amber.dark        // Amber for branched cards
            : isSelected || selected
            ? colors.amber.primary
            : isExpanded
            ? colors.violet.primary
            : 'rgba(102, 126, 234, 0.4)',
          borderWidth: isMergeNode || isBranchedCard ? 2 : 1,
        }}
        onContextMenu={handleContextMenu}
      >
        {/* Header: Title + Badge + Merge/Branch Indicator */}
        <div style={cardStyles.header}>
          {/* Merge indicator icon */}
          {isMergeNode && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                marginRight: spacing[1],
              }}
              title={`Merged from ${mergeSourceCount} cards`}
            >
              <Zap 
                size={14} 
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
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                marginRight: spacing[1],
              }}
              title="Branched card"
            >
              <GitBranch size={14} color={colors.amber.dark} />
            </span>
          )}
          <h3 style={cardStyles.title}>{metadata.title}</h3>
          {/* Merge source count badge with warning/error colors */}
          {isMergeNode && mergeSourceCount > 0 && (
            <span
              style={{
                fontSize: typography.sizes.xs,
                color: isAtMaxMerge 
                  ? colors.semantic.error 
                  : isComplexMerge 
                    ? colors.semantic.warning 
                    : colors.semantic.success,
                backgroundColor: isAtMaxMerge
                  ? `${colors.semantic.error}20`
                  : isComplexMerge
                    ? `${colors.semantic.warning}20`
                    : `${colors.semantic.success}20`,
                padding: `2px ${spacing[1]}`,
                borderRadius: effects.border.radius.default,
                marginLeft: 'auto',
                marginRight: spacing[1],
              }}
              title={isAtMaxMerge
                ? `⚠️ Maximum sources (${mergeSourceCount}/5) - Consider hierarchical merging`
                : isComplexMerge
                  ? `⚠️ Complex merge (${mergeSourceCount} sources) - May reduce AI quality`
                  : `Merged from ${mergeSourceCount} cards`}
            >
              {mergeSourceCount}
              {isComplexMerge && ' ⚠️'}
            </span>
          )}
          <span style={cardStyles.badge}>
            {metadata.messageCount} msgs
          </span>
        </div>

        {/* Content */}
        <div
          style={{
            ...cardStyles.content,
            fontFamily: textStyles.fontFamily,
            direction: textStyles.direction,
            textAlign: textStyles.textAlign,
          }}
        >
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div
                key="expanded"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={animation.spring.gentle}
                style={cardStyles.expandedContent}
              >
                {/* Full message list with branch icons */}
                {messages.map((message: Message, index: number) => (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                      width: '100%',
                      position: 'relative',
                    }}
                    onMouseEnter={() => setHoveredMessageIndex(index)}
                    onMouseLeave={() => setHoveredMessageIndex(null)}
                  >
                    <div
                      style={{
                        ...cardStyles.message,
                        backgroundColor:
                          message.role === 'user'
                            ? colors.navy.dark
                            : 'transparent',
                        width: message.role === 'user' ? '80%' : '100%',
                        marginLeft: message.role === 'user' ? 'auto' : '0',
                      }}
                    >
                      <div
                        style={{
                          ...cardStyles.messageContent,
                          fontFamily: textStyles.fontFamily,
                          direction: textStyles.direction,
                        }}
                      >
                        {message.content.slice(0, 500)}
                        {message.content.length > 500 && '...'}
                      </div>
                    </div>
                    
                    {/* Branch icon - appears on hover */}
                    <AnimatePresence>
                      {hoveredMessageIndex === index && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.1 }}
                          onClick={(e) => handleBranchClick(index, e)}
                          style={{
                            ...cardStyles.branchIcon,
                            [message.role === 'user' ? 'left' : 'right']: '-28px',
                          }}
                          title={`Branch from message ${index + 1}`}
                        >
                          <GitBranch size={14} />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={animation.spring.gentle}
                style={cardStyles.preview}
              >
                <p style={cardStyles.previewText}>{previewContent}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer: Timestamp */}
        <div style={cardStyles.footer}>
          <span style={cardStyles.timestamp}>
            {formatTimestamp(metadata.createdAt)}
          </span>
        </div>
      </motion.div>

      {/* Context Menu */}
      <ContextMenu
        isOpen={isContextMenuOpen}
        position={menuPosition}
        onClose={closeMenu}
        items={dynamicItems.length > 0 ? dynamicItems : menuItems}
      />

      {/* Inline Branch Panel (mouse workflow) */}
      {pendingBranchMessageIndex !== null && (
        <InlineBranchPanel
          parentCardId={conversation.id}
          messageIndex={pendingBranchMessageIndex}
          totalMessages={messages.length}
          position="right"
          onClose={handleCloseBranchPanel}
          onComplete={handleBranchComplete}
        />
      )}
    </>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const handleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  backgroundColor: colors.violet.primary,
  border: `2px solid ${colors.navy.bg}`,
};

const cardStyles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: colors.navy.light,
    borderRadius: effects.border.radius.md,
    border: '1px solid rgba(102, 126, 234, 0.4)',  // Consistent border width
    padding: spacing.card.padding,
    cursor: 'grab',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.card.gap,
    willChange: 'border-color',  // Optimize border transitions
  },

  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },

  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#e4e4f0',
    fontFamily: typography.fonts.heading,
    margin: 0,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },

  badge: {
    height: card.badge.height,
    fontSize: card.badge.fontSize,
    padding: card.badge.padding,
    borderRadius: card.badge.borderRadius,
    backgroundColor: card.badge.backgroundColor,
    color: card.badge.color,
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: typography.fonts.code,
  },

  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.contrast.grayDark,
    fontFamily: typography.fonts.body,
  },

  content: {
    flex: 1,
    overflow: 'visible',  // Allow text to show fully
    minHeight: '40px',
  },

  preview: {
    paddingTop: spacing[2],
    paddingBottom: spacing[1],  // Prevent bottom clipping
  },

  previewText: {
    fontSize: '13px',
    color: '#9ca3af',
    lineHeight: 1.5,  // Slightly more line height
    margin: 0,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: card.preview.maxLines,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  },

  expandedContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
    maxHeight: '480px',
    overflowY: 'auto',
    paddingRight: spacing[1],
    // Discrete scrollbar
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(156, 163, 175, 0.3) transparent',
  } as React.CSSProperties,

  message: {
    padding: spacing[3],
    borderRadius: effects.border.radius.default,
  },

  messageContent: {
    fontSize: typography.sizes.sm,
    color: colors.contrast.white,
    lineHeight: typography.lineHeights.relaxed,
    fontFamily: typography.fonts.body,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  branchIcon: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    borderRadius: '50%',
    color: '#f59e0b',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as React.CSSProperties,

  footer: {
    marginTop: 'auto',
  },
};

// Memoize for performance
export const ConversationCard = memo(ConversationCardComponent);
export default ConversationCard;
