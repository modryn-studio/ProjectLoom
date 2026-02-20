'use client';

import React, { useCallback } from 'react';

import { useMobileLayout } from './MobileLayout';
import { ChatPanel } from './ChatPanel';
import { UsageDisplay } from './UsageDisplay';
import { SettingsPanel } from './SettingsPanel';
import { CanvasTreeSidebar } from './CanvasTreeSidebar';
import { useCanvasStore } from '@/stores/canvas-store';
import { colors, spacing, typography } from '@/lib/design-tokens';

// =============================================================================
// MOBILE TAB CONTENT
// =============================================================================

/**
 * Renders content for the active mobile tab (everything except canvas,
 * which is handled by MobileLayout directly for React Flow state preservation).
 */
export function MobileTabContent() {
  const { activeTab, setActiveTab } = useMobileLayout();

  // Workspace sidebar needs these callbacks
  const requestDeleteWorkspace = useCanvasStore((s) => s.deleteWorkspace);
  const requestFocusNode = useCanvasStore((s) => s.requestFocusNode);

  const handleOpenSettings = useCallback(() => {
    setActiveTab('settings');
  }, [setActiveTab]);

  const handleOpenAgents = useCallback(() => {
    // Could open agent dialog — for now, just stay on workspaces
  }, []);

  const handleFocusNode = useCallback((nodeId: string) => {
    requestFocusNode(nodeId);
    setActiveTab('canvas');
  }, [requestFocusNode, setActiveTab]);

  switch (activeTab) {
    case 'workspaces':
      return (
        <div style={fullPanelStyles}>
          <CanvasTreeSidebar
            onOpenSettings={handleOpenSettings}
            onOpenAgents={handleOpenAgents}
            onRequestDeleteWorkspace={(id) => requestDeleteWorkspace(id)}
            onRequestCreateWorkspace={() => {}}
            isOpen={true}
            onToggle={() => {}}
            onFocusNode={handleFocusNode}
            isMobile
          />
        </div>
      );

    case 'chat':
      return (
        <div style={fullPanelStyles}>
          <ChatPanel isMobile />
        </div>
      );

    case 'usage':
      return (
        <div style={scrollablePanelStyles}>
          <div style={panelHeaderStyles}>
            <h2 style={panelTitleStyles}>Usage</h2>
          </div>
          <div style={panelContentStyles}>
            <UsageDisplay />
          </div>
        </div>
      );

    case 'settings':
      return (
        <SettingsPanel isOpen={true} onClose={() => setActiveTab('canvas')} isMobile />
      );

    default:
      return null;
  }
}

// =============================================================================
// STYLES
// =============================================================================

const fullPanelStyles: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backgroundColor: colors.bg.secondary,
};

const scrollablePanelStyles: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backgroundColor: colors.bg.secondary,
};

const panelHeaderStyles: React.CSSProperties = {
  padding: `${spacing[3]} ${spacing[4]}`,
  borderBottom: `1px solid ${colors.border.default}`,
  flexShrink: 0,
};

const panelTitleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: typography.sizes.lg,
  fontFamily: typography.fonts.heading,
  fontWeight: typography.weights.semibold,
  color: colors.fg.primary,
};

const panelContentStyles: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: spacing[3],
  WebkitOverflowScrolling: 'touch',
};

export default MobileTabContent;
