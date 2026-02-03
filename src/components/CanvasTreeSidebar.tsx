'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronDown, 
  Home, 
  GitBranch, 
  Plus, 
  Trash2, 
  PanelLeftClose, 
  PanelLeft,
  Folder,
  FolderOpen,
} from 'lucide-react';

import { useCanvasStore } from '@/stores/canvas-store';
import { colors, spacing, effects, typography, animation } from '@/lib/design-tokens';
import type { Canvas } from '@/types';

// =============================================================================
// STYLES
// =============================================================================

const sidebarStyles: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 260,
  backgroundColor: colors.navy.light,
  borderRight: `1px solid rgba(99, 102, 241, 0.2)`,
  display: 'flex',
  flexDirection: 'column',
  zIndex: 100,
  overflow: 'hidden',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: spacing[3],
  borderBottom: `1px solid rgba(99, 102, 241, 0.2)`,
};

const contentStyles: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: spacing[2],
};

const toggleButtonStyles: React.CSSProperties = {
  position: 'absolute',
  top: spacing[3],
  left: spacing[3],
  padding: spacing[2],
  backgroundColor: colors.navy.light,
  border: `1px solid rgba(99, 102, 241, 0.3)`,
  borderRadius: effects.border.radius.default,
  color: colors.contrast.grayDark,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99,
};

// =============================================================================
// TREE NODE COMPONENT
// =============================================================================

interface TreeNodeProps {
  canvas: Canvas;
  depth: number;
  isActive: boolean;
  children: Canvas[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateChild: (parentId: string) => void;
}

function TreeNode({ 
  canvas, 
  depth, 
  isActive, 
  children, 
  onSelect,
  onDelete,
  onCreateChild,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = children.length > 0;
  const isRoot = !canvas.parentCanvasId;

  return (
    <div>
      {/* Node row */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.05 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[1],
          padding: `${spacing[1]} ${spacing[2]}`,
          paddingLeft: `${8 + depth * 16}px`,
          backgroundColor: isActive ? `${colors.amber.primary}15` : 'transparent',
          borderRadius: effects.border.radius.default,
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
        }}
        onClick={() => onSelect(canvas.id)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: colors.contrast.grayDark,
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span style={{ width: 14 }} />
        )}

        {/* Icon */}
        {isRoot ? (
          <Home size={14} color={isActive ? colors.amber.primary : colors.contrast.grayDark} />
        ) : hasChildren ? (
          isExpanded ? (
            <FolderOpen size={14} color={isActive ? colors.amber.primary : colors.violet.primary} />
          ) : (
            <Folder size={14} color={isActive ? colors.amber.primary : colors.violet.primary} />
          )
        ) : (
          <GitBranch size={14} color={isActive ? colors.amber.primary : colors.contrast.grayDark} />
        )}

        {/* Name */}
        <span style={{
          flex: 1,
          fontSize: typography.sizes.sm,
          fontFamily: typography.fonts.body,
          color: isActive ? colors.amber.primary : colors.contrast.white,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {canvas.metadata.title}
        </span>

        {/* Actions (shown on hover via CSS or always for active) */}
        {isActive && (
          <div style={{ display: 'flex', gap: spacing[1] }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateChild(canvas.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: spacing[1],
                cursor: 'pointer',
                borderRadius: effects.border.radius.default,
                color: colors.navy.dark,
                backgroundColor: colors.amber.primary,
                display: 'flex',
                alignItems: 'center',
              }}
              title="Create child canvas"
            >
              <Plus size={12} />
            </button>
            {!isRoot && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(canvas.id);
                }}
                style={{
                  background: 'none',
                  border: `1px solid rgba(99, 102, 241, 0.3)`,
                  padding: spacing[1],
                  cursor: 'pointer',
                  borderRadius: effects.border.radius.default,
                  color: colors.contrast.grayDark,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Delete canvas"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            {children.map((child) => (
              <TreeNodeContainer
                key={child.id}
                canvas={child}
                depth={depth + 1}
                onSelect={onSelect}
                onDelete={onDelete}
                onCreateChild={onCreateChild}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Container that gets children from store
function TreeNodeContainer({
  canvas,
  depth,
  onSelect,
  onDelete,
  onCreateChild,
}: {
  canvas: Canvas;
  depth: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateChild: (parentId: string) => void;
}) {
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const getChildCanvases = useCanvasStore((s) => s.getChildCanvases);
  const children = getChildCanvases(canvas.id);

  return (
    <TreeNode
      canvas={canvas}
      depth={depth}
      isActive={canvas.id === activeCanvasId}
      children={children}
      onSelect={onSelect}
      onDelete={onDelete}
      onCreateChild={onCreateChild}
    />
  );
}

// =============================================================================
// CANVAS TREE SIDEBAR COMPONENT
// =============================================================================

export function CanvasTreeSidebar() {
  const [isOpen, setIsOpen] = useState(true);

  const canvases = useCanvasStore((s) => s.canvases);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const getRootCanvases = useCanvasStore((s) => s.getRootCanvases);
  const navigateToCanvas = useCanvasStore((s) => s.navigateToCanvas);
  const deleteCanvas = useCanvasStore((s) => s.deleteCanvas);
  const createCanvas = useCanvasStore((s) => s.createCanvas);

  // Get root canvases
  const rootCanvases = useMemo(() => getRootCanvases(), [getRootCanvases, canvases]);

  // Handlers
  const handleSelect = useCallback((id: string) => {
    navigateToCanvas(id);
  }, [navigateToCanvas]);

  const handleDelete = useCallback((id: string) => {
    if (confirm('Delete this canvas and all its children?')) {
      deleteCanvas(id);
    }
  }, [deleteCanvas]);

  const handleCreateChild = useCallback((parentId: string) => {
    createCanvas(`Branch ${Date.now()}`, parentId);
  }, [createCanvas]);

  // Toggle button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={toggleButtonStyles}
        title="Open canvas tree"
      >
        <PanelLeft size={18} />
      </button>
    );
  }

  return (
    <motion.aside
      initial={{ x: -260 }}
      animate={{ x: 0 }}
      exit={{ x: -260 }}
      transition={animation.spring.gentle}
      style={sidebarStyles}
    >
      {/* Header */}
      <div style={headerStyles}>
        <span style={{
          fontSize: typography.sizes.sm,
          fontWeight: 600,
          color: colors.contrast.white,
          fontFamily: typography.fonts.heading,
        }}>
          Canvas Tree
        </span>
        <div style={{ display: 'flex', gap: spacing[1] }}>
          <button
            onClick={() => createCanvas(`New Canvas ${canvases.length + 1}`)}
            style={{
              background: 'none',
              border: 'none',
              padding: spacing[1],
              cursor: 'pointer',
              borderRadius: effects.border.radius.default,
              color: colors.navy.dark,
              backgroundColor: colors.amber.primary,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Create new root canvas"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: `1px solid rgba(99, 102, 241, 0.3)`,
              padding: spacing[1],
              cursor: 'pointer',
              borderRadius: effects.border.radius.default,
              color: colors.contrast.grayDark,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Close sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      {/* Tree content */}
      <div style={contentStyles}>
        {rootCanvases.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: spacing[4],
            color: colors.contrast.grayDark,
            fontSize: typography.sizes.sm,
            fontFamily: typography.fonts.body,
          }}>
            <GitBranch size={32} style={{ marginBottom: spacing[2], opacity: 0.5 }} />
            <p>No canvases yet</p>
            <button
              onClick={() => createCanvas('My First Canvas')}
              style={{
                marginTop: spacing[2],
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: colors.amber.primary,
                border: 'none',
                borderRadius: effects.border.radius.default,
                color: colors.navy.dark,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                cursor: 'pointer',
              }}
            >
              Create Canvas
            </button>
          </div>
        ) : (
          rootCanvases.map((canvas) => (
            <TreeNodeContainer
              key={canvas.id}
              canvas={canvas}
              depth={0}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onCreateChild={handleCreateChild}
            />
          ))
        )}
      </div>

      {/* Footer with stats */}
      <div style={{
        padding: spacing[2],
        borderTop: `1px solid rgba(99, 102, 241, 0.2)`,
        fontSize: typography.sizes.xs,
        color: colors.contrast.grayDark,
        fontFamily: typography.fonts.body,
      }}>
        {canvases.length} canvas{canvases.length !== 1 ? 'es' : ''}
      </div>
    </motion.aside>
  );
}

export default CanvasTreeSidebar;
