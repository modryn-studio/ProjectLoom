'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { colors, spacing, effects, typography, animation } from '@/lib/design-tokens';

interface WorkspaceNameModalProps {
  isOpen: boolean;
  suggestedName: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const dialogStyles: React.CSSProperties = {
  backgroundColor: colors.bg.secondary,
  borderRadius: effects.border.radius.md,
  border: `1px solid ${colors.border.default}`,
  boxShadow: effects.shadow.lg,
  width: '90%',
  maxWidth: 420,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyles: React.CSSProperties = {
  padding: spacing[4],
  borderBottom: `1px solid ${colors.border.default}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const contentStyles: React.CSSProperties = {
  padding: spacing[4],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[2],
};

const footerStyles: React.CSSProperties = {
  padding: spacing[4],
  borderTop: `1px solid ${colors.border.default}`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: spacing[2],
};

const inputStyles: React.CSSProperties = {
  width: '100%',
  padding: `${spacing[2]} ${spacing[3]}`,
  backgroundColor: colors.bg.inset,
  border: `1px solid ${colors.border.default}`,
  borderRadius: effects.border.radius.default,
  color: colors.fg.primary,
  fontSize: typography.sizes.sm,
  fontFamily: typography.fonts.body,
  outline: 'none',
};

export function WorkspaceNameModal({
  isOpen,
  suggestedName,
  onConfirm,
  onClose,
}: WorkspaceNameModalProps) {
  const [name, setName] = useState(suggestedName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update name when modal opens with new suggested name
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(suggestedName);
      setError(null);
    }
  }, [isOpen, suggestedName]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Workspace name is required.');
      return;
    }
    onConfirm(trimmed);
  }, [name, onConfirm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={overlayStyles}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={animation.spring.snappy}
            style={dialogStyles}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={headerStyles}>
              <h3
                style={{
                  margin: 0,
                  fontSize: typography.sizes.lg,
                  fontFamily: typography.fonts.heading,
                  color: colors.fg.primary,
                }}
              >
                Name your workspace
              </h3>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: colors.fg.quaternary,
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={contentStyles}>
              <label
                htmlFor="workspace-name"
                style={{
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  color: colors.fg.secondary,
                }}
              >
                Workspace name
              </label>
              <input
                id="workspace-name"
                ref={inputRef}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirm();
                  }
                  if (e.key === 'Escape') {
                    onClose();
                  }
                }}
                style={{
                  ...inputStyles,
                  borderColor: error ? colors.semantic.error : colors.border.default,
                }}
              />
              {error && (
                <span
                  style={{
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fonts.body,
                    color: colors.semantic.error,
                  }}
                >
                  {error}
                </span>
              )}
            </div>

            <div style={footerStyles}>
              <button
                onClick={onClose}
                style={{
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.border.default}`,
                  borderRadius: effects.border.radius.default,
                  color: colors.fg.primary,
                  padding: `${spacing[2]} ${spacing[3]}`,
                  cursor: 'pointer',
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  backgroundColor: colors.accent.primary,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: colors.bg.inset,
                  padding: `${spacing[2]} ${spacing[3]}`,
                  cursor: 'pointer',
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                }}
              >
                Create Workspace
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
