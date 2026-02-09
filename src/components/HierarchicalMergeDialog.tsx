'use client';

/**
 * HierarchicalMergeDialog - Educational dialog for merge node best practices
 * 
 * Shows when user tries to exceed 5-parent limit on merge nodes.
 * Explains hierarchical merging pattern and offers to create intermediate merge.
 * 
 * @version 4.0.0
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '@/stores/canvas-store';
import { colors, spacing, effects, animation } from '@/lib/design-tokens';
import { zIndex } from '@/constants/zIndex';

// =============================================================================
// ICONS (inline SVG)
// =============================================================================

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const GitMergeIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" />
  </svg>
);

const LightbulbIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" /><path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
);

// =============================================================================
// STYLES
// =============================================================================

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: zIndex.overlay.modal,
};

const dialogStyles: React.CSSProperties = {
  backgroundColor: colors.bg.secondary,
  borderRadius: effects.border.radius.md,
  border: '1px solid var(--success-solid)',
  boxShadow: effects.shadow.lg,
  width: '90%',
  maxWidth: '550px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyles: React.CSSProperties = {
  padding: spacing[4],
  borderBottom: '1px solid var(--success-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const contentStyles: React.CSSProperties = {
  padding: spacing[4],
};

const footerStyles: React.CSSProperties = {
  padding: spacing[4],
  borderTop: '1px solid var(--border-secondary)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: spacing[3],
};

// =============================================================================
// COMPONENT
// =============================================================================

export function HierarchicalMergeDialog() {
  const isOpen = useCanvasStore((s) => s.hierarchicalMergeDialogOpen);
  const closeDialog = useCanvasStore((s) => s.closeHierarchicalMergeDialog);
  const overlayMouseDownRef = useRef(false);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
        return;
      }

      if (e.key === 'Enter') {
        closeDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDialog]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={overlayStyles}
          onMouseDown={(e) => {
            overlayMouseDownRef.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (overlayMouseDownRef.current && e.target === e.currentTarget) {
              closeDialog();
            }
            overlayMouseDownRef.current = false;
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={animation.spring.snappy}
            style={dialogStyles}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={headerStyles}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: 32, 
                  height: 32, 
                  borderRadius: effects.border.radius.sm,
                  backgroundColor: 'var(--success-muted)',
                  color: colors.semantic.success,
                }}>
                  <GitMergeIcon size={18} />
                </div>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '1.125rem', 
                  fontWeight: 600, 
                  color: colors.fg.primary 
                }}>
                  Merge Node Limit Reached
                </h2>
              </div>
              <button
                onClick={closeDialog}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.fg.secondary,
                  padding: spacing[1],
                  borderRadius: effects.border.radius.sm,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s, background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = colors.fg.primary;
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = colors.fg.secondary;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <XIcon />
              </button>
            </div>

            {/* Content */}
            <div style={contentStyles}>
              {/* Explanation */}
              <p style={{ 
                margin: `0 0 ${spacing[4]}`, 
                color: colors.fg.tertiary,
                fontSize: '0.9375rem',
                lineHeight: 1.6,
              }}>
                Merge nodes work best with <strong style={{ color: colors.semantic.success }}>2-5 sources</strong>. 
                For more sources, use a hierarchical pattern to maintain AI response quality.
              </p>

              {/* Visual Example */}
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: effects.border.radius.sm,
                padding: spacing[4],
                marginBottom: spacing[4],
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: spacing[2],
                  marginBottom: spacing[3],
                  color: colors.accent.primary,
                }}>
                  <LightbulbIcon />
                  <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                    Hierarchical Merge Pattern
                  </span>
                </div>

                {/* Bad Pattern */}
                <div style={{ marginBottom: spacing[3] }}>
                  <p style={{ 
                    margin: `0 0 ${spacing[2]}`, 
                    fontSize: '0.75rem', 
                    color: colors.semantic.error,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    ✕ Instead of:
                  </p>
                  <code style={{
                    display: 'block',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '0.8125rem',
                    color: colors.fg.secondary,
                    backgroundColor: 'var(--error-muted)',
                    padding: `${spacing[2]} ${spacing[3]}`,
                    borderRadius: effects.border.radius.sm,
                    border: '1px solid var(--error-muted)',
                  }}>
                    [A] [B] [C] [D] [E] [F] → [Final]  <span style={{ color: colors.semantic.error }}>{'// 6 sources - too many!'}</span>
                  </code>
                </div>

                {/* Good Pattern */}
                <div>
                  <p style={{ 
                    margin: `0 0 ${spacing[2]}`, 
                    fontSize: '0.75rem', 
                    color: colors.semantic.success,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    ✓ Try this:
                  </p>
                  <code style={{
                    display: 'block',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '0.8125rem',
                    color: colors.fg.tertiary,
                    backgroundColor: 'var(--success-muted)',
                    padding: `${spacing[2]} ${spacing[3]}`,
                    borderRadius: effects.border.radius.sm,
                    border: '1px solid var(--success-muted)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.8,
                  }}>
{`[A] [B] [C] → [Group 1]
[D] [E] [F] → [Group 2]
[Group 1] [Group 2] → [Final]`}
                  </code>
                </div>
              </div>

              {/* Benefits */}
              <div style={{ 
                fontSize: '0.875rem', 
                color: colors.fg.secondary,
                lineHeight: 1.6,
              }}>
                <strong style={{ color: colors.fg.tertiary }}>Benefits:</strong>
                <ul style={{ margin: `${spacing[2]} 0 0`, paddingLeft: spacing[5] }}>
                  <li>Better AI response quality with focused context</li>
                  <li>Easier to understand conversation flow</li>
                  <li>More modular and reusable merge nodes</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div style={footerStyles}>
              <button
                onClick={closeDialog}
                style={{
                  padding: `${spacing[2]} ${spacing[4]}`,
                  backgroundColor: colors.semantic.success,
                  color: colors.fg.primary,
                  border: 'none',
                  borderRadius: effects.border.radius.sm,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s, transform 0.1s, filter 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                Got It
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default HierarchicalMergeDialog;
