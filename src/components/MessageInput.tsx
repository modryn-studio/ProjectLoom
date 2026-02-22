'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Send, Square, AlertCircle, Settings, Paperclip, X, FileText } from 'lucide-react';

import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { useCanvasStore } from '@/stores/canvas-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ModelSelector } from './ModelSelector';
import type { MessageAttachment } from '@/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_INPUT_HEIGHT = 28; // Single line height
const MAX_INPUT_HEIGHT = 200; // Default max height before scrolling

// =============================================================================
// MESSAGE INPUT COMPONENT
// =============================================================================

interface MessageInputProps {
  conversationId: string;
  /** Input value from useChat */
  input?: string;
  /** Set input value from useChat */
  setInput?: (value: string) => void;
  /** Submit handler — passes message text and optional attachments to parent for orchestration */
  onSubmit?: (text: string, attachments?: MessageAttachment[]) => void;
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
  /** Currently selected model ID */
  currentModel?: string | null;
  /** Callback when model is changed */
  onModelChange?: (modelId: string) => void;
  /** Optional max textarea height in pixels */
  maxTextareaHeight?: number;
  /** Whether chat panel is maximized (fullscreen) */
  isMaximized?: boolean;
}

// Attachment support constants
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images
const MAX_TEXT_SIZE = 500 * 1024; // 500KB for text files
const MAX_ATTACHMENTS = 3;
// Use file extensions for better Windows compatibility (MIME types show "Custom Files")
const ACCEPTED_FILE_TYPES = '.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.markdown';
const ACCEPTED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',  // Images
  'text/plain', 'text/markdown', 'text/x-markdown'  // Text files
];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown'];

// Helper to validate file by extension and MIME type
function isAcceptedFile(file: File): boolean {
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  const isValidExtension = ext && [...IMAGE_EXTENSIONS, ...TEXT_EXTENSIONS].includes(ext);
  const isValidMimeType = ACCEPTED_MIME_TYPES.includes(file.type);
  
  // Accept if either extension or MIME type is valid (handles Windows MIME type issues)
  return isValidExtension || isValidMimeType;
}

// Helper to check if file is an image
function isImageFile(file: File): boolean {
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  return file.type.startsWith('image/') || (ext ? IMAGE_EXTENSIONS.includes(ext) : false);
}

// Normalize content type for files where the browser reports empty MIME type (common
// on Windows for .md/.markdown files). Falls back to extension-based detection.
const EXT_TO_MIME: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
};
function normalizeContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
}

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
  currentModel,
  onModelChange,
  maxTextareaHeight,
  isMaximized = false,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  
  // Store actions - fallback for when not using useChat
  const sendMessage = useCanvasStore((s) => s.sendMessage);
  const setDraftMessage = useCanvasStore((s) => s.setDraftMessage);
  
  // Use controlled input from useChat, or fallback to draft
  const inputValue = externalInput ?? '';

  // ── Onboarding auto-typing ──
  const isAutoTyping = useOnboardingStore((s) => s.isAutoTyping);
  const autoTypeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPendingRef = useRef<{ cardId: string; text: string } | null>(null);
  // Stable ref for handleSend so the auto-typing effect can call it
  const handleSendRef = useRef<(() => void) | null>(null);

  const startAutoTypingForPending = useCallback((pending: { cardId: string; text: string } | null) => {
    if (!pending || pending.cardId !== conversationId || !externalSetInput) return;

    if (autoTypeTimerRef.current) {
      clearTimeout(autoTypeTimerRef.current);
      autoTypeTimerRef.current = null;
    }

    // Claim the pending message immediately
    useOnboardingStore.getState().clearPendingMessage();
    useOnboardingStore.getState().setIsAutoTyping(true);

    const text = pending.text;
    let idx = 0;

    const typeNext = () => {
      if (idx <= text.length) {
        externalSetInput(text.slice(0, idx));
        idx++;
        autoTypeTimerRef.current = setTimeout(typeNext, 35 + Math.random() * 20);
      } else {
        // Done typing — auto-send after a brief pause
        autoTypeTimerRef.current = setTimeout(() => {
          useOnboardingStore.getState().setIsAutoTyping(false);
          // Trigger send via form submit
          handleSendRef.current?.();
        }, 400);
      }
    };

    // Small delay before typing starts
    autoTypeTimerRef.current = setTimeout(typeNext, 300);
  }, [conversationId, externalSetInput]);

  useEffect(() => {
    const consumePending = (pending: { cardId: string; text: string } | null) => {
      // Only act when pendingMessage changes
      if (pending === lastPendingRef.current) return;
      lastPendingRef.current = pending;
      startAutoTypingForPending(pending);
    };

    // Handle any pending message that was set while this input was unmounted
    consumePending(useOnboardingStore.getState().pendingMessage);

    const unsub = useOnboardingStore.subscribe(
      (state) => {
        consumePending(state.pendingMessage);
      },
    );

    return () => {
      unsub();
      if (autoTypeTimerRef.current) {
        clearTimeout(autoTypeTimerRef.current);
        autoTypeTimerRef.current = null;
      }
      if (useOnboardingStore.getState().isAutoTyping) {
        useOnboardingStore.getState().setIsAutoTyping(false);
      }
    };
  }, [startAutoTypingForPending]);

  // Load draft when conversation changes (only when not using external input)
  useEffect(() => {
    if (externalSetInput) {
      // When using useChat, sync draft to external input
      const draft = useCanvasStore.getState().getDraftMessage(conversationId);
      if (draft) {
        externalSetInput(draft);
      }
    }
    
    // Auto-focus the textarea on conversation change (not on streaming state change)
    // Skip auto-focus on touch devices to prevent the virtual keyboard from popping up
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (textareaRef.current && !isTouchDevice) {
      textareaRef.current.focus();
    }
  }, [conversationId, externalSetInput]);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height within bounds
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = Math.max(MIN_INPUT_HEIGHT, maxTextareaHeight ?? MAX_INPUT_HEIGHT);
    const newHeight = Math.min(maxHeight, Math.max(MIN_INPUT_HEIGHT, scrollHeight));
    textarea.style.height = `${newHeight}px`;
  }, [maxTextareaHeight]);

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
      setAttachmentError(`Maximum ${MAX_ATTACHMENTS} attachments per message.`);
      return;
    }
    
    // Validate file types and sizes
    for (const file of files) {
      if (!isAcceptedFile(file)) {
        setAttachmentError(`Unsupported format: ${file.name}. Use images (PNG, JPEG, WebP, GIF) or text files (.txt, .md).`);
        return;
      }
      
      const isImage = isImageFile(file);
      const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_TEXT_SIZE;
      const sizeLabel = isImage ? '5MB' : '500KB';
      
      if (file.size > maxSize) {
        setAttachmentError(`${file.name} exceeds ${sizeLabel} limit for ${isImage ? 'images' : 'text files'}.`);
        return;
      }
    }
    
    // Convert files to attachments (different handling for images vs text)
    const readers = files.map(file => {
      return new Promise<MessageAttachment>((resolve, reject) => {
        const isImage = isImageFile(file);
        const reader = new FileReader();
        
        reader.onload = () => {
          if (isImage) {
            // Images: use data URL for display
            resolve({
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              contentType: normalizeContentType(file),
              name: file.name,
              url: reader.result as string,
            });
          } else {
            // Text files: encode as base64 data URL
            const textContent = reader.result as string;
            const base64Content = btoa(unescape(encodeURIComponent(textContent)));
            const contentType = normalizeContentType(file);
            resolve({
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              contentType,
              name: file.name,
              url: `data:${contentType};base64,${base64Content}`,
            });
          }
        };
        
        reader.onerror = () => {
          reject(new Error(`Failed to read file: ${file.name}`));
        };
        
        // Read as appropriate format
        if (isImage) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    });
    
    Promise.all(readers)
      .then((results) => {
        onAttachmentsChange?.([...attachments, ...results]);
      })
      .catch((error) => {
        console.error('[MessageInput] Failed to read file:', error);
        setAttachmentError('Failed to read file. Please try again.');
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

    // If no API key, open the key setup modal via window event instead of silently failing
    if (!hasApiKey) {
      window.dispatchEvent(new Event('projectloom:requestAPIKeySetup'));
      return;
    }

    // Use text content or a placeholder for image-only messages
    const messageContent = inputValue.trim() || (attachments.length > 0 ? '[Image]' : '');

    if (onSubmit) {
      // Let parent (ChatPanel) orchestrate: persist to store + trigger AI request
      // in a single code path to eliminate timing races between dual state systems
      onSubmit(messageContent, attachments.length > 0 ? attachments : undefined);
      
      // Clear draft and attachments
      setDraftMessage(conversationId, '');
      onAttachmentsChange?.([]);
    } else {
      // Fallback: just use store
      await sendMessage(messageContent, attachments.length > 0 ? attachments : undefined);
      setDraftMessage(conversationId, '');
      onAttachmentsChange?.([]);
    }
    
    // Refocus textarea after send (skip on touch devices to avoid keyboard popup)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) {
      textareaRef.current?.focus();
    }
  }, [inputValue, isStreaming, hasApiKey, onSubmit, sendMessage, conversationId, setDraftMessage, attachments, onAttachmentsChange]);

  // Keep handleSendRef in sync for auto-typing callback
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Determine button state — allow sending without a key so handleSend can open the key modal
  const canSend = (inputValue.trim() || attachments.length > 0) && !isStreaming;

  return (
    <div style={inputStyles.container} data-testid="message-input">
      <div style={isMaximized ? inputStyles.maximizedContent : undefined}>
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
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('projectloom:requestAPIKeySetup'))}
          style={{ ...inputStyles.warningBanner, cursor: 'pointer', textAlign: 'left', width: '100%', background: 'none', border: 'none' }}
        >
          <Settings size={14} />
          <span>Add an API key to start chatting →</span>
        </button>
      )}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div style={inputStyles.attachmentPreview}>
          {attachments.map(att => {
            const isImage = att.contentType.startsWith('image/');
            
            if (isImage) {
              // Image thumbnail
              return (
                <div key={att.id} style={inputStyles.attachmentThumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
              );
            } else {
              // Text file badge
              return (
                <div key={att.id} style={inputStyles.attachmentTextBadge}>
                  <FileText size={16} style={{ flexShrink: 0, color: colors.accent.primary }} />
                  <div style={inputStyles.attachmentTextInfo}>
                    <span style={inputStyles.attachmentTextName}>{att.name}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveAttachment(att.id)}
                    style={inputStyles.attachmentTextRemove}
                    title="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            }
          })}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <form onSubmit={handleSend} style={inputStyles.inputWrapper}>
        <div style={inputStyles.inputSurface}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? "Type a message..." : "Type a message and add an API key to send..."}
            className="chat-textarea"
            style={{
              ...inputStyles.textarea,
              maxHeight: maxTextareaHeight ?? MAX_INPUT_HEIGHT,
              opacity: 1,
            }}
            disabled={isStreaming || isAutoTyping}
            aria-label="Message input"
          />

          <div style={inputStyles.inputFooter}>
            <div style={inputStyles.footerLeft}>
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
                  <Paperclip size={14} />
                </button>
              )}

              {/* Model selector */}
              {onModelChange && (
                <div style={inputStyles.modelSelectorWrapper}>
                  <ModelSelector
                    currentModel={currentModel ?? null}
                    onModelChange={onModelChange}
                    hasApiKey={hasApiKey}
                    compact={true}
                  />
                </div>
              )}
            </div>

            <div style={inputStyles.footerRight}>
              {/* Stop button during streaming */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  style={inputStyles.stopButton}
                  title="Stop generating"
                  aria-label="Stop generating"
                >
                  <Square size={14} />
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
                  title="Send message"
                  aria-label="Send message"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const inputStyles: Record<string, React.CSSProperties> = {
  container: {
    padding: spacing[2],
    borderTop: `1px solid ${colors.border.default}`,
    backgroundColor: colors.bg.secondary,
    flexShrink: 0,
  },

  maximizedContent: {
    maxWidth: '900px',
    width: '100%',
    margin: '0 auto',
  },

  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    marginBottom: spacing[2],
    backgroundColor: 'var(--error-bg)',
    border: '1px solid var(--error-border)',
    borderRadius: effects.border.radius.default,
    color: 'var(--error-fg)',
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
  },

  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    marginBottom: spacing[2],
    backgroundColor: 'var(--warning-bg)',
    border: '1px solid var(--warning-border)',
    borderRadius: effects.border.radius.default,
    color: 'var(--warning-fg)',
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
  },

  inputWrapper: {
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
  },

  inputSurface: {
    width: '100%',
    backgroundColor: colors.bg.tertiary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: effects.border.radius.default,
    padding: spacing[2],
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },

  textarea: {
    minHeight: MIN_INPUT_HEIGHT,
    maxHeight: MAX_INPUT_HEIGHT,
    resize: 'none',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: colors.fg.primary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    lineHeight: typography.lineHeights.normal,
    padding: `${spacing[1]} ${spacing[2]}`,
    margin: 0,
    overflowY: 'auto',
    // Hide scrollbar while preserving scroll behavior
    scrollbarWidth: 'none',
  } as React.CSSProperties,

  sendButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: effects.border.radius.sm || '4px',
    color: colors.accent.primary,
    transition: 'color 0.15s ease, opacity 0.15s ease',
    flexShrink: 0,
  },

  stopButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: effects.border.radius.sm || '4px',
    color: 'var(--error-solid)',
    cursor: 'pointer',
    transition: 'color 0.15s ease, opacity 0.15s ease',
    flexShrink: 0,
  },

  attachButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: effects.border.radius.sm || '4px',
    color: colors.fg.tertiary,
    transition: 'color 0.15s ease, opacity 0.15s ease',
    flexShrink: 0,
  },

  inputFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },

  footerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    minWidth: 0,
  },

  footerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[1],
    flexShrink: 0,
  },

  modelSelectorWrapper: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
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
    border: `1px solid ${colors.border.default}`,
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
    backgroundColor: colors.bg.overlay,
    border: 'none',
    borderRadius: '50%',
    color: colors.fg.primary,
    cursor: 'pointer',
    transition: 'background 0.15s',
  } as React.CSSProperties,

  attachmentTextBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[3]}`,
    backgroundColor: colors.bg.inset,
    border: `1px solid ${colors.border.default}`,
    borderRadius: effects.border.radius.default,
    maxWidth: 250,
  } as React.CSSProperties,

  attachmentTextInfo: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  } as React.CSSProperties,

  attachmentTextName: {
    fontSize: typography.sizes.sm,
    color: colors.fg.primary,
    fontFamily: typography.fonts.body,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  attachmentTextRemove: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: effects.border.radius.sm,
    color: colors.fg.tertiary,
    cursor: 'pointer',
    transition: 'color 0.15s, background 0.15s',
    flexShrink: 0,
  } as React.CSSProperties,
};

export default MessageInput;
