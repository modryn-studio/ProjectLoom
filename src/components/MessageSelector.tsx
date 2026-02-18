'use client';

import React, { useMemo, useCallback } from 'react';
import { Check, Code, User, Bot } from 'lucide-react';
import { motion } from 'framer-motion';

import { colors, spacing, effects, typography } from '@/lib/design-tokens';
import { estimateTokens } from '@/lib/context-utils';
import type { Message } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface MessageSelectorProps {
  messages: Message[];
  selectedIds: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

// =============================================================================
// STYLES
// =============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[2],
};

const quickActionsStyles: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  marginBottom: spacing[1],
};

const quickButtonStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[1],
  padding: `${spacing[1]} ${spacing[2]}`,
  backgroundColor: colors.bg.inset,
  border: `1px solid var(--border-primary)`,
  borderRadius: effects.border.radius.default,
  color: colors.fg.tertiary,
  fontSize: typography.sizes.xs,
  fontFamily: typography.fonts.body,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const messageListStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[1],
  padding: spacing[1],
  backgroundColor: colors.bg.inset,
  borderRadius: effects.border.radius.default,
  border: `1px solid var(--border-primary)`,
  maxHeight: '300px',
  overflowY: 'auto',
};

const statsStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: typography.sizes.xs,
  color: colors.fg.tertiary,
  fontFamily: typography.fonts.body,
  padding: `${spacing[1]} 0`,
};

// =============================================================================
// QUICK ACTION BUTTONS
// =============================================================================

interface QuickAction {
  label: string;
  action: (messages: Message[]) => string[];
  shortcut?: string;
}

const quickActions: QuickAction[] = [
  {
    label: 'All',
    action: (msgs) => msgs.map(m => m.id),
    shortcut: '⌘A',
  },
  {
    label: 'None',
    action: () => [],
  },
  {
    label: 'Last 5',
    action: (msgs) => msgs.slice(-5).map(m => m.id),
  },
  {
    label: 'Last 10',
    action: (msgs) => msgs.slice(-10).map(m => m.id),
  },
];

// =============================================================================
// MESSAGE ITEM COMPONENT
// =============================================================================

interface MessageItemProps {
  message: Message;
  isSelected: boolean;
  onToggle: () => void;
  index: number;
}

function MessageItem({ message, isSelected, onToggle, index }: MessageItemProps) {
  const isUser = message.role === 'user';
  const hasCode = message.content.includes('```') || message.content.includes('`');
  const isLong = message.content.length > 500;
  
  const preview = useMemo(() => {
    const cleaned = message.content.replace(/```[\s\S]*?```/g, '[code block]');
    return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned;
  }, [message.content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing[2],
        padding: spacing[2],
        backgroundColor: isSelected ? `${colors.accent.primary}10` : 'transparent',
        borderRadius: effects.border.radius.default,
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      }}
    >
      {/* Checkbox */}
      <div
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          borderRadius: 4,
          border: `2px solid ${isSelected ? colors.accent.primary : 'var(--border-primary)'}`,
          backgroundColor: isSelected ? colors.accent.primary : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
          transition: 'all 0.15s ease',
        }}
      >
        {isSelected && <Check size={12} color={colors.bg.inset} strokeWidth={3} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Role and badges */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: spacing[1],
          marginBottom: spacing[1],
        }}>
          <span style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: isUser ? colors.accent.primary : colors.accent.primary,
            fontSize: typography.sizes.xs,
            fontWeight: typography.weights.medium,
            fontFamily: typography.fonts.body,
          }}>
            {isUser ? <User size={12} /> : <Bot size={12} />}
            {isUser ? 'You' : 'Assistant'}
          </span>

          {hasCode && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: '2px 6px',
              backgroundColor: colors.bg.primary,
              borderRadius: 4,
              fontSize: typography.sizes.xs,
              color: colors.fg.tertiary,
              fontFamily: typography.fonts.code,
            }}>
              <Code size={10} />
              code
            </span>
          )}

          {isLong && (
            <span style={{
              padding: '2px 6px',
              backgroundColor: colors.bg.primary,
              borderRadius: 4,
              fontSize: typography.sizes.xs,
              color: colors.fg.tertiary,
              fontFamily: typography.fonts.body,
            }}>
              long
            </span>
          )}
        </div>

        {/* Preview text */}
        <p style={{
          margin: 0,
          fontSize: typography.sizes.xs,
          color: colors.fg.secondary,
          fontFamily: typography.fonts.body,
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {preview}
        </p>
      </div>
    </motion.div>
  );
}

// =============================================================================
// MESSAGE SELECTOR COMPONENT
// =============================================================================

export function MessageSelector({ messages, selectedIds, onSelectionChange }: MessageSelectorProps) {
  // Handle individual message toggle
  const handleToggle = useCallback((id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  }, [selectedIds, onSelectionChange]);

  // Handle quick action
  const handleQuickAction = useCallback((action: QuickAction) => {
    const newIds = action.action(messages);
    onSelectionChange(new Set(newIds));
  }, [messages, onSelectionChange]);

  // Calculate stats
  const stats = useMemo(() => {
    const selectedMessages = messages.filter(m => selectedIds.has(m.id));
    const totalTokens = estimateTokens(selectedMessages);
    return {
      selected: selectedIds.size,
      total: messages.length,
      tokens: totalTokens,
    };
  }, [messages, selectedIds]);

  // Keyboard shortcut handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        handleQuickAction(quickActions[0]); // Select all
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'i') {
        e.preventDefault();
        // Invert selection
        const inverted = messages.filter(m => !selectedIds.has(m.id)).map(m => m.id);
        onSelectionChange(new Set(inverted));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messages, selectedIds, onSelectionChange, handleQuickAction]);

  return (
    <div style={containerStyles}>
      {/* Stats */}
      <div style={statsStyles}>
        <span>
          Selected: <strong>{stats.selected}</strong> of {stats.total} messages
        </span>
        <span>
          ~{stats.tokens.toLocaleString()} tokens
        </span>
      </div>

      {/* Quick Actions */}
      <div style={quickActionsStyles}>
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleQuickAction(action)}
            style={quickButtonStyles}
            title={action.shortcut}
          >
            {action.label}
            {action.shortcut && (
              <span style={{ opacity: 0.6, fontSize: typography.sizes.xs }}>
                {action.shortcut}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div style={messageListStyles}>
        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            isSelected={selectedIds.has(message.id)}
            onToggle={() => handleToggle(message.id)}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

export default MessageSelector;
