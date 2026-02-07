'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Send, Square, AlertCircle, Settings, Paperclip, X, Image as ImageIcon } from 'lucide-react';

import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { useCanvasStore } from '@/stores/canvas-store';
import type { MessageAttachment } from '@/types';

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
  /** Input value from useChat */
  input?: string;
  /** Set input value from useChat */
  setInput?: (value: string) => void;
  /** Submit handler from useChat */
  onSubmit?: (e: React.FormEvent) => void;
  /** Whether AI is currently streaming */
  isStreaming?: boolean;
  /** Stop streaming handler */
  onStop?: () => void;
  /** Whether any API key is configured */
  hasApiKey?: boolean;
  /** Error from chat */
  error?: Error | null;
  /** Whether current model supports vision */
  supportsVision?: boolean;
  /** Current attachments */
  attachments?: MessageAttachment[];
  /** Callback when attachments change */
  onAttachmentsChange?: (attachments: MessageAttachment[]) => void;
}

// Vision support constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ATTACHMENTS = 3;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function MessageInput({ 
  conversationId,
  input: externalInput,
  setInput: externalSetInput,
  onSubmit,
  isStreaming = false,
  onStop,
  hasApiKey = true,
  error,
  supportsVision = false,
  attachments = [],
  onAttachmentsChange,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  
  // Store actions - fallback for when not using useChat
  const sendMessage = useCanvasStore((s) => s.sendMessage);
  const setDraftMessage = useCanvasStore((s) => s.setDraftMessage);
  
  // Use controlled input from useChat, or fallback to draft
  const inputValue = externalInput ?? '';
  
  // Load draft when conversation changes (only when not using external input)
  useEffect(() => {
    if (externalSetInput) {
      // When using useChat, sync draft to external input
      const draft = useCanvasStore.getState().getDraftMessage(conversationId);
      if (draft) {
        externalSetInput(draft);
      }
    }
    
    // Auto-focus the textarea
    if (textareaRef.current && !isStreaming) {
      textareaRef.current.focus();
    }
  }, [conversationId, externalSetInput, isStreaming]);

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
    
    if (externalSetInput) {
      externalSetInput(value);
    }
    
    // Also save to draft for persistence
    setDraftMessage(conversationId, value);
  }, [conversationId, setDraftMessage, externalSetInput]);

  // File attachment handling
  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    setAttachmentError(null);
    
    const currentCount = attachments.length;
    const remaining = MAX_ATTACHMENTS - currentCount;
    
    if (files.length > remaining) {
      setAttachmentError(`Maximum ${MAX_ATTACHMENTS} images per message.`);
      return;
    }
    
    const newAttachments: MessageAttachment[] = [];
    
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setAttachmentError(`Unsupported format: ${file.name}. Use PNG, JPEG, WebP, or GIF.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setAttachmentError(`${file.name} exceeds 5MB limit.`);
        return;
      }
    }
    
    // Convert files to base64 data URLs
    const readers = files.map(file => {
      return new Promise<MessageAttachment>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            contentType: file.type,
            name: file.name,
            url: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      });
    });
    
    Promise.all(readers).then((results) => {
      onAttachmentsChange?.([...attachments, ...results]);
    });
    
    // Reset input so re-selecting same file works
    e.target.value = '';
  }, [attachments, onAttachmentsChange]);

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    onAttachmentsChange?.(attachments.filter(a => a.id !== attachmentId));
  }, [attachments, onAttachmentsChange]);

  // Handle send message
  const handleSend = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Allow sending if there's text OR attachments (image-only messages are valid)
    const hasContent = inputValue.trim() || attachments.length > 0;
    if (!hasContent || isStreaming) return;

    // Use text content or a placeholder for image-only messages
    const messageContent = inputValue.trim() || (attachments.length > 0 ? '[Image]' : '');

    if (onSubmit) {
      // Use useChat's submit
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      
      // First, add user message to store (with attachments if any)
      await sendMessage(messageContent, attachments.length > 0 ? attachments : undefined);
      
      // Then trigger AI response via useChat
      onSubmit(fakeEvent);
      
      // Clear draft and attachments
      setDraftMessage(conversationId, '');
      onAttachmentsChange?.([]);
    } else {
      // Fallback: just use store
      await sendMessage(messageContent, attachments.length > 0 ? attachments : undefined);
      setDraftMessage(conversationId, '');
      onAttachmentsChange?.([]);
    }
    
    // Refocus textarea after send
    textareaRef.current?.focus();
  }, [inputValue, isStreaming, onSubmit, sendMessage, conversationId, setDraftMessage, attachments, onAttachmentsChange]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Determine button state
  const canSend = (inputValue.trim() || attachments.length > 0) && !isStreaming && hasApiKey;

  return (
    <div style={inputStyles.container}>
      {/* Error banner */}
      {error && (
        <div style={inputStyles.errorBanner}>
          <AlertCircle size={14} />
          <span>{error.message || 'An error occurred'}</span>
        </div>
      )}

      {/* Attachment error banner */}
      {attachmentError && (
        <div style={inputStyles.errorBanner}>
          <AlertCircle size={14} />
          <span>{attachmentError}</span>
          <button
            onClick={() => setAttachmentError(null)}
            style={{ marginLeft: 'auto', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit' }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* No API key warning */}
      {!hasApiKey && (
        <div style={inputStyles.warningBanner}>
          <Settings size={14} />
          <span>Configure an API key in Settings to chat with AI</span>
        </div>
      )}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div style={inputStyles.attachmentPreview}>
          {attachments.map(att => (
            <div key={att.id} style={inputStyles.attachmentThumb}>
              <img
                src={att.url}
                alt={att.name}
                style={inputStyles.attachmentImg}
              />
              <button
                onClick={() => handleRemoveAttachment(att.id)}
                style={inputStyles.attachmentRemove}
                title="Remove"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <form onSubmit={handleSend} style={inputStyles.inputWrapper}>
        {/* Attachment button */}
        {supportsVision && (
          <button
            type="button"
            onClick={handleFileSelect}
            disabled={isStreaming || !hasApiKey || attachments.length >= MAX_ATTACHMENTS}
            style={{
              ...inputStyles.attachButton,
              opacity: (!hasApiKey || attachments.length >= MAX_ATTACHMENTS) ? 0.4 : 1,
              cursor: (!hasApiKey || attachments.length >= MAX_ATTACHMENTS) ? 'not-allowed' : 'pointer',
            }}
            title={attachments.length >= MAX_ATTACHMENTS ? `Max ${MAX_ATTACHMENTS} images` : 'Attach image'}
            aria-label="Attach image"
          >
            <Paperclip size={16} />
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={hasApiKey ? "Type a message... (Ctrl+Enter to send)" : "Configure API key to start chatting..."}
          style={{
            ...inputStyles.textarea,
            opacity: !hasApiKey ? 0.6 : 1,
          }}
          disabled={isStreaming || !hasApiKey}
          aria-label="Message input"
        />
        
        {/* Stop button during streaming */}
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            style={inputStyles.stopButton}
            title="Stop generating"
            aria-label="Stop generating"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            style={{
              ...inputStyles.sendButton,
              opacity: canSend ? 1 : 0.5,
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
            title="Send message (Ctrl+Enter)"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        )}
      </form>
      
      {/* Keyboard hint */}
      <div style={inputStyles.hint}>
        {isStreaming ? (
          <span style={{ color: colors.violet.primary }}>AI is responding...</span>
        ) : (
          <span>Press <kbd style={inputStyles.kbd}>Ctrl</kbd> + <kbd style={inputStyles.kbd}>Enter</kbd> to send</span>
        )}
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

  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    marginBottom: spacing[2],
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: effects.border.radius.default,
    color: '#ef4444',
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
  },

  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    marginBottom: spacing[2],
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: effects.border.radius.default,
    color: colors.amber.primary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
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

  stopButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    backgroundColor: '#ef4444',
    border: 'none',
    borderRadius: effects.border.radius.default,
    color: colors.contrast.white,
    cursor: 'pointer',
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

  attachButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    backgroundColor: 'transparent',
    border: `1px solid rgba(99, 102, 241, 0.3)`,
    borderRadius: effects.border.radius.default,
    color: colors.contrast.gray,
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },

  attachmentPreview: {
    display: 'flex',
    gap: spacing[2],
    marginBottom: spacing[2],
    flexWrap: 'wrap',
  } as React.CSSProperties,

  attachmentThumb: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: effects.border.radius.default,
    overflow: 'hidden',
    border: `1px solid rgba(99, 102, 241, 0.3)`,
  } as React.CSSProperties,

  attachmentImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as React.CSSProperties,

  attachmentRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    border: 'none',
    borderRadius: '50%',
    color: colors.contrast.white,
    cursor: 'pointer',
    transition: 'background 0.15s',
  } as React.CSSProperties,
};

export default MessageInput;
