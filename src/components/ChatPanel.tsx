'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChat } from 'ai/react';
import { PanelRightClose } from 'lucide-react';

import { colors, typography, spacing } from '@/lib/design-tokens';
import { useCanvasStore, selectChatPanelOpen, selectActiveConversationId } from '@/stores/canvas-store';
import { usePreferencesStore, selectUIPreferences } from '@/stores/preferences-store';
import { apiKeyManager } from '@/lib/api-key-manager';
import { detectProvider, getDefaultModel, getModelById } from '@/lib/vercel-ai-integration';
import { useUsageStore } from '@/stores/usage-store';
import { getKnowledgeBaseContents } from '@/lib/knowledge-base-db';
import { attachEmbeddings, buildKnowledgeBaseContext, buildRagIndex, type RagIndex } from '@/lib/rag-utils';
import { ChatPanelHeader } from './ChatPanelHeader';
import { MessageThread } from './MessageThread';
import { MessageInput } from './MessageInput';
import { SidePanel } from './SidePanel';
import type { MessageAttachment } from '@/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_PANEL_WIDTH = 400;
const MAX_PANEL_WIDTH = 800;
const KB_CONTEXT_MAX_CHARS = 5000;
const EMBEDDING_MODEL = 'text-embedding-3-small';

interface WebSearchSource {
  title: string;
  url: string;
}

interface WebSearchResult {
  summary: string;
  sources: WebSearchSource[];
}

// =============================================================================
// SEARCH INTENT DETECTION
// =============================================================================

/**
 * Detect if user message requires web search
 * Uses more precise pattern matching to avoid false positives
 */
function detectSearchIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Explicit search command keywords (stronger signals)
  const strongKeywords = [
    'search for', 'look up', 'find out', 'research',
    'latest news', 'recent news', 'today\'s news',
    'what is the latest', 'what are the latest',
    'current news', 'news about', 'update on',
  ];
  
  if (strongKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return true;
  }
  
  // Question patterns that often need current info
  const questionPatterns = [
    /^what is (?:the )?(?:latest|current|recent)/,
    /^what are (?:the )?(?:latest|current|recent)/,
    /^who is (?:the )?(?:current|latest)/,
    /^when did .+ happen/,
    /^when was .+ released/,
  ];
  
  if (questionPatterns.some(pattern => pattern.test(lowerMessage))) {
    return true;
  }
  
  return false;
}

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
  const addUsage = useUsageStore((s) => s.addUsage);
  const getConversationMessages = useCanvasStore((s) => s.getConversationMessages);
  const conversationModel = useCanvasStore(
    useCallback((s) => {
      if (!s.activeConversationId) return null;
      const conversation = s.conversations.get(s.activeConversationId);
      return conversation?.model ?? null;
    }, [])
  );
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
  const [messageListHeight, setMessageListHeight] = useState(0);

  // Web search state
  const [webSearchState, setWebSearchState] = useState<{
    isSearching: boolean;
    result: WebSearchResult | null;
  }>({
    isSearching: false,
    result: null,
  });

  // Ref to avoid stale closure in onFinish callback
  const webSearchResultRef = useRef<WebSearchResult | null>(null);
  useEffect(() => {
    webSearchResultRef.current = webSearchState.result;
  }, [webSearchState.result]);
  
  const effectivePanelWidth = !isResizing && uiPrefs.chatPanelWidth
    ? uiPrefs.chatPanelWidth
    : panelWidth;

  // Keep ref in sync with state
  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);


  // Determine current model for conversation
  const currentModel = useMemo(() => {
    if (!activeConversationId) return null;

    if (conversationModel) return conversationModel;

    // Otherwise, determine default based on available API keys
    const hasAnthropicKey = !!apiKeyManager.getKey('anthropic');
    const hasOpenAIKey = !!apiKeyManager.getKey('openai');

    if (hasAnthropicKey) {
      return getDefaultModel('anthropic').id;
    }
    if (hasOpenAIKey) {
      return getDefaultModel('openai').id;
    }

    return null;
  }, [activeConversationId, conversationModel]);

  // Get API key for current model
  const currentApiKey = useMemo(() => {
    if (!currentModel) return null;
    
    if (currentModel.startsWith('claude') || currentModel.startsWith('anthropic')) {
      return apiKeyManager.getKey('anthropic');
    }
    return apiKeyManager.getKey('openai');
  }, [currentModel]);

  const tavilyKey = apiKeyManager.getKey('tavily');

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

    const safeSetRagIndex = (nextIndex: RagIndex | null) => {
      if (!isCancelled) {
        setRagIndex(nextIndex);
      }
    };

    async function loadCanvasContext() {
      if (!activeWorkspaceId) {
        safeSetRagIndex(null);
        return;
      }

      const kbFiles = await getKnowledgeBaseContents(activeWorkspaceId);

      if (isCancelled) return;

      if (kbFiles.length === 0) {
        safeSetRagIndex(null);
        return;
      }

      const baseIndex = buildRagIndex(kbFiles);
      const openaiKey = apiKeyManager.getKey('openai');
      if (!openaiKey) {
        safeSetRagIndex(baseIndex);
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
          safeSetRagIndex(baseIndex);
          return;
        }

        const data = await response.json() as { embeddings: number[][]; model: string; usage?: { totalTokens: number } };
        safeSetRagIndex(attachEmbeddings(baseIndex, data.embeddings, data.model));

        if (!isCancelled && data.usage?.totalTokens) {
          addUsage({
            provider: 'openai',
            model: data.model,
            inputTokens: data.usage.totalTokens,
            outputTokens: 0,
            source: 'embeddings',
          });
        }
      } catch (err) {
        console.error('[ChatPanel] Failed to build embedding index', err);
        safeSetRagIndex(baseIndex);
      }
    }

    loadCanvasContext().catch((err) => {
      console.error('[ChatPanel] Failed to load canvas context', err);
      safeSetRagIndex(null);
    });

    return () => {
      isCancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [contextLoadKey, activeWorkspaceId, addUsage]);

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
    append,
    isLoading: isStreaming,
    stop,
    error: chatError,
    setMessages,
    setData,
  } = useChat({
    api: '/api/chat',
    id: activeConversationId || undefined,
    body: chatBody,
    onResponse: () => {
      // Clear searching indicator when AI starts responding
      setWebSearchState(prev => ({ ...prev, isSearching: false }));
    },
    onFinish: (message, options) => {
      // Read from ref to avoid stale closure (webSearchState would be stale here)
      const searchResult = webSearchResultRef.current;
      const webSearchMetadata = searchResult ? {
        custom: {
          webSearch: {
            used: true,
            sources: searchResult.sources,
          },
        },
      } : undefined;

      // Persist AI message to store when streaming finishes
      if (activeConversationId && currentModel) {
        addAIMessage(activeConversationId, message.content, currentModel, webSearchMetadata);
      }

      if (activeConversationId && currentModel && options?.usage) {
        addUsage({
          provider: detectProvider(currentModel),
          model: currentModel,
          inputTokens: options.usage.promptTokens,
          outputTokens: options.usage.completionTokens,
          conversationId: activeConversationId,
          source: 'chat',
        });
      }
      // Clear attachments and search state after send
      setPendingAttachments([]);
      webSearchResultRef.current = null;
      setWebSearchState({ isSearching: false, result: null });
    },
    onError: (error: Error) => {
      console.error('[ChatPanel] AI Error:', error);
    },
  });

  const getRagQuery = useCallback((explicitMessage?: string) => {
    if (explicitMessage) return explicitMessage;
    if (input.trim()) return input.trim();
    const lastUserMessage = activeConversation?.content
      ?.slice()
      .reverse()
      .find((msg) => msg.role === 'user');
    return lastUserMessage?.content?.trim() || '';
  }, [input, activeConversation]);

  const buildCanvasContextPayload = useCallback(async (explicitMessage?: string) => {
    const instructions = activeWorkspace?.context?.instructions?.trim() || '';
    if (!ragIndex) {
      return instructions ? { instructions } : null;
    }

    const query = getRagQuery(explicitMessage);
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
            const data = await response.json() as { embeddings: number[][]; model?: string; usage?: { totalTokens: number } };
            queryEmbedding = data.embeddings?.[0];

            if (data.usage?.totalTokens) {
              addUsage({
                provider: 'openai',
                model: data.model || ragIndex.embeddingModel || EMBEDDING_MODEL,
                inputTokens: data.usage.totalTokens,
                outputTokens: 0,
                source: 'embeddings',
              });
            }
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
  }, [activeWorkspace, ragIndex, getRagQuery, addUsage]);

  // Execute web search before chat
  const executeWebSearch = useCallback(async (query: string): Promise<WebSearchResult | null> => {
    // Double-check Tavily key is valid before making API call
    if (!tavilyKey || !tavilyKey.trim()) {
      console.log('[Web Search] No valid Tavily API key configured');
      return null;
    }

    console.log('[Web Search] Executing search with query:', query);
    console.log('[Web Search] Tavily key present:', !!tavilyKey, 'Length:', tavilyKey.length);

    setWebSearchState({ isSearching: true, result: null });

    try {
      const response = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          maxResults: 5,
          tavilyKey,
        }),
      });

      if (!response.ok) {
        // Parse error details if available
        let errorMessage = `Status ${response.status}`;
        let errorCode = 'UNKNOWN';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          errorCode = errorData.code || errorCode;
          console.error('[Web Search] API error details:', {
            status: response.status,
            code: errorCode,
            message: errorMessage,
            fullError: errorData,
          });
          if (errorData.code === 'MISSING_API_KEY') {
            console.log('[Web Search] Tavily API key not configured. Add one in Settings to enable web search.');
          }
        } catch {
          // Response not JSON, use status code
          console.error('[Web Search] Non-JSON error response:', response.status);
        }
        console.warn('[Web Search] Search failed:', errorMessage);
        setWebSearchState({ isSearching: false, result: null });
        return null;
      }

      const result = await response.json() as WebSearchResult;
      // Keep isSearching: true, will be cleared when AI starts responding
      setWebSearchState({ isSearching: true, result });
      return result;
    } catch (error) {
      console.error('[Web Search] Failed:', error);
      setWebSearchState({ isSearching: false, result: null });
      return null;
    }
  }, [tavilyKey]);

  // Wrap handleSubmit to check for search intent and execute search first
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Get user message and clear input immediately for better UX
    const userMessage = input.trim();
    if (!userMessage) return;
    
    // Clear input immediately so user sees instant feedback
    setInput('');

    // Check if we should search first (only if Tavily key is configured)
    const needsSearch = detectSearchIntent(userMessage);

    let searchResult: WebSearchResult | null = null;
    if (needsSearch && tavilyKey) {
      searchResult = await executeWebSearch(userMessage);
    } else if (needsSearch && !tavilyKey) {
      // User's message looks like it needs search, but no Tavily key configured
      console.log('[Web Search] Search intent detected but Tavily API key not configured. Proceeding without search.');
    }

    // Build canvas context (pass explicit message since input is now cleared)
    const canvasContextPayload = await buildCanvasContextPayload(userMessage);

    // If we have search results, inject them into the system prompt
    let enhancedContext = canvasContextPayload;
    if (searchResult) {
      const searchContext = `

The following information was retrieved to help answer the question:

${searchResult.summary}

Sources:
${searchResult.sources.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}`;
      
      enhancedContext = {
        ...canvasContextPayload,
        instructions: (canvasContextPayload?.instructions || '') + searchContext,
      };
    }

    const body = {
      ...chatBody,
      ...(enhancedContext ? { canvasContext: enhancedContext } : {}),
    };

    setData([]);
    
    // Use append to programmatically add the message (doesn't rely on input field)
    await append(
      {
        role: 'user',
        content: userMessage,
      },
      {
        body,
      }
    );
  }, [input, setInput, tavilyKey, executeWebSearch, buildCanvasContextPayload, chatBody, setData, append]);

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

  // Save partial message when streaming stops (e.g., user clicks stop button)
  const prevIsStreamingRef = useRef(isStreaming);
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;

    // If streaming just stopped and we have messages
    if (wasStreaming && !isStreaming && chatMessages.length > 0) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      
      // Check if it's an assistant message with content
      if (lastMessage?.role === 'assistant' && lastMessage.content.trim()) {
        const storeMessages = activeConversationId ? getConversationMessages(activeConversationId) : [];
        const lastStoreMessage = storeMessages[storeMessages.length - 1];
        
        // Only save if this message isn't already in the store (avoid duplicate saves)
        // Compare content to detect if it's a new/partial message
        if (!lastStoreMessage || lastStoreMessage.content !== lastMessage.content) {
          if (activeConversationId && currentModel) {
            const webSearchMetadata = webSearchState.result ? {
              custom: {
                webSearch: {
                  used: true,
                  sources: webSearchState.result.sources,
                },
              },
            } : undefined;
            addAIMessage(activeConversationId, lastMessage.content, currentModel, webSearchMetadata);
          }
          // Clear attachments after partial save (intentional effect-based cleanup)
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPendingAttachments([]);
        }
      }
    }
  }, [isStreaming, chatMessages, activeConversationId, currentModel, addAIMessage, getConversationMessages, webSearchState]);

  // Resize handlers (IDENTICAL to CanvasTreeSidebar)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const resizeListenersRef = useRef(false);
  useEffect(() => {
    if (!isResizing || resizeListenersRef.current) return;
    resizeListenersRef.current = true;

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
      resizeListenersRef.current = false;
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
    width: isMaximized ? '100vw' : effectivePanelWidth,
    minWidth: isMaximized ? '100vw' : (chatPanelOpen ? MIN_PANEL_WIDTH : 0),
    maxWidth: isMaximized ? '100vw' : (chatPanelOpen ? MAX_PANEL_WIDTH : 0),
    backgroundColor: colors.bg.secondary,
    borderLeft: isMaximized || !chatPanelOpen ? 'none' : `1px solid ${colors.border.default}`,
    display: 'flex',
    flexDirection: 'column',
    height: isMaximized ? '100vh' : '100%',
    maxHeight: isMaximized ? '100vh' : '100%',
    overflow: 'hidden',
    userSelect: isResizing ? 'none' : 'auto',
    zIndex: isMaximized ? 200 : 1,
    flexShrink: 0,
    pointerEvents: chatPanelOpen ? 'auto' : 'none',
  }), [effectivePanelWidth, isResizing, isMaximized, chatPanelOpen]);

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

  return (
    <SidePanel
      ref={panelRef}
      isOpen={chatPanelOpen}
      width={isMaximized ? '100vw' : effectivePanelWidth}
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
            onHeightChange={setMessageListHeight}
            webSearchState={{ isSearching: webSearchState.isSearching }}
            isMaximized={isMaximized}
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
            maxTextareaHeight={messageListHeight > 0 ? Math.floor(messageListHeight * 0.5) : undefined}
            isMaximized={isMaximized}
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
    </SidePanel>
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
