'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { ChevronRight, Zap, PanelLeft } from 'lucide-react';

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
  flexWrap: 'wrap',
  minHeight: '40px',
};

const breadcrumbItemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[1],
  fontSize: typography.sizes.sm,
  fontFamily: typography.fonts.body,
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
  fontWeight: 500,
};

const chevronStyles: React.CSSProperties = {
  color: colors.fg.quaternary,
  flexShrink: 0,
};

const mergeBadgeStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing[1],
  padding: `2px ${spacing[2]}`,
  backgroundColor: colors.semantic.success + '20',
  color: colors.semantic.success,
  borderRadius: effects.border.radius.default,
  fontSize: typography.sizes.xs,
  fontWeight: 600,
  marginLeft: spacing[1],
  cursor: 'help',
  position: 'relative',
};

const sidebarToggleButtonStyles: React.CSSProperties = {
  padding: spacing[2],
  backgroundColor: colors.bg.inset,
  border: `1px solid var(--border-primary)`,
  borderRadius: effects.border.radius.default,
  color: colors.fg.quaternary,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
  flexShrink: 0,
  minWidth: '36px',
  minHeight: '36px',
};

// =============================================================================
// CANVAS BREADCRUMB COMPONENT
// =============================================================================

interface CanvasBreadcrumbProps {
  showSidebarToggle?: boolean;
  onToggleSidebar?: () => void;
}

/**
 * CanvasBreadcrumb - v4 Ancestry Navigation
 * 
 * Shows the conversation lineage from root to selected card.
 * For merge nodes, displays primary path + badge for additional parents.
 */
export function CanvasBreadcrumb({ showSidebarToggle = false, onToggleSidebar }: CanvasBreadcrumbProps) {
  const conversations = useCanvasStore((s) => s.conversations);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const workspaces = useCanvasStore((s) => s.workspaces);
  const activeWorkspaceId = useCanvasStore((s) => s.activeWorkspaceId);
  
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipParents, setTooltipParents] = useState<string[]>([]);

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
  }, [setSelected]);

  const handleBadgeHover = useCallback((parents: string[]) => {
    setTooltipParents(parents);
    setTooltipVisible(true);
  }, []);

  const handleBadgeLeave = useCallback(() => {
    setTooltipVisible(false);
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
    <nav style={containerStyles} aria-label="Conversation ancestry">
      {/* Sidebar toggle button (when sidebar is hidden) */}
      {showSidebarToggle && (
        <button
          onClick={onToggleSidebar}
          style={sidebarToggleButtonStyles}
          title="Open workspace list"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.accent.muted;
            e.currentTarget.style.borderColor = colors.accent.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.bg.inset;
            e.currentTarget.style.borderColor = 'var(--border-primary)';
          }}
        >
          <PanelLeft size={16} />
        </button>
      )}
      
      {/* Show workspace name + stats when no card selected */}
      {breadcrumbPath.length === 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[3],
          marginLeft: showSidebarToggle ? spacing[1] : 0,
        }}>
          <span
            style={{
              ...breadcrumbItemStyles,
              color: colors.fg.quaternary,
            }}
          >
            {workspaceName}
          </span>
          <span style={{
            fontSize: typography.sizes.xs,
            color: colors.fg.quaternary,
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
          fontWeight: 600,
          marginLeft: showSidebarToggle ? spacing[1] : 0,
        }}>
          {selectedNodeIds.size} selected
        </span>
      )}
      
      {/* Show breadcrumb path (only when exactly 1 card selected) */}
      {selectedNodeIds.size === 1 && breadcrumbPath.map((conv, index) => {
        const isLast = index === breadcrumbPath.length - 1;
        const isMergeNode = conv.isMergeNode && conv.parentCardIds.length > 1;
        const additionalParents = isMergeNode ? conv.parentCardIds.length - 1 : 0;
        
        // Get other parent names for tooltip
        const otherParentNames = isMergeNode
          ? conv.parentCardIds.slice(1).map(pid => {
              const parent = conversations.get(pid);
              return parent?.metadata.title || 'Unknown';
            })
          : [];

        return (
          <React.Fragment key={conv.id}>
            <div style={breadcrumbItemStyles}>
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
                {isMergeNode && '🔀 '}{conv.metadata.title}
              </span>
              
              {isMergeNode && (
                <span
                  style={mergeBadgeStyles}
                  onMouseEnter={() => handleBadgeHover(otherParentNames)}
                  onMouseLeave={handleBadgeLeave}
                  title={`Also merged from: ${otherParentNames.join(', ')}`}
                >
                  <Zap size={10} />
                  +{additionalParents}
                  
                  {/* Tooltip */}
                  {tooltipVisible && tooltipParents.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginTop: spacing[1],
                      padding: spacing[2],
                      backgroundColor: colors.bg.inset,
                      border: `1px solid ${colors.bg.secondary}`,
                      borderRadius: effects.border.radius.default,
                      fontSize: typography.sizes.xs,
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      pointerEvents: 'none',
                    }}>
                      <div style={{ color: colors.fg.quaternary, marginBottom: spacing[1], fontSize: typography.sizes.xs }}>
                        Also merged from:
                      </div>
                      {otherParentNames.map((name, i) => (
                        <div key={i} style={{ color: colors.fg.secondary }}>• {name}</div>
                      ))}
                    </div>
                  )}
                </span>
              )}
            </div>
            
            {!isLast && (
              <ChevronRight size={14} style={chevronStyles} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default CanvasBreadcrumb;
