'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { PanelRightClose } from 'lucide-react';

import { colors, typography, spacing } from '@/lib/design-tokens';
import { zIndex } from '@/constants/zIndex';
import { useCanvasStore, selectChatPanelOpen, selectActiveConversationId } from '@/stores/canvas-store';
import { usePreferencesStore, selectUIPreferences } from '@/stores/preferences-store';
import { apiKeyManager } from '@/lib/api-key-manager';
import { detectProvider, getDefaultModel, getModelById } from '@/lib/vercel-ai-integration';
import { useUsageStore } from '@/stores/usage-store';
import { getKnowledgeBaseContents } from '@/lib/knowledge-base-db';
import { attachEmbeddings, buildKnowledgeBaseContext, buildRagIndex, type RagIndex } from '@/lib/rag-utils';
import { embedTexts, embedQuery, EMBEDDING_MODEL_NAME } from '@/lib/transformers-embeddings';
import { ChatPanelHeader } from './ChatPanelHeader';
import { MessageThread } from './MessageThread';
import { MessageInput } from './MessageInput';
import { SidePanel } from './SidePanel';
import type { MessageAttachment, MessageMetadata } from '@/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_PANEL_WIDTH = 400;
const MAX_PANEL_WIDTH = 800;
const KB_CONTEXT_MAX_CHARS = 5000;

/** Extract text content from a UIMessage's parts array */
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}

// =============================================================================
// CHAT PANEL COMPONENT
// =============================================================================

export function ChatPanel() {
  const panelRef = useRef<HTMLElement>(null);
  const panelWidthRef = useRef<number>(480); // Track current width for mouseup handler
  
  // Track conversation metadata for the active streaming request to prevent race conditions
  // when user switches cards during streaming. Uses a unique requestId to prevent stale callbacks.
  const streamingRequestMetadataRef = useRef<{
    conversationId: string;
    model: string;
    timestamp: number;
    requestId: string;
  } | null>(null);

  // Stable ID for useChat — must NOT change when the user switches conversation cards.
  // If we passed `activeConversationId` as the id, useChat would abort the in-flight
  // HTTP request and wipe chatMessages every time the user switches cards mid-stream.
  // The streamingRequestMetadataRef already tracks which conversation owns the response.
  // Using useState with no-op setter so it is valid to read during render (unlike a ref).
  const [stableChatId] = useState('chat-panel-stable');
  
  // State from stores — use targeted selector to only re-render when active conversation changes
  const chatPanelOpen = useCanvasStore(selectChatPanelOpen);
  const activeConversationId = useCanvasStore(selectActiveConversationId);
  const activeConversation = useCanvasStore(
    useCallback((s) => s.activeConversationId ? s.conversations.get(s.activeConversationId) ?? null : null, [])
  );
  const closeChatPanel = useCanvasStore((s) => s.closeChatPanel);
  const addAIMessage = useCanvasStore((s) => s.addAIMessage);
  const updateConversation = useCanvasStore((s) => s.updateConversation);
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

  // Edit message state
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);

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

    // All models route through Perplexity Agent API — single key
    const hasPerplexityKey = !!apiKeyManager.getKey('perplexity');

    if (hasPerplexityKey) {
      return getDefaultModel('anthropic').id;
    }

    return null;
  }, [activeConversationId, conversationModel]);

  // Get API key — always the Perplexity key (single gateway)
  const currentApiKey = useMemo(() => {
    if (!currentModel) return null;
    return apiKeyManager.getKey('perplexity');
  }, [currentModel]);

  // Check if we have the Perplexity API key configured
  const hasAnyApiKey = !!apiKeyManager.getKey('perplexity');

  // Check if current model supports vision
  const supportsVision = useMemo(() => {
    if (!currentModel) return false;
    const modelDef = getModelById(currentModel);
    return modelDef?.supportsVision ?? false;
  }, [currentModel]);

  // Attachment state for vision
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  
  // Local input state (managed externally from useChat in AI SDK v6)
  const [input, setInput] = useState('');

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
    const abortController = new AbortController();

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

      try {
        const chunkTexts = baseIndex.chunks.map((chunk) => chunk.content);
        const embeddings = await embedTexts(chunkTexts);
        if (isCancelled) return;
        safeSetRagIndex(attachEmbeddings(baseIndex, embeddings, EMBEDDING_MODEL_NAME));
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        console.warn('[ChatPanel] Semantic embeddings unavailable, using keyword-based search instead');
        console.debug('[ChatPanel] Embedding error:', err);
        safeSetRagIndex(baseIndex);
      }
    }

    loadCanvasContext().catch((err) => {
      console.error('[ChatPanel] Failed to load canvas context', err);
      safeSetRagIndex(null);
    });

    return () => {
      isCancelled = true;
      abortController.abort();
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
    sendMessage,
    status: chatStatus,
    stop,
    error: chatError,
    setMessages,
  } = useChat({
    id: stableChatId,
    onFinish: ({ message }) => {
      console.log('[ChatPanel] onFinish called', { 
        messageId: message.id, 
        hasMetadata: !!message.metadata,
        metadata: message.metadata 
      });
      
      // Get captured metadata from request start time (prevents race condition when switching cards)
      const metadata = streamingRequestMetadataRef.current;
      
      if (!metadata) {
        console.warn('[ChatPanel] onFinish: No request metadata found');
        setPendingAttachments([]);
        return;
      }
      
      // Verify conversation still exists (user might have deleted it during streaming)
      const conversations = useCanvasStore.getState().conversations;
      if (!conversations.get(metadata.conversationId)) {
        console.warn(`[ChatPanel] onFinish: Target conversation ${metadata.conversationId} no longer exists`);
        streamingRequestMetadataRef.current = null;
        setPendingAttachments([]);
        return;
      }

      // Extract text content from UIMessage parts
      const messageText = getMessageText(message);

      // Don't persist an empty assistant message — it would poison future API calls
      // (providers like Perplexity reject conversations containing empty-content turns).
      if (!messageText.trim()) {
        console.warn('[ChatPanel] onFinish: empty assistant message, skipping addAIMessage');
        streamingRequestMetadataRef.current = null;
        setPendingAttachments([]);
        return;
      }

      // Persist AI message to store using CAPTURED conversationId and model
      // Pass message metadata to preserve sources/citations for dropdown display
      addAIMessage(
        metadata.conversationId, 
        messageText, 
        metadata.model,
        message.metadata as MessageMetadata | undefined
      );

      // Track usage from message metadata (sent by server via messageMetadata)
      const msgMetadata = message.metadata as { usage?: { inputTokens: number; outputTokens: number } } | undefined;
      const usage = msgMetadata?.usage;

      if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
        console.log('[ChatPanel] Tracking usage:', {
          model: metadata.model,
          provider: detectProvider(metadata.model),
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          conversationId: metadata.conversationId,
        });
        addUsage({
          provider: detectProvider(metadata.model),
          model: metadata.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          conversationId: metadata.conversationId,
          source: 'chat',
        });
      } else {
        // Fallback: estimate tokens when SDK doesn't provide usage data
        const CHARS_PER_TOKEN = 4;
        const estimatedInputTokens = Math.ceil((messageText.length || 0) / CHARS_PER_TOKEN);
        const estimatedOutputTokens = Math.ceil((messageText.length || 0) / CHARS_PER_TOKEN);
        
        console.warn('[ChatPanel] Usage data missing, using estimation:', {
          model: metadata.model,
          provider: detectProvider(metadata.model),
          conversationId: metadata.conversationId,
          messageLength: messageText.length,
          estimatedInputTokens,
          estimatedOutputTokens,
        });
        
        addUsage({
          provider: detectProvider(metadata.model),
          model: metadata.model,
          inputTokens: estimatedInputTokens,
          outputTokens: estimatedOutputTokens,
          conversationId: metadata.conversationId,
          source: 'chat',
        });
      }
      
      // Clean up metadata ref (primary cleanup location)
      if (streamingRequestMetadataRef.current?.requestId === metadata.requestId) {
        streamingRequestMetadataRef.current = null;
      }
      
      // Clear attachments after send
      setPendingAttachments([]);
    },
    onError: (error: Error) => {
      console.error('[ChatPanel] AI Error:', error);
      // Clear metadata ref on error to prevent stale data
      if (streamingRequestMetadataRef.current) {
        streamingRequestMetadataRef.current = null;
      }
    },
  });

  // Derived streaming state from chat status
  const isStreaming = chatStatus === 'streaming' || chatStatus === 'submitted';

  // Track which conversationId owns the current/most-recent stream as React state
  // (refs cannot be read during render — this mirrors streamingRequestMetadataRef for JSX).
  const [streamingConversationId, setStreamingConversationId] = useState<string | null>(null);

  // Keep streamingConversationId in sync: set when a stream starts, clear when it ends.
  useEffect(() => {
    if (isStreaming && streamingRequestMetadataRef.current?.conversationId) {
      setStreamingConversationId(streamingRequestMetadataRef.current.conversationId);
    } else if (!isStreaming) {
      setStreamingConversationId(null);
    }
  }, [isStreaming]);

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
    
    console.log('[ChatPanel] buildCanvasContextPayload called', { 
      hasInstructions: !!instructions, 
      hasRagIndex: !!ragIndex,
      ragIndexChunks: ragIndex?.chunks.length || 0
    });
    
    // If no knowledge base files, just return instructions
    if (!ragIndex) {
      return instructions ? { instructions } : null;
    }

    // Always include knowledge base file listing so AI knows what's available
    const kbFilesList = ragIndex.chunks
      .map((chunk) => chunk.fileName)
      .filter((name, idx, arr) => arr.indexOf(name) === idx) // unique names
      .join(', ');
    
    let knowledgeBaseContent = '';
    
    // Try to retrieve relevant content via RAG
    const query = getRagQuery(explicitMessage);
    if (query) {
      let queryEmbedding: number[] | undefined;
      if (ragIndex.embeddings?.length) {
        try {
          queryEmbedding = await embedQuery(query);
        } catch (err) {
          console.warn('[ChatPanel] Query embedding unavailable, using keyword matching');
          console.debug('[ChatPanel] Embedding error:', err);
        }
      }

      const ragContext = buildKnowledgeBaseContext(
        ragIndex,
        query,
        { maxChars: KB_CONTEXT_MAX_CHARS },
        queryEmbedding
      );
      
      if (ragContext?.text?.trim()) {
        knowledgeBaseContent = ragContext.text.trim();
      }
    }
    
    // Build knowledge base section with file listing and optional retrieved content
    let knowledgeBase = '';
    if (kbFilesList) {
      knowledgeBase = `Available files: ${kbFilesList}`;
      if (knowledgeBaseContent) {
        knowledgeBase += `\n\n---\n\nRelevant excerpts:\n\n${knowledgeBaseContent}`;
      }
    }

    if (!instructions && !knowledgeBase) return null;

    const payload = {
      instructions: instructions || undefined,
      knowledgeBase: knowledgeBase || undefined,
    };
    
    console.log('[ChatPanel] buildCanvasContextPayload result:', {
      hasInstructions: !!payload.instructions,
      instructionsLength: payload.instructions?.length || 0,
      hasKnowledgeBase: !!payload.knowledgeBase,
      knowledgeBaseLength: payload.knowledgeBase?.length || 0,
      knowledgeBasePreview: payload.knowledgeBase?.substring(0, 100)
    });
    
    return payload;
  }, [activeWorkspace, ragIndex, getRagQuery]);

  // Handle message submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Get user message and clear input immediately for better UX
    const userMessage = input.trim();
    if (!userMessage) return;
    
    // Prevent concurrent requests
    if (isStreaming) {
      console.warn('[ChatPanel] Cannot start new request while streaming is in progress');
      return;
    }
    
    // Clear input immediately so user sees instant feedback
    setInput('');

    // Capture conversation metadata BEFORE starting the request to prevent race conditions
    // when user switches cards during streaming
    if (!activeConversationId || !currentModel) {
      console.warn('[ChatPanel] Cannot start request: missing conversationId or model');
      return;
    }
    
    streamingRequestMetadataRef.current = {
      conversationId: activeConversationId,
      model: currentModel,
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
    };
    setStreamingConversationId(activeConversationId);

    // Build canvas context (pass explicit message since input is now cleared)
    const canvasContextPayload = await buildCanvasContextPayload(userMessage);
    
    console.log('[ChatPanel] Canvas context payload:', canvasContextPayload);

    const body = {
      ...chatBody,
      ...(canvasContextPayload ? { canvasContext: canvasContextPayload } : {}),
    };
    
    console.log('[ChatPanel] Request body:', body);

    // MessageInput calls store.sendMessage (persists to store) BEFORE calling onSubmit,
    // and the await between those two calls lets React re-render and run the sync effect,
    // which loads the new user message into chatMessages. If we then let useChat.sendMessage
    // append the user message again, Perplexity receives two consecutive user turns → 500.
    // Fix: reset chatMessages to the prior context (store messages minus the trailing user
    // message) so useChat.sendMessage appends it exactly once.
    const fullContext = getConversationMessages(activeConversationId);
    const lastMsg = fullContext[fullContext.length - 1];
    const contextBeforeSend =
      lastMsg?.role === 'user' && lastMsg?.content === userMessage
        ? fullContext.slice(0, -1)
        : fullContext;
    setMessages(contextBeforeSend.map((msg, idx) => ({
      id: `msg-${idx}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, text: msg.content }],
    })));

    // Use sendMessage to programmatically add the message (doesn't rely on input field)
    await sendMessage(
      {
        text: userMessage,
      },
      {
        body,
      }
    );
  }, [input, setInput, buildCanvasContextPayload, chatBody, sendMessage, isStreaming, activeConversationId, currentModel, setStreamingConversationId, getConversationMessages, setMessages]);

  // Handle retry: remove all messages after the target user message and re-send it
  const handleRetry = useCallback(async (messageIndex: number) => {
    if (!activeConversation) return;
    
    const messages = activeConversation.content || [];
    const targetMessage = messages[messageIndex];
    
    // Verify it's a user message
    if (!targetMessage || targetMessage.role !== 'user') {
      console.warn('[ChatPanel] Cannot retry non-user message');
      return;
    }
    
    // Stop any ongoing streaming
    if (isStreaming) {
      stop();
    }
    
    // Truncate conversation in store - keep messages up to and including target
    const truncatedMessages = messages.slice(0, messageIndex + 1);
    updateConversation(activeConversation.id, {
      content: truncatedMessages,
    });

    // Sync useChat state with the full context (inherited + prior turns) but WITHOUT
    // the retry target — sendMessage() will append it as the new user turn.
    // Using getConversationMessages gives us the complete inherited context; we strip
    // the last entry (the retry user turn) to avoid two consecutive user messages.
    const fullContextForRetry = getConversationMessages(activeConversation.id);
    const contextBeforeRetry = fullContextForRetry.slice(0, -1); // drop the trailing user message
    setMessages(contextBeforeRetry.map((msg, idx) => ({
      id: `msg-${idx}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, text: msg.content }],
    })));
    
    // Capture conversation metadata for the retry request
    if (!activeConversationId || !currentModel) {
      console.warn('[ChatPanel] Cannot retry: missing conversationId or model');
      return;
    }
    
    streamingRequestMetadataRef.current = {
      conversationId: activeConversationId,
      model: currentModel,
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
    };
    setStreamingConversationId(activeConversationId);
    
    // Build canvas context for retry
    const canvasContextPayload = await buildCanvasContextPayload(targetMessage.content);
    
    // Re-send the user message
    const messageContent = targetMessage.content;
    const messageAttachments = targetMessage.attachments || [];
    
    // Build body with attachments for retry (don't rely on pendingAttachments state timing)
    const body = {
      model: currentModel,
      apiKey: currentApiKey,
      ...(messageAttachments.length > 0 ? {
        attachments: messageAttachments.map(a => ({
          contentType: a.contentType,
          name: a.name,
          url: a.url,
        })),
      } : {}),
      ...(canvasContextPayload ? { canvasContext: canvasContextPayload } : {}),
    };
    
    // Update pendingAttachments state for UI consistency (but body already has them)
    if (messageAttachments.length > 0) {
      setPendingAttachments(messageAttachments);
    }
    
    // Use sendMessage to re-send (this will trigger onFinish and add AI response)
    await sendMessage(
      {
        text: messageContent,
      },
      {
        body,
      }
    );
    
    console.log('[ChatPanel] Retrying message:', { messageIndex, content: messageContent });
  }, [activeConversation, isStreaming, stop, updateConversation, setMessages, activeConversationId, currentModel, currentApiKey, buildCanvasContextPayload, sendMessage, setPendingAttachments, setStreamingConversationId, getConversationMessages]);

  // Handle edit message click
  const handleEditClick = useCallback((messageIndex: number) => {
    if (!activeConversation || isStreaming) return;
    const message = activeConversation.content[messageIndex];
    if (!message || message.role !== 'user') return;
    setEditingMessageIndex(messageIndex);
  }, [activeConversation, isStreaming]);

  // Handle edit save — truncates history after the edited message and re-sends
  const handleEditSave = useCallback(async (content: string, attachments: MessageAttachment[]) => {
    if (!activeConversation || editingMessageIndex === null || !activeConversationId || !currentModel) return;

    // Stop any ongoing streaming
    if (isStreaming) {
      stop();
    }

    // Build the updated message
    const originalMessage = activeConversation.content[editingMessageIndex];
    const updatedMessage = {
      ...originalMessage,
      content: content.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(),
      metadata: {
        ...originalMessage?.metadata,
        edited: true,
        editedAt: new Date(),
        originalContent: originalMessage?.metadata?.edited
          ? originalMessage.metadata.originalContent
          : originalMessage?.content,
      },
    };

    // Truncate conversation to only messages up to (and including) the edited message
    const truncatedMessages = [
      ...activeConversation.content.slice(0, editingMessageIndex),
      updatedMessage,
    ];
    updateConversation(activeConversation.id, { content: truncatedMessages });

    // Sync useChat state with the full context (inherited + prior turns) but WITHOUT
    // the edited message itself — sendMessage() will append it as the new user turn.
    // Using getConversationMessages gives us the complete inherited context; we strip
    // the last entry (the edited user turn) to avoid two consecutive user messages.
    const fullContextForEdit = getConversationMessages(activeConversation.id);
    const contextBeforeEdit = fullContextForEdit.slice(0, -1); // drop the trailing user message
    setMessages(contextBeforeEdit.map((msg, idx) => ({
      id: `msg-${idx}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, text: msg.content }],
    })));

    // Clear edit state
    setEditingMessageIndex(null);

    // Set up streaming metadata
    streamingRequestMetadataRef.current = {
      conversationId: activeConversationId,
      model: currentModel,
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
    };
    setStreamingConversationId(activeConversationId);

    // Build canvas context and re-send
    const canvasContextPayload = await buildCanvasContextPayload(content.trim());
    const body = {
      model: currentModel,
      apiKey: currentApiKey,
      ...(attachments.length > 0 ? {
        attachments: attachments.map(a => ({
          contentType: a.contentType,
          name: a.name,
          url: a.url,
        })),
      } : {}),
      ...(canvasContextPayload ? { canvasContext: canvasContextPayload } : {}),
    };

    if (attachments.length > 0) {
      setPendingAttachments(attachments);
    }

    await sendMessage({ text: content.trim() }, { body });
  }, [activeConversation, editingMessageIndex, activeConversationId, currentModel, isStreaming, stop, updateConversation, setMessages, buildCanvasContextPayload, currentApiKey, setPendingAttachments, sendMessage, setStreamingConversationId, getConversationMessages]);

  // Handle edit cancel
  const handleEditCancel = useCallback(() => {
    setEditingMessageIndex(null);
  }, []);

  // Sync store messages to useChat when conversation changes.
  // Guard: skip the sync only when the viewed card IS the one currently streaming —
  // in that case chatMessages already has the live in-flight content and we must not
  // overwrite it. For every other card (including switching away) we always sync so
  // the panel shows the correct stored conversation.
  useEffect(() => {
    const viewingStreamingCard = isStreaming && activeConversationId === streamingConversationId;

    if (viewingStreamingCard) return;

    if (activeConversationId) {
      const storeMessages = getConversationMessages(activeConversationId);
      // Convert to useChat UIMessage format (v6 uses parts instead of content)
      const formattedMessages = storeMessages.map((msg, idx) => ({
        id: `msg-${idx}`,
        role: msg.role as 'user' | 'assistant' | 'system',
        parts: [{ type: 'text' as const, text: msg.content }],
      }));
      setMessages(formattedMessages);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, isStreaming, streamingConversationId, getConversationMessages, setMessages]);

  // Save partial message when streaming stops (e.g., user clicks stop button)
  const prevIsStreamingRef = useRef(isStreaming);
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;

    // If streaming just stopped and we have messages
    if (wasStreaming && !isStreaming && chatMessages.length > 0) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      
      // Check if it's an assistant message with content
      const lastMessageText = lastMessage ? getMessageText(lastMessage) : '';
      if (lastMessage?.role === 'assistant' && lastMessageText.trim()) {
        // Get captured metadata from request start time (prevents race condition)
        const metadata = streamingRequestMetadataRef.current;
        
        if (!metadata) {
          console.warn('[ChatPanel] Partial save: No request metadata found');
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPendingAttachments([]);
          return;
        }
        
        const storeMessages = getConversationMessages(metadata.conversationId);
        const lastStoreMessage = storeMessages[storeMessages.length - 1];
        
        // Only save if this message isn't already in the store (avoid duplicate saves)
        // Compare content to detect if it's a new/partial message
        if (!lastStoreMessage || lastStoreMessage.content !== lastMessageText) {
          // Verify conversation still exists
          const conversations = useCanvasStore.getState().conversations;
          if (!conversations.get(metadata.conversationId)) {
            console.warn(`[ChatPanel] Partial save: Target conversation ${metadata.conversationId} no longer exists`);
            streamingRequestMetadataRef.current = null;
            setPendingAttachments([]);
            return;
          }
          
          // For partial saves (user clicked stop), extract web search metadata
          // from tool invocations in message parts if available
          const partialSearchSources: Array<{ title: string; url: string }> = [];
          for (const part of lastMessage.parts ?? []) {
            // In v6, tool parts have type 'tool-<toolName>' with data directly on the part
            if (!part.type.startsWith('tool-')) continue;
            const toolName = part.type.substring(5); // Remove 'tool-' prefix
            if (toolName !== 'tavily_search') continue;
            const partAny = part as { state?: string; output?: { sources?: Array<{ title: string; url: string }> } };
            if (partAny.state !== 'output') continue;
            const sources = partAny.output?.sources;
            if (Array.isArray(sources)) {
              partialSearchSources.push(...sources.map((s) => ({ title: s.title, url: s.url })));
            }
          }

          const partialWebSearchMetadata = partialSearchSources.length > 0 ? {
            custom: {
              webSearch: {
                used: true,
                sources: partialSearchSources,
              },
            },
          } : undefined;
          
          // Save partial message using CAPTURED values
          addAIMessage(metadata.conversationId, lastMessageText, metadata.model, partialWebSearchMetadata);
          
          // Don't clear metadata here - let onFinish/onError handle cleanup
          // This prevents race condition where metadata is cleared before onFinish gets it
          
          setPendingAttachments([]);
        }
      }
    }
  }, [isStreaming, chatMessages, addAIMessage, getConversationMessages]);

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
    zIndex: isMaximized ? zIndex.ui.sidePanelMaximized : zIndex.ui.sidePanel,
    flexShrink: 1,
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

          {/* Message Thread
              Only pass live streamingMessages + isStreaming when the currently
              viewed card is the one that owns the active stream. If the user
              has switched to a different card, show that card's stored
              messages without any streaming overlay so the background stream
              doesn't bleed through to an unrelated conversation view. */}
          <MessageThread
            conversation={activeConversation}
            streamingMessages={
              activeConversationId === streamingConversationId ? chatMessages : []
            }
            isStreaming={isStreaming && activeConversationId === streamingConversationId}
            onHeightChange={setMessageListHeight}
            isMaximized={isMaximized}
            onRetry={handleRetry}
            onEditClick={handleEditClick}
            editingMessageIndex={editingMessageIndex}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
          />

          {/* Message Input */}
          <MessageInput
            conversationId={activeConversation.id}
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isStreaming={isStreaming && activeConversationId === streamingConversationId}
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
    color: colors.fg.tertiary,
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
