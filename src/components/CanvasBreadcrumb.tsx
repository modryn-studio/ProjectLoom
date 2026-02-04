'use client';

import React from 'react';
import { Folder } from 'lucide-react';

import { useCanvasStore } from '@/stores/canvas-store';
import { colors, spacing, effects, typography } from '@/lib/design-tokens';

// =============================================================================
// STYLES
// =============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[1],
  padding: `${spacing[2]} ${spacing[3]}`,
  backgroundColor: colors.navy.light,
  borderRadius: effects.border.radius.default,
  maxWidth: '80vw',
};

const labelStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[1],
  padding: `${spacing[1]} ${spacing[2]}`,
  color: colors.amber.primary,
  fontSize: typography.sizes.sm,
  fontFamily: typography.fonts.body,
};

// =============================================================================
// CANVAS BREADCRUMB COMPONENT
// =============================================================================

/**
 * CanvasBreadcrumb - v4 Simplified Version
 * 
 * In v4, workspaces are flat (no hierarchy), so this just shows
 * the current workspace name. No navigation lineage needed.
 */
export function CanvasBreadcrumb() {
  const getCurrentWorkspace = useCanvasStore((s) => s.getCurrentWorkspace);
  
  const currentWorkspace = getCurrentWorkspace();

  // Don't render if no workspace
  if (!currentWorkspace) {
    return null;
  }

  return (
    <nav style={containerStyles} aria-label="Workspace indicator">
      <div style={labelStyles}>
        <Folder size={14} />
        <span style={{
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {currentWorkspace.metadata.title}
        </span>
      </div>
    </nav>
  );
}

export default CanvasBreadcrumb;
