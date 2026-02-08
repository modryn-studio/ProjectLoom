'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChat } from 'ai/react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelRightClose } from 'lucide-react';

import { colors, typography, spacing, animation } from '@/lib/design-tokens';
import { useCanvasStore, selectChatPanelOpen, selectActiveConversationId } from '@/stores/canvas-store';
import { usePreferencesStore, selectUIPreferences } from '@/stores/preferences-store';
import { apiKeyManager } from '@/lib/api-key-manager';
import { getDefaultModel, getModelById } from '@/lib/vercel-ai-integration';
import { getKnowledgeBaseContents } from '@/lib/knowledge-base-db';
import { attachEmbeddings, buildKnowledgeBaseContext, buildRagIndex, type RagIndex } from '@/lib/rag-utils';
import { ChatPanelHeader } from './ChatPanelHeader';
import { MessageThread } from './MessageThread';
import { MessageInput } from './MessageInput';
import type { MessageAttachment } from '@/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_PANEL_WIDTH = 400;
const MAX_PANEL_WIDTH = 800;
const KB_CONTEXT_MAX_CHARS = 5000;
const EMBEDDING_MODEL = 'text-embedding-3-small';

// =============================================================================
// CHAT PANEL COMPONENT
// =============================================================================

export function ChatPanel() {
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
  const workspaces = useCanvasStore((s) => s.workspaces);
  const activeWorkspaceId = useCanvasStore((s) => s.activeWorkspaceId);
  
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

  const [ragIndex, setRagIndex] = useState<RagIndex | null>(null);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) || null,
    [workspaces, activeWorkspaceId]
  );

  const knowledgeBaseKey = useMemo(() => {
    const files = activeWorkspace?.context?.knowledgeBaseFiles || [];
    return files.map((file) => `${file.id}:${file.lastModified}`).join('|');
  }, [activeWorkspace]);

  const contextLoadKey = useMemo(() => {
    if (!chatPanelOpen) return 'closed';
    return `${activeWorkspaceId || 'none'}:${knowledgeBaseKey}`;
  }, [activeWorkspaceId, knowledgeBaseKey, chatPanelOpen]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (contextLoadKey === 'closed') {
      setRagIndex(null);
      return;
    }

    let isCancelled = false;

    async function loadCanvasContext() {
      if (!activeWorkspaceId) {
        setRagIndex(null);
        return;
      }

      const kbFiles = await getKnowledgeBaseContents(activeWorkspaceId);

      if (isCancelled) return;

      if (kbFiles.length === 0) {
        setRagIndex(null);
        return;
      }

      const baseIndex = buildRagIndex(kbFiles);
      const openaiKey = apiKeyManager.getKey('openai');
      if (!openaiKey) {
        setRagIndex(baseIndex);
        return;
      }

      try {
        const response = await fetch('/api/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: openaiKey,
            texts: baseIndex.chunks.map((chunk) => chunk.content),
            model: EMBEDDING_MODEL,
          }),
        });

        if (!response.ok) {
          setRagIndex(baseIndex);
          return;
        }

        const data = await response.json() as { embeddings: number[][]; model: string };
        setRagIndex(attachEmbeddings(baseIndex, data.embeddings, data.model));
      } catch (err) {
        console.error('[ChatPanel] Failed to build embedding index', err);
        setRagIndex(baseIndex);
      }
    }

    loadCanvasContext().catch((err) => {
      console.error('[ChatPanel] Failed to load canvas context', err);
      if (!isCancelled) setRagIndex(null);
    });

    return () => {
      isCancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [contextLoadKey, activeWorkspaceId]);

  // useChat hook for streaming AI responses
  const chatBody = useMemo(() => ({
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
  }), [currentModel, currentApiKey, pendingAttachments]);

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
    body: chatBody,
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

  const getRagQuery = useCallback(() => {
    if (input.trim()) return input.trim();
    const lastUserMessage = activeConversation?.content
      ?.slice()
      .reverse()
      .find((msg) => msg.role === 'user');
    return lastUserMessage?.content?.trim() || '';
  }, [input, activeConversation]);

  const buildCanvasContextPayload = useCallback(async () => {
    const instructions = activeWorkspace?.context?.instructions?.trim() || '';
    if (!ragIndex) {
      return instructions ? { instructions } : null;
    }

    const query = getRagQuery();
    if (!query) {
      return instructions ? { instructions } : null;
    }

    let queryEmbedding: number[] | undefined;
    if (ragIndex.embeddings?.length) {
      const openaiKey = apiKeyManager.getKey('openai');
      if (openaiKey) {
        try {
          const response = await fetch('/api/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: openaiKey,
              texts: [query],
              model: ragIndex.embeddingModel || EMBEDDING_MODEL,
            }),
          });

          if (response.ok) {
            const data = await response.json() as { embeddings: number[][] };
            queryEmbedding = data.embeddings?.[0];
          }
        } catch (err) {
          console.error('[ChatPanel] Failed to embed query', err);
        }
      }
    }

    const ragContext = buildKnowledgeBaseContext(
      ragIndex,
      query,
      { maxChars: KB_CONTEXT_MAX_CHARS },
      queryEmbedding
    );
    const knowledgeBase = ragContext?.text?.trim() || '';

    if (!instructions && !knowledgeBase) return null;

    return {
      instructions: instructions || undefined,
      knowledgeBase: knowledgeBase || undefined,
    };
  }, [activeWorkspace, ragIndex, getRagQuery]);

  // Wrap handleSubmit to also store attachments on user message
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    const canvasContextPayload = await buildCanvasContextPayload();
    const body = {
      ...chatBody,
      ...(canvasContextPayload ? { canvasContext: canvasContextPayload } : {}),
    };

    rawHandleSubmit(e, { body });
  }, [chatBody, rawHandleSubmit, buildCanvasContextPayload]);

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
    /* eslint-disable react-hooks/set-state-in-effect */
    if (uiPrefs.chatPanelWidth && !isResizing) {
      setPanelWidth(uiPrefs.chatPanelWidth);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
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
    position: isMaximized ? 'fixed' : 'relative',
    top: isMaximized ? 0 : 'auto',
    left: isMaximized ? 0 : 'auto',
    right: isMaximized ? 0 : 'auto',
    width: isMaximized ? '100vw' : panelWidth,
    minWidth: isMaximized ? '100vw' : MIN_PANEL_WIDTH,
    maxWidth: isMaximized ? '100vw' : MAX_PANEL_WIDTH,
    backgroundColor: colors.bg.secondary,
    borderLeft: isMaximized ? 'none' : `1px solid ${colors.border.default}`,
    display: 'flex',
    flexDirection: 'column',
    height: isMaximized ? '100vh' : '100%',
    maxHeight: isMaximized ? '100vh' : '100%',
    overflow: 'hidden',
    userSelect: isResizing ? 'none' : 'auto',
    zIndex: isMaximized ? 200 : 1,
    flexShrink: 0,
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
