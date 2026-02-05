'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';

import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { useCanvasStore } from '@/stores/canvas-store';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_INPUT_HEIGHT = 80;
const MAX_INPUT_HEIGHT = 200;

// =============================================================================
// MESSAGE INPUT COMPONENT
// =============================================================================

interface MessageInputProps {
  conversationId: string;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Store actions
  const sendMessage = useCanvasStore((s) => s.sendMessage);
  const setDraftMessage = useCanvasStore((s) => s.setDraftMessage);
  
  // Local state for input value (synced with drafts on mount/switch)
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Load draft when conversation changes
  useEffect(() => {
    // Use getState() to avoid creating new function reference on each render
    const draft = useCanvasStore.getState().getDraftMessage(conversationId);
    setInputValue(draft);
    
    // Auto-focus the textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [conversationId]);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height within bounds
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, scrollHeight));
    textarea.style.height = `${newHeight}px`;
  }, []);

  // Adjust height when content changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    // Save draft immediately for persistence when switching conversations
    setDraftMessage(conversationId, value);
  }, [conversationId, setDraftMessage]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(inputValue);
      setInputValue('');
      // Clear draft after successful send
      setDraftMessage(conversationId, '');
    } finally {
      setIsSending(false);
      // Refocus textarea after send
      textareaRef.current?.focus();
    }
  }, [inputValue, isSending, sendMessage, conversationId, setDraftMessage]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div style={inputStyles.container}>
      <div style={inputStyles.inputWrapper}>
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Ctrl+Enter to send)"
          style={inputStyles.textarea}
          disabled={isSending}
          aria-label="Message input"
        />
        
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isSending}
          style={{
            ...inputStyles.sendButton,
            opacity: !inputValue.trim() || isSending ? 0.5 : 1,
            cursor: !inputValue.trim() || isSending ? 'not-allowed' : 'pointer',
          }}
          title="Send message (Ctrl+Enter)"
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>
      
      {/* Keyboard hint */}
      <div style={inputStyles.hint}>
        <span>Press <kbd style={inputStyles.kbd}>Ctrl</kbd> + <kbd style={inputStyles.kbd}>Enter</kbd> to send</span>
      </div>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const inputStyles: Record<string, React.CSSProperties> = {
  container: {
    padding: spacing[3],
    borderTop: `1px solid rgba(99, 102, 241, 0.2)`,
    backgroundColor: colors.navy.dark,
    flexShrink: 0,
  },

  inputWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: spacing[2],
    backgroundColor: colors.navy.light,
    borderRadius: effects.border.radius.default,
    border: `1px solid rgba(99, 102, 241, 0.3)`,
    padding: spacing[2],
    transition: 'border-color 0.15s ease',
  },

  textarea: {
    flex: 1,
    minHeight: MIN_INPUT_HEIGHT,
    maxHeight: MAX_INPUT_HEIGHT,
    resize: 'none',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: colors.contrast.white,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    lineHeight: typography.lineHeights.relaxed,
    padding: spacing[1],
    // Discrete scrollbar
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(156, 163, 175, 0.3) transparent',
  } as React.CSSProperties,

  sendButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    backgroundColor: colors.amber.primary,
    border: 'none',
    borderRadius: effects.border.radius.default,
    color: colors.navy.dark,
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },

  hint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[1],
    marginTop: spacing[1],
    fontSize: typography.sizes.xs,
    color: colors.contrast.grayDark,
    fontFamily: typography.fonts.body,
  },

  kbd: {
    display: 'inline-block',
    padding: `1px ${spacing[1]}`,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.code,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: '3px',
    border: `1px solid rgba(99, 102, 241, 0.3)`,
  },
};

export default MessageInput;
