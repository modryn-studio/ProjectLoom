'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, GitBranch, MessageSquare, FileText } from 'lucide-react';

import { useCanvasStore } from '@/stores/canvas-store';
import { colors, spacing, effects, typography } from '@/lib/design-tokens';
import type { InheritanceMode, Message, Conversation } from '@/types';

// =============================================================================
// STYLES
// =============================================================================

const containerStyles: React.CSSProperties = {
  backgroundColor: colors.navy.light,
  borderBottom: `1px solid rgba(99, 102, 241, 0.2)`,
  borderRadius: effects.border.radius.default,
  overflow: 'hidden',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing[2]} ${spacing[3]}`,
  cursor: 'pointer',
};

const contentStyles: React.CSSProperties = {
  padding: `0 ${spacing[3]} ${spacing[3]}`,
};

const badgeStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: `2px ${spacing[1]}`,
  borderRadius: effects.border.radius.default,
  fontSize: typography.sizes.xs,
  fontFamily: typography.fonts.body,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getModeLabel(mode: InheritanceMode): string {
  switch (mode) {
    case 'full': return 'Full Context';
    case 'summary': return 'Summary';
    case 'custom': return 'Custom Selection';
    default: return mode;
  }
}

function getModeColor(mode: InheritanceMode): string {
  switch (mode) {
    case 'full': return colors.semantic.success;
    case 'summary': return colors.amber.primary;
    case 'custom': return colors.violet.primary;
    default: return colors.contrast.grayDark;
  }
}

// =============================================================================
// INHERITED CONTEXT PANEL COMPONENT (v4 - Card-Level Branching)
// =============================================================================

/**
 * InheritedContextPanel - v4 Version
 * 
 * In v4, branching happens at the card level, not canvas level.
 * This panel shows inherited context for cards that have parent cards.
 */
export function InheritedContextPanel() {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get current workspace and selected node to find inherited context
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const conversations = useCanvasStore((s) => s.conversations);
  
  // Get the first selected conversation that has inherited context
  const selectedConversation = useMemo<Conversation | null>(() => {
    const selectedIds = Array.from(selectedNodeIds);
    if (selectedIds.length === 0) return null;
    
    const conv = conversations.get(selectedIds[0]);
    if (!conv) return null;
    
    // Check if this conversation has any inherited context
    if (conv.parentCardIds.length === 0) return null;
    
    return conv;
  }, [selectedNodeIds, conversations]);

  // Get parent conversation title
  const parentTitle = useMemo(() => {
    if (!selectedConversation || selectedConversation.parentCardIds.length === 0) {
      return 'Parent Card';
    }
    const parentId = selectedConversation.parentCardIds[0];
    const parent = conversations.get(parentId);
    return parent?.metadata.title || 'Parent Card';
  }, [selectedConversation, conversations]);

  // Get inherited messages from the first parent
  const inheritedContext = useMemo(() => {
    if (!selectedConversation) return null;
    
    const firstParentId = selectedConversation.parentCardIds[0];
    if (!firstParentId) return null;
    
    return selectedConversation.inheritedContext[firstParentId];
  }, [selectedConversation]);

  // Don't render if no inherited context
  if (!selectedConversation || !inheritedContext) {
    return null;
  }

  const inheritedMessages: Message[] = inheritedContext.messages || [];
  const inheritanceMode: InheritanceMode = inheritedContext.mode;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      style={containerStyles}
    >
      {/* Header - always visible */}
      <div 
        style={headerStyles}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <GitBranch size={16} color={colors.amber.primary} />
          <span style={{ 
            fontSize: typography.sizes.sm, 
            fontWeight: 500,
            color: colors.contrast.white,
            fontFamily: typography.fonts.body,
          }}>
            Inherited from "{parentTitle}"
          </span>

          {/* Mode badge */}
          <span style={{
            ...badgeStyles,
            backgroundColor: `${getModeColor(inheritanceMode)}20`,
            color: getModeColor(inheritanceMode),
          }}>
            {getModeLabel(inheritanceMode)}
          </span>

          {/* Message count badge */}
          <span style={{
            ...badgeStyles,
            backgroundColor: colors.navy.dark,
            color: colors.contrast.grayDark,
          }}>
            <MessageSquare size={12} />
            {inheritedMessages.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          {/* Expand/collapse toggle */}
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              background: 'transparent',
              border: 'none',
              color: colors.contrast.grayDark,
              cursor: 'pointer',
            }}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={contentStyles}>
              {/* Inherited messages preview */}
              <div>
                <div style={{ 
                  fontSize: typography.sizes.xs, 
                  color: colors.contrast.grayDark,
                  marginBottom: spacing[1],
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: typography.fonts.body,
                }}>
                  <FileText size={12} />
                  Inherited messages ({inheritedMessages.length})
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing[1],
                  maxHeight: 200,
                  overflowY: 'auto',
                  padding: spacing[2],
                  backgroundColor: colors.navy.dark,
                  borderRadius: effects.border.radius.default,
                }}>
                  {inheritedMessages.slice(0, 5).map((msg: Message) => (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        gap: spacing[2],
                        padding: spacing[1],
                        backgroundColor: msg.role === 'user' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        borderRadius: effects.border.radius.default,
                      }}
                    >
                      <span style={{ 
                        flexShrink: 0,
                        width: 60,
                        fontSize: typography.sizes.xs,
                        color: msg.role === 'user' ? colors.violet.primary : colors.amber.primary,
                        fontWeight: 500,
                        fontFamily: typography.fonts.body,
                      }}>
                        {msg.role === 'user' ? 'You' : 'Assistant'}
                      </span>
                      <span style={{
                        fontSize: typography.sizes.xs,
                        color: colors.contrast.gray,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: typography.fonts.body,
                      }}>
                        {msg.content.substring(0, 100)}
                        {msg.content.length > 100 && '...'}
                      </span>
                    </div>
                  ))}
                  {inheritedMessages.length > 5 && (
                    <div style={{
                      fontSize: typography.sizes.xs,
                      color: colors.contrast.grayDark,
                      textAlign: 'center',
                      padding: spacing[1],
                      fontFamily: typography.fonts.body,
                    }}>
                      +{inheritedMessages.length - 5} more messages
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <div style={{
                marginTop: spacing[2],
                fontSize: typography.sizes.xs,
                color: colors.contrast.grayDark,
                fontFamily: typography.fonts.body,
              }}>
                Inherited: {new Date(inheritedContext.timestamp).toLocaleString()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default InheritedContextPanel;
