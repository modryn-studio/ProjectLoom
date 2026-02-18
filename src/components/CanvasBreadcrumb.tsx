'use client';

import React, { useMemo, useCallback } from 'react';
import { ChevronRight, FileText } from 'lucide-react';

import { useCanvasStore } from '@/stores/canvas-store';
import { colors, spacing, effects, typography } from '@/lib/design-tokens';
import type { Conversation } from '@/types';

// =============================================================================
// STYLES
// =============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[1],
  padding: `${spacing[2]} ${spacing[3]}`,
  backgroundColor: colors.bg.secondary,
  borderRadius: effects.border.radius.default,
  flexWrap: 'nowrap',
  overflowX: 'auto',
  overflowY: 'hidden',
  whiteSpace: 'nowrap',
  minHeight: spacing[10],
};

const breadcrumbItemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[1],
  fontSize: typography.sizes.sm,
  fontFamily: typography.fonts.body,
  flexShrink: 0,
};

const clickableCrumbStyles: React.CSSProperties = {
  color: colors.fg.secondary,
  cursor: 'pointer',
  padding: `${spacing[1]} ${spacing[2]}`,
  borderRadius: effects.border.radius.default,
  transition: 'all 0.15s ease',
};

const activeCrumbStyles: React.CSSProperties = {
  color: colors.accent.primary,
  padding: `${spacing[1]} ${spacing[2]}`,
  fontWeight: typography.weights.medium,
};

const chevronStyles: React.CSSProperties = {
  color: colors.fg.tertiary,
  flexShrink: 0,
};

const contextButtonStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing[1],
  padding: `${spacing[1]} ${spacing[2]}`,
  backgroundColor: colors.bg.inset,
  border: `1px solid var(--border-primary)`,
  borderRadius: effects.border.radius.default,
  color: colors.fg.secondary,
  cursor: 'pointer',
  fontSize: typography.sizes.xs,
  fontFamily: typography.fonts.body,
  transition: 'all 0.15s ease',
};

const headerControlsStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: spacing[2],
  width: '100%',
};

const headerControlsRightStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[2],
};

// =============================================================================
// CANVAS BREADCRUMB COMPONENT
// =============================================================================

interface CanvasBreadcrumbProps {
  onFocusNode?: (nodeId: string) => void;
}

interface CanvasHeaderControlsProps {
  onOpenCanvasContext?: () => void;
}

export function CanvasHeaderControls({
  onOpenCanvasContext,
}: CanvasHeaderControlsProps) {
  return (
    <div style={headerControlsStyles}>
      <div style={headerControlsRightStyles}>
        {onOpenCanvasContext && (
          <button
            onClick={onOpenCanvasContext}
            title="Canvas Context (active canvas only)"
            style={contextButtonStyles}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.accent.muted;
              e.currentTarget.style.border = `1px solid ${colors.accent.primary}`;
              e.currentTarget.style.color = colors.accent.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.inset;
              e.currentTarget.style.border = '1px solid var(--border-primary)';
              e.currentTarget.style.color = colors.fg.secondary;
            }}
          >
            <FileText size={12} />
            Canvas Context
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * CanvasBreadcrumb - v4 Ancestry Navigation
 * 
 * Shows the conversation lineage from root to selected card.
 * For merge nodes, displays primary path + badge for additional parents.
 */
export function CanvasBreadcrumb({
  onFocusNode,
}: CanvasBreadcrumbProps) {
  const conversations = useCanvasStore((s) => s.conversations);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const openChatPanel = useCanvasStore((s) => s.openChatPanel);
  const workspaces = useCanvasStore((s) => s.workspaces);
  const activeWorkspaceId = useCanvasStore((s) => s.activeWorkspaceId);

  // Get current workspace
  const currentWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const workspaceName = currentWorkspace?.title || 'Workspace';

  // Get first selected conversation
  const selectedId = Array.from(selectedNodeIds)[0];
  const selectedConv = selectedId ? conversations.get(selectedId) : undefined;

  // Build breadcrumb path by tracing through first parent recursively
  const breadcrumbPath = useMemo(() => {
    if (!selectedConv) return [];

    const path: Conversation[] = [];
    const visited = new Set<string>();

    let current: Conversation | undefined = selectedConv;

    // Build path from selected back to root
    while (current) {
      // Prevent infinite loops
      if (visited.has(current.id)) break;
      visited.add(current.id);

      path.unshift(current);

      // Follow first parent (consistent with tree sidebar)
      const parentIds: string[] = current.parentCardIds || [];
      const firstParentId: string | undefined = parentIds[0];
      current = firstParentId ? conversations.get(firstParentId) : undefined;
    }

    return path;
  }, [selectedConv, conversations]);

  // Click handlers
  const handleCrumbClick = useCallback((convId: string) => {
    setSelected([convId]);
    openChatPanel(convId);
    if (onFocusNode) {
      onFocusNode(convId);
    }
  }, [setSelected, openChatPanel, onFocusNode]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (event.deltaY === 0) return;
    const target = event.currentTarget;
    if (target.scrollWidth <= target.clientWidth) return;
    event.preventDefault();
    target.scrollLeft += event.deltaY;
  }, []);
  
  // Calculate canvas stats
  const totalCards = conversations.size;
  const mergeNodes = useMemo(() => {
    let count = 0;
    conversations.forEach((conv) => {
      if (conv.isMergeNode) count++;
    });
    return count;
  }, [conversations]);
  
  return (
    <nav
      style={containerStyles}
      className="breadcrumb-scroll"
      aria-label="Conversation ancestry"
      onWheel={handleWheel}
    >
      {/* Workspace name + stats (only when no cards selected) */}
      {selectedNodeIds.size === 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[3],
        }}>
          <span
            style={{
              ...breadcrumbItemStyles,
              color: colors.fg.tertiary,
            }}
          >
            {workspaceName}
          </span>
          <span style={{
            fontSize: typography.sizes.xs,
            color: colors.fg.tertiary,
            padding: `${spacing[1]} ${spacing[2]}`,
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: effects.border.radius.default,
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
          }}>
            <span>{totalCards} {totalCards === 1 ? 'card' : 'cards'}</span>
            {mergeNodes > 0 && (
              <>
                <span style={{ color: 'var(--fg-tertiary)' }}>|</span>
                <span style={{ color: colors.semantic.success }}>{mergeNodes} {mergeNodes === 1 ? 'merge' : 'merges'}</span>
              </>
            )}
          </span>
        </div>
      )}
      
      {/* Show multi-selection indicator */}
      {selectedNodeIds.size > 1 && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing[1],
          padding: `${spacing[1]} ${spacing[2]}`,
          backgroundColor: colors.accent.muted,
          color: colors.accent.primary,
          borderRadius: effects.border.radius.default,
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
        }}>
          {selectedNodeIds.size} selected
        </span>
      )}

      {/* Breadcrumb trail */}
      {selectedNodeIds.size === 1 && breadcrumbPath.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
          {breadcrumbPath.map((conv, index) => {
            const isLast = index === breadcrumbPath.length - 1;
            return (
            <React.Fragment key={conv.id}>
              <span
                style={isLast ? activeCrumbStyles : clickableCrumbStyles}
                onClick={() => !isLast && handleCrumbClick(conv.id)}
                onMouseEnter={(e) => {
                  if (!isLast) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg.inset;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLast) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }
                }}
              >
                {conv.metadata.title}
              </span>
              {!isLast && (
                <ChevronRight size={14} style={chevronStyles} />
              )}
            </React.Fragment>
          );
          })}
        </div>
      )}

    </nav>
  );
}

export default CanvasBreadcrumb;
