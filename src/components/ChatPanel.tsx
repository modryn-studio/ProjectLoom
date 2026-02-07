'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChat } from 'ai/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PanelRightClose } from 'lucide-react';

import { colors, typography, spacing, effects, animation } from '@/lib/design-tokens';
import { useCanvasStore, selectChatPanelOpen, selectActiveConversationId } from '@/stores/canvas-store';
import { usePreferencesStore, selectUIPreferences } from '@/stores/preferences-store';
import { apiKeyManager } from '@/lib/api-key-manager';
import { getAvailableModels, getDefaultModel, getModelById } from '@/lib/vercel-ai-integration';
import { ChatPanelHeader } from './ChatPanelHeader';
import { MessageThread } from './MessageThread';
import { MessageInput } from './MessageInput';
import type { MessageAttachment } from '@/types';

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
  const panelWidthRef = useRef<number>(480); // Track current width for mouseup handler
  
  // State from stores — use targeted selector to only re-render when active conversation changes
  const chatPanelOpen = useCanvasStore(selectChatPanelOpen);
  const activeConversationId = useCanvasStore(selectActiveConversationId);
  const activeConversation = useCanvasStore(
    useCallback((s) => s.activeConversationId ? s.conversations.get(s.activeConversationId) ?? null : null, [])
  );
  const closeChatPanel = useCanvasStore((s) => s.closeChatPanel);
  const addAIMessage = useCanvasStore((s) => s.addAIMessage);
  const getConversationMessages = useCanvasStore((s) => s.getConversationMessages);
  const getConversationModel = useCanvasStore((s) => s.getConversationModel);
  const setConversationModel = useCanvasStore((s) => s.setConversationModel);
  
  // UI preferences for persisted width
  const uiPrefs = usePreferencesStore(selectUIPreferences);
  const setUIPreferences = usePreferencesStore((s) => s.setUIPreferences);
  
  // Local resize state
  const [panelWidth, setPanelWidth] = useState(uiPrefs.chatPanelWidth || 480);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Keep ref in sync with state
  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  // Determine current model for conversation
  const currentModel = useMemo(() => {
    if (!activeConversationId) return null;
    
    // Check if conversation has a model set
    const savedModel = getConversationModel(activeConversationId);
    if (savedModel) return savedModel;
    
    // Otherwise, determine default based on available API keys
    const hasAnthropicKey = !!apiKeyManager.getKey('anthropic');
    const hasOpenAIKey = !!apiKeyManager.getKey('openai');
    
    if (hasAnthropicKey) {
      return getDefaultModel('anthropic').id;
    } else if (hasOpenAIKey) {
      return getDefaultModel('openai').id;
    }
    
    return null;
  }, [activeConversationId, getConversationModel]);

  // Get API key for current model
  const currentApiKey = useMemo(() => {
    if (!currentModel) return null;
    
    if (currentModel.startsWith('claude') || currentModel.startsWith('anthropic')) {
      return apiKeyManager.getKey('anthropic');
    }
    return apiKeyManager.getKey('openai');
  }, [currentModel]);

  // Check if we have any API key configured
  // Note: apiKeyManager reads from localStorage; no reactive deps, but we re-check
  // on every render to pick up keys added mid-session. This is cheap (sync reads).
  const hasAnyApiKey = !!apiKeyManager.getKey('anthropic') || !!apiKeyManager.getKey('openai');

  // Check if current model supports vision
  const supportsVision = useMemo(() => {
    if (!currentModel) return false;
    const modelDef = getModelById(currentModel);
    return modelDef?.supportsVision ?? false;
  }, [currentModel]);

  // Attachment state for vision
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);

  // useChat hook for streaming AI responses
  const {
    messages: chatMessages,
    input,
    setInput,
    handleSubmit: rawHandleSubmit,
    isLoading: isStreaming,
    stop,
    error: chatError,
    setMessages,
  } = useChat({
    api: '/api/chat',
    id: activeConversationId || undefined,
    body: {
      model: currentModel,
      apiKey: currentApiKey,
      // Pass image attachments for vision
      ...(pendingAttachments.length > 0 ? {
        attachments: pendingAttachments.map(a => ({
          contentType: a.contentType,
          name: a.name,
          url: a.url,
        })),
      } : {}),
    },
    onFinish: (message: { content: string }) => {
      // Persist AI message to store when streaming finishes
      if (activeConversationId && currentModel) {
        addAIMessage(activeConversationId, message.content, currentModel);
      }
      // Clear attachments after send
      setPendingAttachments([]);
    },
    onError: (error: Error) => {
      console.error('[ChatPanel] AI Error:', error);
    },
  });

  // Wrap handleSubmit to also store attachments on user message
  const handleSubmit = useCallback((e: React.FormEvent) => {
    // If there are pending attachments, they've already been passed via body
    rawHandleSubmit(e);
  }, [rawHandleSubmit]);

  // Sync store messages to useChat when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      const storeMessages = getConversationMessages(activeConversationId);
      // Convert to useChat format
      const formattedMessages = storeMessages.map((msg, idx) => ({
        id: `msg-${idx}`,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));
      setMessages(formattedMessages);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, getConversationMessages, setMessages]);

  // Sync with preferences when they change
  useEffect(() => {
    if (uiPrefs.chatPanelWidth && !isResizing) {
      setPanelWidth(uiPrefs.chatPanelWidth);
    }
  }, [uiPrefs.chatPanelWidth, isResizing]);

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
      // Persist width to preferences when resize ends using ref value
      setUIPreferences({ chatPanelWidth: panelWidthRef.current });
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
    setIsMaximized(false);
  }, [closeChatPanel]);

  const handleMaximize = useCallback(() => {
    setIsMaximized(!isMaximized);
  }, [isMaximized]);

  // Memoized panel styles to prevent object recreation on every render
  const panelStyles = useMemo<React.CSSProperties>(() => ({
    position: 'fixed',
    top: 0,
    left: isMaximized ? 0 : 'auto',
    right: 0,
    width: isMaximized ? '100vw' : panelWidth,
    minWidth: isMaximized ? '100vw' : MIN_PANEL_WIDTH,
    maxWidth: isMaximized ? '100vw' : MAX_PANEL_WIDTH,
    backgroundColor: colors.bg.secondary,
    borderLeft: isMaximized ? 'none' : `1px solid ${colors.border.default}`,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
    userSelect: isResizing ? 'none' : 'auto',
    zIndex: isMaximized ? 200 : 100,
  }), [panelWidth, isResizing, isMaximized]);

  // Memoized resize handle styles
  const resizeHandleStyles = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: 16,
    height: '100%',
    cursor: 'ew-resize',
    zIndex: 30,
    display: isMaximized ? 'none' : 'block',
  }), [isMaximized]);
  
  const resizeLineStyles = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: 3,
    height: '100%',
    backgroundColor: isResizing || isResizeHovered ? colors.accent.primary : 'transparent',
    transition: isResizing ? 'none' : 'background-color 0.15s ease',
    pointerEvents: 'none',
  }), [isResizing, isResizeHovered]);

  // Stable callback for resize hover
  const handleResizeEnter = useCallback(() => setIsResizeHovered(true), []);
  const handleResizeLeave = useCallback(() => setIsResizeHovered(false), []);

  // Stable callback for model change (avoids inline arrow in JSX)
  const handleModelChange = useCallback((model: string) => {
    if (activeConversationId) {
      setConversationModel(activeConversationId, model);
    }
  }, [activeConversationId, setConversationModel]);

  // Don't render when closed
  if (!chatPanelOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      {chatPanelOpen && (
        <motion.aside
          ref={panelRef}
          initial={{ x: isMaximized ? 0 : panelWidth }}
          animate={{ x: 0 }}
          exit={{ x: isMaximized ? 0 : panelWidth }}
          transition={animation.spring.snappy}
          style={panelStyles}
        >
          {/* Resize handle */}
          <div
            style={resizeHandleStyles}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleResizeEnter}
            onMouseLeave={handleResizeLeave}
          >
            <div style={resizeLineStyles} />
          </div>

          {/* Content */}
          {activeConversation ? (
            <>
              {/* Header */}
              <ChatPanelHeader
                conversation={activeConversation}
                onClose={handleClose}
                onMaximize={handleMaximize}
              />

              {/* Message Thread */}
              <MessageThread
                conversation={activeConversation}
                streamingMessages={chatMessages}
                isStreaming={isStreaming}
              />

              {/* Message Input */}
              <MessageInput
                conversationId={activeConversation.id}
                input={input}
                setInput={setInput}
                onSubmit={handleSubmit}
                isStreaming={isStreaming}
                onStop={stop}
                hasApiKey={hasAnyApiKey}
                error={chatError}
                supportsVision={supportsVision}
                attachments={pendingAttachments}
                onAttachmentsChange={setPendingAttachments}
                currentModel={currentModel}
                onModelChange={handleModelChange}
              />
            </>
          ) : (
            /* Empty state */
            <div style={emptyStateStyles.container}>
              <PanelRightClose size={48} style={emptyStateStyles.icon} />
              <p style={emptyStateStyles.title}>
                Select a card to start chatting
              </p>
              <p style={emptyStateStyles.subtitle}>
                Click on any conversation card in the canvas
              </p>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// EMPTY STATE STYLES (module-level to avoid re-creation on every render)
// =============================================================================

const emptyStateStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: spacing[6],
    color: colors.fg.quaternary,
    textAlign: 'center',
  } as React.CSSProperties,
  icon: {
    marginBottom: spacing[4],
    opacity: 0.4,
  },
  title: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.body,
    margin: 0,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    marginTop: spacing[2],
    opacity: 0.7,
  },
};

export default ChatPanel;
