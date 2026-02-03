'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { Home, ChevronRight, GitBranch } from 'lucide-react';

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
  overflowX: 'auto',
  scrollbarWidth: 'thin',
};

const crumbStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[1],
  padding: `${spacing[1]} ${spacing[2]}`,
  background: 'transparent',
  border: 'none',
  borderRadius: effects.border.radius.default,
  color: colors.contrast.grayDark,
  fontSize: typography.sizes.sm,
  fontFamily: typography.fonts.body,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const activeCrumbStyles: React.CSSProperties = {
  ...crumbStyles,
  color: colors.amber.primary,
  cursor: 'default',
};

const separatorStyles: React.CSSProperties = {
  color: colors.contrast.grayDark,
  display: 'flex',
  alignItems: 'center',
};

// =============================================================================
// CANVAS BREADCRUMB COMPONENT
// =============================================================================

export function CanvasBreadcrumb() {
  const getCanvasLineage = useCanvasStore((s) => s.getCanvasLineage);
  const navigateToCanvas = useCanvasStore((s) => s.navigateToCanvas);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const canvases = useCanvasStore((s) => s.canvases);

  const containerRef = useRef<HTMLDivElement>(null);

  // Get lineage from root to current
  const lineage = useMemo(() => {
    return getCanvasLineage(activeCanvasId);
  }, [getCanvasLineage, activeCanvasId, canvases]);

  // Auto-scroll to the end (current item) when lineage changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [lineage]);

  // Handle horizontal scroll with mouse wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Convert vertical scroll to horizontal
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Don't render if at root (no lineage)
  if (lineage.length <= 1) {
    return null;
  }

  return (
    <nav ref={containerRef} style={containerStyles} aria-label="Canvas navigation">
      {lineage.map((canvas, index) => {
        const isActive = canvas.id === activeCanvasId;
        const isFirst = index === 0;
        const isLast = index === lineage.length - 1;

        return (
          <React.Fragment key={canvas.id}>
            {/* Separator */}
            {!isFirst && (
              <span style={separatorStyles}>
                <ChevronRight size={14} />
              </span>
            )}

            {/* Crumb button */}
            <button
              onClick={() => !isActive && navigateToCanvas(canvas.id)}
              style={isActive ? activeCrumbStyles : crumbStyles}
              disabled={isActive}
              title={canvas.metadata.title}
            >
              {isFirst ? (
                <Home size={14} />
              ) : (
                <GitBranch size={14} />
              )}
              <span style={{
                maxWidth: isLast ? 200 : 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {canvas.metadata.title}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default CanvasBreadcrumb;
