'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Check, X, Paperclip, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';

import { colors, spacing, typography, effects } from '@/lib/design-tokens';
import type { MessageAttachment } from '@/types';

interface InlineMessageEditorProps {
  initialContent: string;
  initialAttachments?: MessageAttachment[];
  onSave: (content: string, attachments: MessageAttachment[]) => void;
  onCancel: () => void;
}

export function InlineMessageEditor({
  initialContent,
  initialAttachments = [],
  onSave,
  onCancel,
}: InlineMessageEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [attachments, setAttachments] = useState<MessageAttachment[]>(initialAttachments);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [content]);

  // Auto-focus on mount, cursor at end — runs once using initialContent length
  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(initialContent.length, initialContent.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(() => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return; // Don't save empty messages
    }
    onSave(trimmedContent, attachments);
  }, [content, attachments, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleSave, onCancel]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const newAttachments: MessageAttachment[] = [];

    for (const file of fileArray) {
      // Only accept images
      if (!file.type.startsWith('image/')) {
        continue;
      }

      // Check size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        continue;
      }

      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        id: nanoid(),
        contentType: file.type,
        name: file.name,
        url: dataUrl,
      });
    }

    setAttachments([...attachments, ...newAttachments]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [attachments]);

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments(attachments.filter(a => a.id !== attachmentId));
  }, [attachments]);

  return (
    <div style={styles.container}>
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div style={styles.attachmentsContainer}>
          {attachments.map(attachment => (
            <div key={attachment.id} style={styles.attachmentPreview}>
              {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URLs not supported by next/image */}
              <img 
                src={attachment.url} 
                alt={attachment.name}
                style={styles.attachmentImage}
              />
              <button
                onClick={() => handleRemoveAttachment(attachment.id)}
                style={styles.removeAttachmentButton}
                title="Remove image"
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editor textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Edit message..."
        style={styles.textarea}
        rows={1}
      />

      {/* Action buttons */}
      <div style={styles.actionsContainer}>
        <div style={styles.leftActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            style={styles.hiddenFileInput}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={styles.attachButton}
            title="Add images"
            type="button"
          >
            <Paperclip size={16} />
          </button>
        </div>

        <div style={styles.rightActions}>
          <button
            onClick={onCancel}
            style={styles.cancelButton}
            title="Cancel (Esc)"
            type="button"
          >
            <X size={16} />
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={styles.saveButton}
            title="Send (Ctrl+Enter)"
            disabled={!content.trim()}
            type="button"
          >
            <Check size={16} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
    padding: spacing[3],
    backgroundColor: colors.bg.tertiary,
    borderRadius: effects.border.radius.md,
    border: `2px solid ${colors.accent.primary}`,
    marginBlock: spacing[2],
  },

  attachmentsContainer: {
    display: 'flex',
    gap: spacing[2],
    flexWrap: 'wrap',
  },

  attachmentPreview: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: effects.border.radius.default,
    overflow: 'hidden',
    border: `1px solid ${colors.border.default}`,
  },

  attachmentImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  removeAttachmentButton: {
    position: 'absolute',
    top: spacing[1],
    right: spacing[1],
    background: colors.bg.secondary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: effects.border.radius.default,
    padding: spacing[1],
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.fg.tertiary,
    transition: 'all 0.15s ease',
  },

  textarea: {
    width: '100%',
    minHeight: 60,
    maxHeight: 300,
    padding: spacing[2],
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    color: colors.fg.primary,
    backgroundColor: colors.bg.primary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: effects.border.radius.default,
    resize: 'none',
    overflow: 'auto',
    lineHeight: 1.5,
  },

  actionsContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[2],
  },

  leftActions: {
    display: 'flex',
    gap: spacing[2],
  },

  rightActions: {
    display: 'flex',
    gap: spacing[2],
  },

  hiddenFileInput: {
    display: 'none',
  },

  attachButton: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[1],
    padding: `${spacing[1]} ${spacing[2]}`,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.fg.secondary,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.border.default}`,
    borderRadius: effects.border.radius.default,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  cancelButton: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[1],
    padding: `${spacing[1]} ${spacing[3]}`,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.fg.secondary,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.border.default}`,
    borderRadius: effects.border.radius.default,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  saveButton: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[1],
    padding: `${spacing[1]} ${spacing[3]}`,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.bg.primary,
    backgroundColor: colors.accent.primary,
    border: 'none',
    borderRadius: effects.border.radius.default,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
