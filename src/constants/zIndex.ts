/**
 * Z-Index Layering System
 * 
 * Centralized z-index management to ensure consistent layering
 * across the application. Higher numbers appear on top.
 * 
 * @version 1.0.0
 */

export const zIndex = {
  // Canvas layers (0-99)
  canvas: {
    /** Base canvas background */
    base: 0,
    /** Grid/dot pattern */
    grid: 1,
    /** Edge connections between nodes */
    edges: 10,
    /** Connection line being drawn */
    connectionLine: 15,
  },
  
  // Card layers (100-199)
  cards: {
    /** Default card layer */
    default: 100,
    /** Card being dragged */
    dragging: 150,
    /** Hovered card (slight elevation) */
    hover: 120,
    /** Selected card */
    selected: 130,
    /** Expanded card (highest card layer) */
    expanded: 160,
  },
  
  // UI layers (200-299)
  ui: {
    /** Minimap overlay */
    minimap: 200,
    /** Toolbar/controls */
    toolbar: 210,
    /** Context menus */
    contextMenu: 220,
    /** Dropdown menus */
    dropdown: 230,
    /** Side panels (chat, settings) */
    sidePanel: 240,
    /** Maximized chat panel (fullscreen) */
    sidePanelMaximized: 250,
    /** Usage sidebar (should be above maximized panels) */
    usageSidebar: 260,
  },
  
  // Overlay layers (300-399)
  overlay: {
    /** Dev performance overlay */
    devOverlay: 300,
    /** Modal backdrop */
    modalBackdrop: 350,
    /** Modal content */
    modal: 360,
    /** Notifications/toasts */
    notification: 370,
  },
  
  // Top-level layers (400+)
  top: {
    /** Tooltips (always visible) */
    tooltip: 400,
    /** Error boundary fallback */
    errorBoundary: 500,
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get card z-index based on state
 */
export function getCardZIndex(state: {
  isExpanded?: boolean;
  isDragging?: boolean;
  isHovered?: boolean;
  isSelected?: boolean;
}): number {
  if (state.isExpanded) return zIndex.cards.expanded;
  if (state.isDragging) return zIndex.cards.dragging;
  if (state.isSelected) return zIndex.cards.selected;
  if (state.isHovered) return zIndex.cards.hover;
  return zIndex.cards.default;
}

/**
 * Create CSS z-index string
 */
export function z(value: number): string {
  return String(value);
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ZIndexCategory = keyof typeof zIndex;
export type CardZIndexState = Parameters<typeof getCardZIndex>[0];

export default zIndex;
