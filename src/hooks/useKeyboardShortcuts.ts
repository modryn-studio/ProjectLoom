'use client';

import { useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface KeyboardShortcutHandlers {
  /** Called when Delete or Backspace is pressed */
  onDelete?: () => void;
  /** Called when Escape is pressed */
  onEscape?: () => void;
  /** Called when Ctrl+Z is pressed */
  onUndo?: () => void;
  /** Called when Ctrl+Y or Ctrl+Shift+Z is pressed */
  onRedo?: () => void;
  /** Called when Space is pressed */
  onExpand?: () => void;
  /** Called when Ctrl+B is pressed */
  onBranch?: () => void;
  /** Called when N is pressed */
  onAddConversation?: () => void;
}

export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean;
  /** Handlers for keyboard shortcuts */
  handlers: KeyboardShortcutHandlers;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for handling keyboard shortcuts
 * 
 * Phase 1 implements essential shortcuts:
 * - Delete/Backspace: Delete selected item
 * - Escape: Cancel current action / deselect
 * 
 * Phase 3 will add advanced shortcuts.
 */
export function useKeyboardShortcuts({
  enabled = true,
  handlers,
}: UseKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          // Prevent browser back navigation on Backspace
          event.preventDefault();
          handlers.onDelete?.();
          break;

        case 'Escape':
          event.preventDefault();
          handlers.onEscape?.();
          break;

        case 'z':
        case 'Z':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (event.shiftKey) {
              // Ctrl+Shift+Z: Redo
              handlers.onRedo?.();
            } else {
              // Ctrl+Z: Undo
              handlers.onUndo?.();
            }
          }
          break;

        case 'y':
        case 'Y':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Ctrl+Y: Redo (Windows/Linux)
            handlers.onRedo?.();
          }
          break;

        case ' ':
          // Space: Expand/collapse selected card
          // Only if not in an input field (already handled above)
          event.preventDefault();
          handlers.onExpand?.();
          break;

        case 'b':
        case 'B':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Ctrl+B: Branch from selected card
            handlers.onBranch?.();
          }
          break;

        case 'n':
        case 'N':
          event.preventDefault();
          // N: Add new conversation
          handlers.onAddConversation?.();
          break;

        // Phase 3 shortcuts will be added here:
        // - Ctrl+A: Select all
        // - Ctrl+C: Copy
        // - Ctrl+V: Paste
        // - Arrow keys: Navigate between nodes
        // - +/-: Zoom
        // - Ctrl+F: Search

        default:
          break;
      }
    },
    [enabled, handlers]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

// =============================================================================
// SHORTCUT DISPLAY HELPER
// =============================================================================

/**
 * Get display string for a keyboard shortcut
 * Handles platform-specific modifier keys
 */
export function getShortcutDisplay(
  key: string,
  modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean }
): string {
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  
  const parts: string[] = [];
  
  if (modifiers?.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (modifiers?.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (modifiers?.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  
  // Format special keys
  const keyDisplay = {
    'Delete': isMac ? '⌫' : 'Del',
    'Backspace': '⌫',
    'Escape': 'Esc',
    'Enter': '↵',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    ' ': 'Space',
  }[key] || key.toUpperCase();
  
  parts.push(keyDisplay);
  
  return parts.join(isMac ? '' : '+');
}

/**
 * Available shortcuts for display in UI (Phase 3)
 */
export const SHORTCUTS = {
  delete: { key: 'Delete', display: getShortcutDisplay('Delete') },
  escape: { key: 'Escape', display: getShortcutDisplay('Escape') },
  // Phase 3 additions:
  // undo: { key: 'z', modifiers: { ctrl: true }, display: getShortcutDisplay('z', { ctrl: true }) },
  // redo: { key: 'z', modifiers: { ctrl: true, shift: true }, display: getShortcutDisplay('z', { ctrl: true, shift: true }) },
  // search: { key: 'f', modifiers: { ctrl: true }, display: getShortcutDisplay('f', { ctrl: true }) },
} as const;

export default useKeyboardShortcuts;
