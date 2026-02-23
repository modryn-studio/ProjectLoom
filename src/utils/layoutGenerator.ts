/**
 * Layout Generator Utility
 * 
 * Generates grid-based layouts with organic randomness (±20px jitter)
 * for positioning conversation cards on the canvas.
 * 
 * @version 1.0.0
 */

import { spacing } from '@/lib/design-tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface LayoutOptions {
  /** Number of items to position */
  count: number;
  /** Number of columns in the grid */
  columns?: number;
  /** Horizontal gap between items */
  gapX?: number;
  /** Vertical gap between items */
  gapY?: number;
  /** Random offset range (±jitter pixels) */
  jitter?: number;
  /** Starting X position */
  startX?: number;
  /** Starting Y position */
  startY?: number;
  /** Card width for calculating positions */
  cardWidth?: number;
  /** Card height for calculating positions */
  cardHeight?: number;
}

export interface LayoutResult {
  positions: Position[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  count: 1,
  columns: 4,
  gapX: spacing.canvas.nodeGap,
  gapY: spacing.canvas.nodeGap,
  jitter: spacing.canvas.jitter,
  startX: 100,
  startY: 100,
  cardWidth: 280,
  cardHeight: 120,
};

// =============================================================================
// RANDOM UTILITIES
// =============================================================================

/**
 * Seeded random number generator for reproducible layouts
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Generate random jitter value within range
 */
export function getJitter(jitterAmount: number, random?: () => number): number {
  const rand = random ? random() : Math.random();
  return (rand - 0.5) * 2 * jitterAmount;
}

// =============================================================================
// LAYOUT GENERATORS
// =============================================================================

/**
 * Generate a grid layout with organic jitter
 * 
 * @param options - Layout configuration options
 * @param seed - Optional seed for reproducible randomness
 * @returns Array of positions with calculated bounds
 */
export function generateGridLayout(
  options: LayoutOptions,
  seed?: number
): LayoutResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const random = seed !== undefined ? createSeededRandom(seed) : undefined;
  
  const positions: Position[] = [];
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (let i = 0; i < opts.count; i++) {
    const col = i % opts.columns;
    const row = Math.floor(i / opts.columns);
    
    // Base grid position
    const baseX = opts.startX + col * (opts.cardWidth + opts.gapX);
    const baseY = opts.startY + row * (opts.cardHeight + opts.gapY);
    
    // Add jitter for organic feel
    const jitterX = getJitter(opts.jitter, random);
    const jitterY = getJitter(opts.jitter, random);
    
    const position: Position = {
      x: Math.round(baseX + jitterX),
      y: Math.round(baseY + jitterY),
    };
    
    positions.push(position);
    
    // Track bounds
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + opts.cardWidth);
    maxY = Math.max(maxY, position.y + opts.cardHeight);
  }
  
  return {
    positions,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

/**
 * Generate a horizontal layout (single row)
 */
export function generateHorizontalLayout(
  options: Omit<LayoutOptions, 'columns'>,
  seed?: number
): LayoutResult {
  return generateGridLayout(
    { ...options, columns: options.count },
    seed
  );
}

/**
 * Generate a vertical layout (single column)
 */
export function generateVerticalLayout(
  options: Omit<LayoutOptions, 'columns'>,
  seed?: number
): LayoutResult {
  return generateGridLayout(
    { ...options, columns: 1 },
    seed
  );
}

/**
 * Generate a cascading/staircase layout
 */
export function generateCascadeLayout(
  options: LayoutOptions,
  seed?: number
): LayoutResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const random = seed !== undefined ? createSeededRandom(seed) : undefined;
  
  const positions: Position[] = [];
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  const offsetX = 60; // Horizontal offset per item
  const offsetY = 40; // Vertical offset per item
  
  for (let i = 0; i < opts.count; i++) {
    const baseX = opts.startX + i * offsetX;
    const baseY = opts.startY + i * offsetY;
    
    const jitterX = getJitter(opts.jitter, random);
    const jitterY = getJitter(opts.jitter, random);
    
    const position: Position = {
      x: Math.round(baseX + jitterX),
      y: Math.round(baseY + jitterY),
    };
    
    positions.push(position);
    
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + opts.cardWidth);
    maxY = Math.max(maxY, position.y + opts.cardHeight);
  }
  
  return {
    positions,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

/**
 * Generate a tree-like layout for branching conversations
 * Positions follow parent-child relationships
 */
export function generateTreeLayout(
  connections: Array<{ source: number; target: number }>,
  options: LayoutOptions,
  seed?: number
): LayoutResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const random = seed !== undefined ? createSeededRandom(seed) : undefined;
  
  // Build adjacency list
  const children: Map<number, number[]> = new Map();
  const hasParent: Set<number> = new Set();
  
  for (const conn of connections) {
    if (!children.has(conn.source)) {
      children.set(conn.source, []);
    }
    children.get(conn.source)!.push(conn.target);
    hasParent.add(conn.target);
  }
  
  // Find root nodes (no parent)
  const roots: number[] = [];
  for (let i = 0; i < opts.count; i++) {
    if (!hasParent.has(i)) {
      roots.push(i);
    }
  }
  
  const positions: Position[] = new Array(opts.count);
  let currentY = opts.startY;
  
  // BFS traversal for tree layout
  function layoutSubtree(nodeIndex: number, depth: number, yOffset: number): number {
    // Guard against extremely deep or malformed graphs (e.g. missed cycle in connections)
    if (depth > 500) return yOffset;
    const x = opts.startX + depth * (opts.cardWidth + opts.gapX);
    const jitterX = getJitter(opts.jitter, random);
    const jitterY = getJitter(opts.jitter, random);
    
    const nodeChildren = children.get(nodeIndex) || [];
    
    if (nodeChildren.length === 0) {
      // Leaf node
      positions[nodeIndex] = {
        x: Math.round(x + jitterX),
        y: Math.round(yOffset + jitterY),
      };
      return yOffset + opts.cardHeight + opts.gapY;
    }
    
    // Layout children first
    let childY = yOffset;
    for (const child of nodeChildren) {
      childY = layoutSubtree(child, depth + 1, childY);
    }
    
    // Center parent among children
    const firstChild = positions[nodeChildren[0]];
    const lastChild = positions[nodeChildren[nodeChildren.length - 1]];
    if (!firstChild || !lastChild) {
      positions[nodeIndex] = {
        x: Math.round(x + jitterX),
        y: Math.round(yOffset + jitterY),
      };
      return childY;
    }

    const centerY = (firstChild.y + lastChild.y) / 2;
    
    positions[nodeIndex] = {
      x: Math.round(x + jitterX),
      y: Math.round(centerY + jitterY),
    };
    
    return childY;
  }
  
  // Layout each root and its subtree
  for (const root of roots) {
    currentY = layoutSubtree(root, 0, currentY);
  }
  
  // Handle orphan nodes (not connected)
  let orphanY = currentY + opts.gapY * 2;
  for (let i = 0; i < opts.count; i++) {
    if (!positions[i]) {
      const jitterX = getJitter(opts.jitter, random);
      const jitterY = getJitter(opts.jitter, random);
      positions[i] = {
        x: Math.round(opts.startX + jitterX),
        y: Math.round(orphanY + jitterY),
      };
      orphanY += opts.cardHeight + opts.gapY;
    }
  }
  
  // Calculate bounds
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const pos of positions) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + opts.cardWidth);
    maxY = Math.max(maxY, pos.y + opts.cardHeight);
  }
  
  return {
    positions,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

const layoutGenerator = {
  generateGridLayout,
  generateHorizontalLayout,
  generateVerticalLayout,
  generateCascadeLayout,
  generateTreeLayout,
  createSeededRandom,
  getJitter,
};

export default layoutGenerator;
