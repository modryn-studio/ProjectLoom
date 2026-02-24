'use client';

import { useEffect, useCallback, useRef, useLayoutEffect } from 'react';

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
  /** Called when Space is pressed (opens chat panel) */
  onExpand?: () => void;
  /** Called when Enter is pressed (opens chat panel) */
  onOpenChat?: () => void;
  /** Called when Ctrl+B is pressed */
  onBranch?: () => void;
  /** Called when N is pressed */
  onAddConversation?: () => void;
  /** Called when + or = is pressed (zoom in) */
  onZoomIn?: () => void;
  /** Called when - is pressed (zoom out) */
  onZoomOut?: () => void;
  /** Called when Ctrl+0 is pressed (fit view) */
  onFitView?: () => void;
  /** Called when Ctrl+1 is pressed (reset zoom to 100%) */
  onResetZoom?: () => void;
  /** Called when Ctrl+A is pressed (select all) */
  onSelectAll?: () => void;
  /** Called when ? or Shift+/ is pressed (show shortcuts help) */
  onShowShortcuts?: () => void;
  /** Called when Ctrl+F is pressed (search) */
  onSearch?: () => void;
  /** Called when Ctrl+L is pressed (suggest layout) */
  onSuggestLayout?: () => void;
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
  // Store the latest handlers in a ref so the event listener never needs
  // to be removed/re-added when the caller passes a new inline object.
  const handlersRef = useRef(handlers);
  // useLayoutEffect keeps the ref in sync synchronously after each render,
  // which is the correct React pattern for "latest value" refs.
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      // Always read from the ref to get the latest callbacks without stale closure
      const { onDelete, onEscape, onUndo, onRedo, onExpand, onOpenChat, onBranch,
              onAddConversation, onZoomIn, onZoomOut, onFitView, onResetZoom,
              onSelectAll, onShowShortcuts, onSearch, onSuggestLayout } = handlersRef.current;

      // Don't trigger shortcuts when typing in inputs (except Ctrl/Cmd+B for branching)
      const target = event.target as HTMLElement;
      const isEditableTarget =
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable;
      const isBranchShortcut = (event.ctrlKey || event.metaKey)
        && (event.key === 'b' || event.key === 'B');

      if (isEditableTarget && !isBranchShortcut) {
        return;
      }

      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          // Prevent browser back navigation on Backspace
          event.preventDefault();
          onDelete?.();
          break;

        case 'Escape':
          event.preventDefault();
          onEscape?.();
          break;

        case 'z':
        case 'Z':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (event.shiftKey) {
              // Ctrl+Shift+Z: Redo
              onRedo?.();
            } else {
              // Ctrl+Z: Undo
              onUndo?.();
            }
          }
          break;

        case 'y':
        case 'Y':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Ctrl+Y: Redo (Windows/Linux)
            onRedo?.();
          }
          break;

        case ' ':
          // Space: Open chat panel for selected card
          // Only if not in an input field (already handled above)
          event.preventDefault();
          onExpand?.();
          break;

        case 'Enter':
          // Enter: Open chat panel for selected card (same as Space)
          // Only if not in an input field (already handled above)
          // Note: Ctrl+Enter for send is handled in MessageInput component
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onOpenChat?.();
          }
          break;

        case 'b':
        case 'B':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Ctrl+B: Branch from selected card
            onBranch?.();
          }
          break;

        case 'n':
        case 'N':
          event.preventDefault();
          // N: Add new conversation
          onAddConversation?.();
          break;

        // View controls
        case '+':
        case '=':
          event.preventDefault();
          onZoomIn?.();
          break;

        case '-':
          event.preventDefault();
          onZoomOut?.();
          break;

        case '0':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Ctrl+0: Fit all cards in view
            onFitView?.();
          }
          break;

        case '1':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Ctrl+1: Reset zoom to 100%
            onResetZoom?.();
          }
          break;

        // Selection
        case 'a':
        case 'A':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Ctrl+A: Select all cards
            onSelectAll?.();
          }
          break;

        // Help & Search
        case '?':
          event.preventDefault();
          onShowShortcuts?.();
          break;

        case '/':
          if (event.shiftKey) {
            event.preventDefault();
            // Shift+/: Show shortcuts (same as ?)
            onShowShortcuts?.();
          }
          break;

        case 'f':
        case 'F':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Ctrl+F: Search canvas
            onSearch?.();
          }
          break;

        case 'l':
        case 'L':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Ctrl+L: Suggest layout
            onSuggestLayout?.();
          }
          break;

        default:
          break;
      }
    },
    [enabled] // handlers intentionally excluded — latest value read via handlersRef
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
 * Available shortcuts for display in UI
 */
export const SHORTCUTS = {
  // Navigation
  newCard: { key: 'N', description: 'New conversation card' },
  openChat: { key: 'Space', description: 'Open chat panel' },
  openChatAlt: { key: 'Enter', description: 'Open chat panel' },
  escape: { key: 'Escape', description: 'Close panel / Deselect' },
  
  // Editing
  branch: { key: 'B', modifiers: { ctrl: true }, description: 'Branch from selected card' },
  delete: { key: 'Delete', description: 'Delete selected card' },
  undo: { key: 'Z', modifiers: { ctrl: true }, description: 'Undo' },
  redo: { key: 'Z', modifiers: { ctrl: true, shift: true }, description: 'Redo' },
  redoAlt: { key: 'Y', modifiers: { ctrl: true }, description: 'Redo (Windows)' },
  
  // View
  zoomIn: { key: '+', description: 'Zoom in' },
  zoomOut: { key: '-', description: 'Zoom out' },
  fitView: { key: '0', modifiers: { ctrl: true }, description: 'Fit all cards in view' },
  resetZoom: { key: '1', modifiers: { ctrl: true }, description: 'Reset zoom to 100%' },
  
  // Selection
  selectAll: { key: 'A', modifiers: { ctrl: true }, description: 'Select all cards' },
  
  // Search & Help
  search: { key: 'F', modifiers: { ctrl: true }, description: 'Search canvas' },
  suggestLayout: { key: 'L', modifiers: { ctrl: true }, description: 'Suggest layout' },
  showShortcuts: { key: '?', description: 'Show keyboard shortcuts' },
} as const;

/**
 * Shortcut categories for organized display
 */
export const SHORTCUT_CATEGORIES = [
  {
    name: 'Navigation',
    shortcuts: ['newCard', 'openChat', 'escape'] as const,
  },
  {
    name: 'Editing',
    shortcuts: ['branch', 'delete', 'undo', 'redo'] as const,
  },
  {
    name: 'View',
    shortcuts: ['zoomIn', 'zoomOut', 'fitView', 'resetZoom'] as const,
  },
  {
    name: 'Selection',
    shortcuts: ['selectAll'] as const,
  },
  {
    name: 'Search & Help',
    shortcuts: ['search', 'suggestLayout', 'showShortcuts'] as const,
  },
] as const;

export default useKeyboardShortcuts;
