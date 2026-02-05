'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PanelRightClose } from 'lucide-react';

import { colors, typography, spacing, effects, animation } from '@/lib/design-tokens';
import { useCanvasStore, selectChatPanelOpen, selectActiveConversationId } from '@/stores/canvas-store';
import { usePreferencesStore, selectUIPreferences } from '@/stores/preferences-store';
import { ChatPanelHeader } from './ChatPanelHeader';
import { MessageThread } from './MessageThread';
import { MessageInput } from './MessageInput';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_PANEL_WIDTH = 400;
const MAX_PANEL_WIDTH = 800;

// =============================================================================
// CHAT PANEL COMPONENT
// =============================================================================

interface ChatPanelProps {
  onFocusNode?: (nodeId: string) => void;
}

export function ChatPanel({ onFocusNode }: ChatPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  
  // State from stores
  const chatPanelOpen = useCanvasStore(selectChatPanelOpen);
  const activeConversationId = useCanvasStore(selectActiveConversationId);
  const conversations = useCanvasStore((s) => s.conversations);
  const closeChatPanel = useCanvasStore((s) => s.closeChatPanel);
  
  // UI preferences for persisted width
  const uiPrefs = usePreferencesStore(selectUIPreferences);
  const setUIPreferences = usePreferencesStore((s) => s.setUIPreferences);
  
  // Local resize state
  const [panelWidth, setPanelWidth] = useState(uiPrefs.chatPanelWidth || 480);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);

  // Sync with preferences when they change
  useEffect(() => {
    if (uiPrefs.chatPanelWidth && !isResizing) {
      setPanelWidth(uiPrefs.chatPanelWidth);
    }
  }, [uiPrefs.chatPanelWidth, isResizing]);

  // Get active conversation
  const activeConversation = activeConversationId 
    ? conversations.get(activeConversationId) 
    : null;

  // Resize handlers (IDENTICAL to CanvasTreeSidebar)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // For right panel, calculate width from right edge
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, newWidth));
      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Persist width to preferences when resize ends
      // Use functional update to get current width (avoid stale closure)
      setPanelWidth(currentWidth => {
        setUIPreferences({ chatPanelWidth: currentWidth });
        return currentWidth;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setUIPreferences]);

  // Handle close
  const handleClose = useCallback(() => {
    closeChatPanel();
  }, [closeChatPanel]);

  // Memoized panel styles to prevent object recreation on every render
  const panelStyles = useMemo<React.CSSProperties>(() => ({
    position: 'fixed',
    top: 0,
    right: 0,
    width: panelWidth,
    minWidth: MIN_PANEL_WIDTH,
    maxWidth: MAX_PANEL_WIDTH,
    backgroundColor: colors.navy.light,
    borderLeft: `1px solid rgba(99, 102, 241, 0.2)`,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
    userSelect: isResizing ? 'none' : 'auto',
    zIndex: 100,
  }), [panelWidth, isResizing]);

  // Memoized resize handle styles
  const resizeHandleStyles = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: 0,
    left: -2,
    width: isResizing || isResizeHovered ? 4 : 4,
    height: '100%',
    cursor: 'ew-resize',
    backgroundColor: isResizing || isResizeHovered ? colors.amber.primary : 'transparent',
    transition: isResizing ? 'none' : 'background-color 0.15s ease, width 0.15s ease',
    zIndex: 30,
  }), [isResizing, isResizeHovered]);

  // Don't render when closed
  if (!chatPanelOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      {chatPanelOpen && (
        <motion.aside
          ref={panelRef}
          initial={{ x: panelWidth }}
          animate={{ x: 0 }}
          exit={{ x: panelWidth }}
          transition={animation.spring.snappy}
          style={panelStyles}
        >
          {/* Resize handle */}
          <div
            style={resizeHandleStyles}
            onMouseDown={handleMouseDown}
            onMouseEnter={() => setIsResizeHovered(true)}
            onMouseLeave={() => setIsResizeHovered(false)}
          />

          {/* Content */}
          {activeConversation ? (
            <>
              {/* Header */}
              <ChatPanelHeader
                conversation={activeConversation}
                onClose={handleClose}
              />

              {/* Message Thread */}
              <MessageThread
                conversation={activeConversation}
              />

              {/* Message Input */}
              <MessageInput
                conversationId={activeConversation.id}
              />
            </>
          ) : (
            /* Empty state */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: spacing[6],
              color: colors.contrast.grayDark,
              textAlign: 'center',
            }}>
              <PanelRightClose size={48} style={{ marginBottom: spacing[4], opacity: 0.4 }} />
              <p style={{
                fontSize: typography.sizes.base,
                fontFamily: typography.fonts.body,
                margin: 0,
              }}>
                Select a card to start chatting
              </p>
              <p style={{
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                marginTop: spacing[2],
                opacity: 0.7,
              }}>
                Click on any conversation card in the canvas
              </p>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export default ChatPanel;
