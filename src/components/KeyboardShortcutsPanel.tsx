'use client';

/**
 * KeyboardShortcutsPanel - Help dialog showing all keyboard shortcuts
 * 
 * Triggered by pressing '?' or 'Shift+/' key.
 * Displays shortcuts organized by category with platform-specific keys.
 * 
 * @version 4.0.0
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard } from 'lucide-react';
import { colors, spacing, effects, animation, typography } from '@/lib/design-tokens';
import { zIndex } from '@/constants/zIndex';
import { SHORTCUTS, SHORTCUT_CATEGORIES, getShortcutDisplay } from '@/hooks/useKeyboardShortcuts';

// =============================================================================
// ICONS (inline SVG)
// =============================================================================

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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
  backgroundColor: colors.navy.light,
  borderRadius: effects.border.radius.md,
  border: `1px solid rgba(99, 102, 241, 0.3)`,
  boxShadow: effects.shadow.lg,
  width: '90%',
  maxWidth: '520px',
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyles: React.CSSProperties = {
  padding: spacing[4],
  borderBottom: `1px solid rgba(99, 102, 241, 0.2)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const contentStyles: React.CSSProperties = {
  padding: spacing[4],
  overflowY: 'auto',
  flex: 1,
};

const categoryStyles: React.CSSProperties = {
  marginBottom: spacing[4],
};

const categoryTitleStyles: React.CSSProperties = {
  fontSize: typography.sizes.xs,
  fontWeight: 600,
  color: colors.contrast.grayDark,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: spacing[2],
};

const shortcutRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${spacing[2]} 0`,
  borderBottom: `1px solid rgba(255, 255, 255, 0.05)`,
};

const shortcutDescriptionStyles: React.CSSProperties = {
  fontSize: typography.sizes.sm,
  color: colors.contrast.grayLight,
};

const kbdStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing[1],
  padding: `${spacing[1]} ${spacing[2]}`,
  backgroundColor: colors.navy.dark,
  border: `1px solid rgba(99, 102, 241, 0.3)`,
  borderRadius: effects.border.radius.sm,
  fontSize: typography.sizes.xs,
  fontFamily: typography.fonts.code,
  color: colors.contrast.white,
  minWidth: '24px',
  justifyContent: 'center',
};

// =============================================================================
// COMPONENT
// =============================================================================

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsPanel({ isOpen, onClose }: KeyboardShortcutsPanelProps) {
  // Detect platform for key display
  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac/.test(navigator.platform);
  }, []);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle overlay click
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Format key display
  const formatKey = useCallback((shortcutKey: keyof typeof SHORTCUTS) => {
    const shortcut = SHORTCUTS[shortcutKey];
    const modifiers = 'modifiers' in shortcut ? shortcut.modifiers : undefined;
    return getShortcutDisplay(shortcut.key, modifiers);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={overlayStyles}
          onClick={handleOverlayClick}
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
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: colors.violet.primary,
                }}>
                  <Keyboard size={18} />
                </div>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '1.125rem', 
                  fontWeight: 600, 
                  color: colors.contrast.white 
                }}>
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.contrast.gray,
                  padding: spacing[1],
                  borderRadius: effects.border.radius.sm,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s, background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = colors.contrast.white;
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = colors.contrast.gray;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <XIcon />
              </button>
            </div>

            {/* Content */}
            <div style={contentStyles}>
              {SHORTCUT_CATEGORIES.map((category) => (
                <div key={category.name} style={categoryStyles}>
                  <div style={categoryTitleStyles}>{category.name}</div>
                  {category.shortcuts.map((shortcutKey, index) => {
                    const shortcut = SHORTCUTS[shortcutKey];
                    const isLast = index === category.shortcuts.length - 1;
                    
                    return (
                      <div 
                        key={shortcutKey} 
                        style={{
                          ...shortcutRowStyles,
                          borderBottom: isLast ? 'none' : shortcutRowStyles.borderBottom,
                        }}
                      >
                        <span style={shortcutDescriptionStyles}>
                          {shortcut.description}
                        </span>
                        <kbd style={kbdStyles}>
                          {formatKey(shortcutKey)}
                        </kbd>
                      </div>
                    );
                  })}
                </div>
              ))}
              
              {/* Platform hint */}
              <div style={{ 
                marginTop: spacing[4],
                paddingTop: spacing[3],
                borderTop: `1px solid rgba(255, 255, 255, 0.1)`,
                fontSize: typography.sizes.xs,
                color: colors.contrast.grayDark,
                textAlign: 'center',
              }}>
                {isMac ? '⌘ = Command key' : 'Ctrl = Control key'}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// STANDALONE WRAPPER WITH STATE
// =============================================================================

/**
 * Self-contained keyboard shortcuts panel with built-in state management.
 * Automatically listens for '?' key to open.
 */
export function KeyboardShortcutsPanelProvider() {
  const [isOpen, setIsOpen] = useState(false);

  // Listen for ? key globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <KeyboardShortcutsPanel 
      isOpen={isOpen} 
      onClose={() => setIsOpen(false)} 
    />
  );
}

export default KeyboardShortcutsPanel;
