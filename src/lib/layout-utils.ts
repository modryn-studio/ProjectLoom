'use client';

/**
 * Layout Utilities - Auto-layout detection and organization
 * 
 * Provides functions to detect overlapping cards and suggest
 * automatic layout organization.
 * 
 * @version 4.0.0
 */

import type { Node } from '@xyflow/react';
import type { ConversationNodeData } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export interface OverlapInfo {
  nodeId: string;
  overlapsWithCount: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  hasChanges: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CARD_WIDTH = 320;
const DEFAULT_CARD_HEIGHT = 200;
const GRID_GAP_X = 50;
const GRID_GAP_Y = 30;
const MARGIN = 40;

// =============================================================================
// OVERLAP DETECTION
// =============================================================================

/**
 * Get bounding box for a node
 */
function getBoundingBox(node: Node<ConversationNodeData>): BoundingBox {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.width || DEFAULT_CARD_WIDTH,
    height: node.height || DEFAULT_CARD_HEIGHT,
  };
}

/**
 * Check if two bounding boxes overlap
 */
function boxesOverlap(a: BoundingBox, b: BoundingBox, margin: number = 0): boolean {
  return !(
    a.x + a.width + margin <= b.x ||
    b.x + b.width + margin <= a.x ||
    a.y + a.height + margin <= b.y ||
    b.y + b.height + margin <= a.y
  );
}

/**
 * Detect all overlapping nodes in the canvas
 * Returns list of node IDs that are overlapping with at least one other node
 */
export function detectOverlaps(nodes: Node<ConversationNodeData>[]): OverlapInfo[] {
  const overlaps: Map<string, number> = new Map();
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const boxA = getBoundingBox(nodes[i]);
      const boxB = getBoundingBox(nodes[j]);
      
      if (boxesOverlap(boxA, boxB)) {
        overlaps.set(nodes[i].id, (overlaps.get(nodes[i].id) || 0) + 1);
        overlaps.set(nodes[j].id, (overlaps.get(nodes[j].id) || 0) + 1);
      }
    }
  }
  
  return Array.from(overlaps.entries())
    .map(([nodeId, overlapsWithCount]) => ({ nodeId, overlapsWithCount }))
    .sort((a, b) => b.overlapsWithCount - a.overlapsWithCount);
}

/**
 * Get count of overlapping node pairs
 */
export function getOverlapCount(nodes: Node<ConversationNodeData>[]): number {
  let count = 0;
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const boxA = getBoundingBox(nodes[i]);
      const boxB = getBoundingBox(nodes[j]);
      
      if (boxesOverlap(boxA, boxB)) {
        count++;
      }
    }
  }
  
  return count;
}

// =============================================================================
// LAYOUT ALGORITHMS
// =============================================================================

/**
 * Simple grid layout - arrange nodes in a grid pattern
 */
export function gridLayout(nodes: Node<ConversationNodeData>[]): LayoutResult {
  if (nodes.length === 0) {
    return { positions: new Map(), hasChanges: false };
  }
  
  const positions = new Map<string, { x: number; y: number }>();
  
  // Calculate optimal columns based on aspect ratio
  const cols = Math.ceil(Math.sqrt(nodes.length * 1.5));
  
  let hasChanges = false;
  
  nodes.forEach((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    const newX = col * (DEFAULT_CARD_WIDTH + GRID_GAP_X) + MARGIN;
    const newY = row * (DEFAULT_CARD_HEIGHT + GRID_GAP_Y) + MARGIN;
    
    // Check if position changed
    if (Math.abs(node.position.x - newX) > 1 || Math.abs(node.position.y - newY) > 1) {
      hasChanges = true;
    }
    
    positions.set(node.id, { x: newX, y: newY });
  });
  
  return { positions, hasChanges };
}

/**
 * Tree layout - arrange nodes based on parent-child relationships
 */
export function treeLayout(
  nodes: Node<ConversationNodeData>[],
  edges: { source: string; target: string }[]
): LayoutResult {
  if (nodes.length === 0) {
    return { positions: new Map(), hasChanges: false };
  }
  
  const positions = new Map<string, { x: number; y: number }>();
  
  // Build parent-child mapping
  const children = new Map<string, string[]>();
  const parents = new Map<string, string>();
  
  edges.forEach(edge => {
    if (!children.has(edge.source)) {
      children.set(edge.source, []);
    }
    children.get(edge.source)!.push(edge.target);
    parents.set(edge.target, edge.source);
  });
  
  // Find root nodes (nodes with no parents)
  const roots = nodes.filter(n => !parents.has(n.id));
  
  // If no roots found, fall back to grid layout
  if (roots.length === 0) {
    return gridLayout(nodes);
  }
  
  // BFS to assign levels
  const levels = new Map<string, number>();
  const queue: { id: string; level: number }[] = roots.map(r => ({ id: r.id, level: 0 }));
  
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    levels.set(id, level);
    
    const nodeChildren = children.get(id) || [];
    nodeChildren.forEach(childId => {
      if (!levels.has(childId)) {
        queue.push({ id: childId, level: level + 1 });
      }
    });
  }
  
  // Group nodes by level
  const nodesByLevel = new Map<number, string[]>();
  levels.forEach((level, id) => {
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(id);
  });
  
  // Position nodes
  let hasChanges = false;
  nodesByLevel.forEach((nodeIds, level) => {
    const y = level * (DEFAULT_CARD_HEIGHT + GRID_GAP_Y * 2) + MARGIN;
    
    nodeIds.forEach((id, index) => {
      const x = index * (DEFAULT_CARD_WIDTH + GRID_GAP_X) + MARGIN;
      
      const node = nodes.find(n => n.id === id);
      if (node) {
        if (Math.abs(node.position.x - x) > 1 || Math.abs(node.position.y - y) > 1) {
          hasChanges = true;
        }
        positions.set(id, { x, y });
      }
    });
  });
  
  // Handle nodes not in any level (disconnected)
  const positioned = new Set(positions.keys());
  const unpositioned = nodes.filter(n => !positioned.has(n.id));
  
  if (unpositioned.length > 0) {
    const maxLevel = Math.max(...Array.from(nodesByLevel.keys()));
    const startY = (maxLevel + 2) * (DEFAULT_CARD_HEIGHT + GRID_GAP_Y) + MARGIN;
    
    unpositioned.forEach((node, index) => {
      const x = index * (DEFAULT_CARD_WIDTH + GRID_GAP_X) + MARGIN;
      positions.set(node.id, { x, y: startY });
      hasChanges = true;
    });
  }
  
  return { positions, hasChanges };
}

/**
 * Spread layout - push overlapping nodes apart
 */
export function spreadLayout(nodes: Node<ConversationNodeData>[]): LayoutResult {
  if (nodes.length === 0) {
    return { positions: new Map(), hasChanges: false };
  }
  
  // Clone positions
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach(node => {
    positions.set(node.id, { x: node.position.x, y: node.position.y });
  });
  
  let hasChanges = false;
  const maxIterations = 50;
  const repulsionForce = 20;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let anyOverlap = false;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const posA = positions.get(nodes[i].id)!;
        const posB = positions.get(nodes[j].id)!;
        
        const boxA: BoundingBox = {
          ...posA,
          width: nodes[i].width || DEFAULT_CARD_WIDTH,
          height: nodes[i].height || DEFAULT_CARD_HEIGHT,
        };
        const boxB: BoundingBox = {
          ...posB,
          width: nodes[j].width || DEFAULT_CARD_WIDTH,
          height: nodes[j].height || DEFAULT_CARD_HEIGHT,
        };
        
        if (boxesOverlap(boxA, boxB, MARGIN / 2)) {
          anyOverlap = true;
          hasChanges = true;
          
          // Calculate repulsion direction
          const centerAx = posA.x + boxA.width / 2;
          const centerAy = posA.y + boxA.height / 2;
          const centerBx = posB.x + boxB.width / 2;
          const centerBy = posB.y + boxB.height / 2;
          
          let dx = centerBx - centerAx;
          let dy = centerBy - centerAy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Handle coincident nodes - add random offset to separate them
          if (dist < 0.0001) {
            dx = (Math.random() - 0.5) * 2 * repulsionForce;
            dy = (Math.random() - 0.5) * 2 * repulsionForce;
          } else {
            dx = (dx / dist) * repulsionForce;
            dy = (dy / dist) * repulsionForce;
          }
          
          // Push nodes apart
          positions.set(nodes[i].id, { x: posA.x - dx, y: posA.y - dy });
          positions.set(nodes[j].id, { x: posB.x + dx, y: posB.y + dy });
        }
      }
    }
    
    if (!anyOverlap) break;
  }
  
  return { positions, hasChanges };
}

const layoutUtils = {
  detectOverlaps,
  getOverlapCount,
  gridLayout,
  treeLayout,
  spreadLayout,
};

export default layoutUtils;
