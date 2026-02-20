'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Map,
  MessageSquare,
  FolderOpen,
  BarChart3,
  Settings,
} from 'lucide-react';

import { colors, spacing, typography } from '@/lib/design-tokens';
import { zIndex } from '@/constants/zIndex';
import { useCanvasStore, selectChatPanelOpen, selectActiveConversationId } from '@/stores/canvas-store';

// =============================================================================
// TYPES
// =============================================================================

export type MobileTab = 'workspaces' | 'canvas' | 'chat' | 'usage' | 'settings';

interface MobileLayoutProps {
  children: React.ReactNode;
  /** Rendered <InfiniteCanvas /> for the canvas tab — must be inside ReactFlowProvider */
  canvasElement: React.ReactNode;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const NAV_HEIGHT = 56;

const TAB_CONFIG: { id: MobileTab; label: string; icon: typeof Map }[] = [
  { id: 'workspaces', label: 'Spaces', icon: FolderOpen },
  { id: 'canvas', label: 'Canvas', icon: Map },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// =============================================================================
// MOBILE LAYOUT CONTEXT — allows children to read/set the active tab
// =============================================================================

interface MobileLayoutContextValue {
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
  navHeight: number;
}

export const MobileLayoutContext = React.createContext<MobileLayoutContextValue>({
  activeTab: 'canvas',
  setActiveTab: () => {},
  navHeight: NAV_HEIGHT,
});

export function useMobileLayout() {
  return React.useContext(MobileLayoutContext);
}

// =============================================================================
// MOBILE LAYOUT COMPONENT
// =============================================================================

export function MobileLayout({ children, canvasElement }: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>('canvas');

  // Auto-switch to chat tab when a conversation is opened via the store.
  // Using subscribe avoids the "setState in effect body" lint rule because
  // the setState call happens inside the subscription callback, not the effect body.
  useEffect(() => {
    const unsub = useCanvasStore.subscribe((state, prev) => {
      const nowOpen = selectChatPanelOpen(state);
      const nowId = selectActiveConversationId(state);
      const wasOpen = selectChatPanelOpen(prev);
      const wasId = selectActiveConversationId(prev);

      if (nowOpen && nowId && (!wasOpen || wasId !== nowId)) {
        setActiveTab('chat');
      }
    });
    return unsub;
  }, []);

  // Read current values for rendering
  const chatPanelOpen = useCanvasStore(selectChatPanelOpen);
  const activeConversationId = useCanvasStore(selectActiveConversationId);

  // Track if there's an unread chat (card opened but user is on another tab)
  const hasActiveChat = Boolean(chatPanelOpen && activeConversationId);

  const contextValue = useMemo(() => ({
    activeTab,
    setActiveTab,
    navHeight: NAV_HEIGHT,
  }), [activeTab]);

  return (
    <MobileLayoutContext.Provider value={contextValue}>
      <div style={shellStyles}>
        {/* Content area — all tabs render but only active one is visible.
            Canvas is always mounted to preserve React Flow state. */}
        <div style={contentAreaStyles}>
          {/* Canvas tab — always mounted, visibility toggled */}
          <div style={{
            ...tabPanelStyles,
            display: activeTab === 'canvas' ? 'flex' : 'none',
          }}>
            {canvasElement}
          </div>

          {/* Other tabs — conditionally rendered */}
          {activeTab !== 'canvas' && (
            <div style={tabPanelStyles}>
              {children}
            </div>
          )}
        </div>

        {/* Bottom Navigation Bar — uses CSS class for env() safe-area support */}
        <nav className="mobile-nav" style={navBarStyles}>
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            // Show a dot indicator on Chat tab when there's an active conversation but user isn't on chat tab
            const showDot = id === 'chat' && hasActiveChat && activeTab !== 'chat';

            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  ...navButtonStyles,
                  color: isActive ? colors.accent.primary : colors.fg.tertiary,
                }}
              >
                <div style={iconContainerStyles}>
                  <Icon size={20} />
                  {showDot && <div style={dotIndicatorStyles} />}
                </div>
                <span style={{
                  ...navLabelStyles,
                  color: isActive ? colors.accent.primary : colors.fg.tertiary,
                  fontWeight: isActive ? typography.weights.semibold : typography.weights.normal,
                }}>
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </MobileLayoutContext.Provider>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const shellStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100vw',
  height: '100dvh', // dvh handles iOS keyboard correctly
  overflow: 'hidden',
  backgroundColor: colors.bg.primary,
};

const contentAreaStyles: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
  minHeight: 0,
};

const tabPanelStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

// NOTE: height/paddingBottom for safe-area-inset are set via the `.mobile-nav`
// CSS class in globals.css. React inline styles don't support env().
const navBarStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
  backgroundColor: colors.bg.secondary,
  borderTop: `1px solid ${colors.border.default}`,
  zIndex: zIndex.ui.sidePanel + 1,
  flexShrink: 0,
  touchAction: 'manipulation',
};

const navButtonStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  flex: 1,
  height: '100%',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: `${spacing[1]} 0`,
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
};

const navLabelStyles: React.CSSProperties = {
  fontSize: '10px',
  fontFamily: typography.fonts.body,
  lineHeight: 1,
  transition: 'color 0.15s ease',
};

const iconContainerStyles: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dotIndicatorStyles: React.CSSProperties = {
  position: 'absolute',
  top: -2,
  right: -6,
  width: 6,
  height: 6,
  borderRadius: '50%',
  backgroundColor: colors.accent.primary,
};

export default MobileLayout;
