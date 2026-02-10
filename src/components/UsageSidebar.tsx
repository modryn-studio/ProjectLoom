'use client';

import React, { useMemo, useCallback } from 'react';
import { BarChart3, X } from 'lucide-react';

import { colors, spacing, effects, typography } from '@/lib/design-tokens';
import { useCanvasStore, selectUsagePanelOpen } from '@/stores/canvas-store';
import { UsageDisplay } from '@/components/UsageDisplay';
import { SidePanel } from '@/components/SidePanel';

const PANEL_WIDTH = 360;

export function UsageSidebar() {
  const usagePanelOpen = useCanvasStore(selectUsagePanelOpen);
  const closeUsagePanel = useCanvasStore((s) => s.closeUsagePanel);

  const handleClose = useCallback(() => {
    closeUsagePanel();
  }, [closeUsagePanel]);

  const panelStyles = useMemo<React.CSSProperties>(() => ({
    position: 'relative',
    backgroundColor: colors.bg.secondary,
    borderLeft: usagePanelOpen ? `1px solid ${colors.border.default}` : 'none',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    zIndex: 2,
    flexShrink: 0,
    minWidth: 0,
    maxWidth: PANEL_WIDTH,
    pointerEvents: usagePanelOpen ? 'auto' : 'none',
  }), [usagePanelOpen]);

  const headerStyles = useMemo<React.CSSProperties>(() => ({
    padding: `${spacing[2]} ${spacing[3]}`,
    borderBottom: `1px solid ${colors.border.default}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  }), []);

  const titleStyles = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.fg.primary,
    fontFamily: typography.fonts.heading,
  }), []);

  const contentStyles = useMemo<React.CSSProperties>(() => ({
    padding: spacing[3],
    overflowY: 'auto',
    flex: 1,
  }), []);

  return (
    <SidePanel
      isOpen={usagePanelOpen}
      width={PANEL_WIDTH}
      style={panelStyles}
    >
      <div style={headerStyles}>
        <div style={titleStyles}>
          <BarChart3 size={16} color={colors.accent.primary} />
          Usage
        </div>
        <button
          onClick={handleClose}
          title="Close usage panel"
          style={{
            background: 'none',
            border: 'none',
            color: colors.fg.quaternary,
            cursor: 'pointer',
            padding: spacing[1],
            borderRadius: effects.border.radius.default,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={contentStyles}>
        <UsageDisplay />
      </div>
    </SidePanel>
  );
}

export default UsageSidebar;
