'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Trash2, Maximize2, Copy, Edit2 } from 'lucide-react';

import { colors, spacing, effects, typography } from '@/lib/design-tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}

// =============================================================================
// STYLES
// =============================================================================

const menuStyles: React.CSSProperties = {
  position: 'fixed',
  backgroundColor: colors.navy.light,
  border: `1px solid rgba(99, 102, 241, 0.3)`,
  borderRadius: effects.border.radius.default,
  boxShadow: effects.shadow.lg,
  minWidth: 180,
  padding: spacing[1],
  zIndex: 9999,
};

const itemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[2],
  padding: `${spacing[2]} ${spacing[2]}`,
  borderRadius: effects.border.radius.default,
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
  border: 'none',
  background: 'none',
  width: '100%',
  textAlign: 'left',
  fontSize: typography.sizes.sm,
  fontFamily: typography.fonts.body,
};

const separatorStyles: React.CSSProperties = {
  height: 1,
  backgroundColor: 'rgba(99, 102, 241, 0.2)',
  margin: `${spacing[1]} 0`,
};

// =============================================================================
// HOOK: useContextMenu
// =============================================================================

export function useContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dynamicItems, setDynamicItems] = useState<ContextMenuItem[]>([]);

  const openMenu = useCallback((e: React.MouseEvent, items?: ContextMenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Position menu at cursor, with small offset for better UX
    // Add slight offset so menu doesn't cover cursor
    const offsetX = 2;
    const offsetY = 2;
    
    let x = e.clientX + offsetX;
    let y = e.clientY + offsetY;
    
    // Ensure menu stays within viewport bounds
    // Estimate menu size: 200px width, 150px height (approximate)
    const menuWidth = 200;
    const menuHeight = 150;
    
    // Check right edge
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    
    // Check bottom edge
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    
    // Ensure minimum distance from edges
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    setPosition({ x, y });
    if (items) {
      setDynamicItems(items);
    }
    setIsOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setDynamicItems([]);
  }, []);

  return { isOpen, position, openMenu, closeMenu, dynamicItems };
}

// =============================================================================
// PRESET MENU ITEMS
// =============================================================================

export function getConversationMenuItems(
  conversationId: string,
  handlers: {
    onBranch?: () => void;
    onDelete?: () => void;
    onExpand?: () => void;
    onCopy?: () => void;
    onRename?: () => void;
  }
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (handlers.onExpand) {
    items.push({
      id: 'expand',
      label: 'Expand',
      icon: <Maximize2 size={14} />,
      shortcut: 'Space',
      onClick: handlers.onExpand,
    });
  }

  if (handlers.onBranch) {
    items.push({
      id: 'branch',
      label: 'Branch from here',
      icon: <GitBranch size={14} />,
      shortcut: '⌘B',
      onClick: handlers.onBranch,
    });
  }

  if (handlers.onCopy) {
    items.push({
      id: 'copy',
      label: 'Copy content',
      icon: <Copy size={14} />,
      shortcut: '⌘C',
      onClick: handlers.onCopy,
    });
  }

  if (handlers.onRename) {
    items.push({
      id: 'rename',
      label: 'Rename',
      icon: <Edit2 size={14} />,
      onClick: handlers.onRename,
    });
  }

  if (handlers.onDelete) {
    items.push({
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 size={14} />,
      shortcut: '⌫',
      onClick: handlers.onDelete,
      danger: true,
    });
  }

  return items;
}

// =============================================================================
// CONTEXT MENU COMPONENT
// =============================================================================

export function ContextMenu({ isOpen, position, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure we're on client-side for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle escape key and click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Use capture phase to catch events before React Flow stops them
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('click', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [isOpen, onClose]);

  // Don't render until mounted (for SSR compatibility)
  if (!mounted) return null;

  // Use portal to render menu at document body level
  // This ensures the menu is not affected by canvas transforms
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          style={{
            ...menuStyles,
            left: position.x,
            top: position.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              {/* Separator before danger items */}
              {item.danger && index > 0 && items[index - 1] && !items[index - 1].danger && (
                <div style={separatorStyles} />
              )}

              <button
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    onClose();
                  }
                }}
                disabled={item.disabled}
                style={{
                  ...itemStyles,
                  color: item.danger
                    ? colors.semantic.error
                    : item.disabled
                      ? colors.contrast.grayDark
                      : colors.contrast.white,
                  opacity: item.disabled ? 0.5 : 1,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) {
                    const hoverBg = item.danger
                      ? `${colors.semantic.error}15`
                      : colors.navy.dark;
                    (e.target as HTMLButtonElement).style.backgroundColor = hoverBg;
                  }
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                {item.icon && (
                  <span style={{
                    color: item.danger ? colors.semantic.error : colors.contrast.grayDark,
                  }}>
                    {item.icon}
                  </span>
                )}
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.shortcut && (
                  <span style={{
                    color: colors.contrast.grayDark,
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fonts.code,
                  }}>
                    {item.shortcut}
                  </span>
                )}
              </button>
            </React.Fragment>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default ContextMenu;
