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
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useDemoRecordStore } from '@/stores/demo-record-store';
import { useTrialStore, selectIsTrialActive, selectIsTrialExhausted } from '@/stores/trial-store';
import { analytics } from '@/lib/analytics';
import { canUserCloseChatPanel } from '@/lib/onboarding-guards';
import { getKnowledgeBaseContents } from '@/lib/knowledge-base-db';
import { buildKnowledgeBaseContext, buildRagIndex } from '@/lib/rag-utils';
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
// Knowledge base context limits
// Full-context injection threshold: ~100K tokens (conservative, leaves room for conversation history)
const KB_FULL_CONTEXT_MAX_CHARS = 400_000;
// Fallback TF-IDF retrieval cap used only when KB exceeds the full-context threshold
const KB_RAG_FALLBACK_MAX_CHARS = 5_000;

/** Extract text content from a UIMessage's parts array */
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}

/**
 * For a stored Message, inline any text file attachments back into the content
 * so the model has access to file contents throughout the conversation history,
 * not just in the turn the file was originally attached.
 */
function inlineTextAttachments(msg: { content: string; attachments?: MessageAttachment[] }): string {
  const content = msg.content ?? '';
  if (!msg.attachments?.length) return content;
  const parts: string[] = [];
  for (const att of msg.attachments) {
    const contentType = att.contentType ?? '';
    const url = att.url ?? '';
    // Accept text/* content types, OR any non-image data URL (handles Windows .md files
    // that the browser reports with empty MIME type before normalizeContentType was applied)
    const isTextType = contentType.startsWith('text/');
    const isNonImageDataUrl = !contentType.startsWith('image/') && url.startsWith('data:');
    if ((isTextType || isNonImageDataUrl) && url.startsWith('data:')) {
      try {
        const base64Data = url.split(',')[1];
        if (base64Data) {
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          const text = new TextDecoder('utf-8').decode(bytes);
          parts.push(`[Attached file: ${att.name}]\n\n${text}`);
        }
      } catch {
        // Silently skip undecodable attachments
      }
    }
  }
  if (parts.length === 0) return content;
  return parts.join('\n\n---\n\n') + '\n\n---\n\n' + content;
}

// =============================================================================
// CHAT PANEL COMPONENT
// =============================================================================

interface ChatPanelProps {
  /** When true, renders as full-width panel without SidePanel wrapper or resize handles */
  isMobile?: boolean;
}

export function ChatPanel({ isMobile = false }: ChatPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const panelWidthRef = useRef<number>(480); // Track current width for mouseup handler
  
  // Track conversation metadata for the active streaming request to prevent race conditions
  // when user switches cards during streaming. Uses a unique requestId to prevent stale callbacks.
  const streamingRequestMetadataRef = useRef<{
    conversationId: string;
    model: string;
    timestamp: number;
    requestId: string;
    onboardingStep?: string;
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

  // Trial state — must be before currentModel useMemo which depends on isTrialActive
  const onboardingActive = useOnboardingStore((s) => s.active);
  const demoRecordActive = useDemoRecordStore((s) => s.active);
  const isTrialActive = useTrialStore(selectIsTrialActive);
  const isTrialExhausted = useTrialStore(selectIsTrialExhausted);
  const syncTrialFromServer = useTrialStore((s) => s.syncFromServer);
  const hasAnyApiKey = apiKeyManager.hasAnyKey() || onboardingActive || demoRecordActive || (isTrialActive && !isTrialExhausted);

  // Determine current model for conversation
  const currentModel = useMemo(() => {
    if (!activeConversationId) return null;

    if (conversationModel) return conversationModel;

    // Check which providers have keys
    const hasAnthropicKey = !!apiKeyManager.getKey('anthropic');
    const hasOpenaiKey = !!apiKeyManager.getKey('openai');

    if (hasAnthropicKey) {
      return getDefaultModel('anthropic').id;
    }
    if (hasOpenaiKey) {
      return getDefaultModel('openai').id;
    }

    // During onboarding or demo recording, use a placeholder model ID so the request can proceed
    if (useOnboardingStore.getState().active || useDemoRecordStore.getState().active) {
      return 'anthropic/claude-sonnet-4-6';
    }

    // Trial mode — default to GPT-5 Mini (server enforces this regardless)
    if (isTrialActive) {
      return 'openai/gpt-5-mini';
    }

    return null;
  }, [activeConversationId, conversationModel, isTrialActive]);

  // Get API keys for all providers (reads from module-level singleton — no reactive deps needed)
  const currentKeys = useMemo(() => {
    return {
      anthropic: apiKeyManager.getKey('anthropic') ?? undefined,
      openai: apiKeyManager.getKey('openai') ?? undefined,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, conversationModel]);

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

  // Full KB content string, loaded on workspace open/change.
  // null = not loaded yet or no KB files. Empty string not used.
  const [kbContent, setKbContent] = useState<string | null>(null);

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
    if (contextLoadKey === 'closed') {
      setKbContent(null);
      return;
    }

    let isCancelled = false;

    async function loadKnowledgeBaseContent() {
      if (!activeWorkspaceId) {
        if (!isCancelled) setKbContent(null);
        return;
      }

      const kbFiles = await getKnowledgeBaseContents(activeWorkspaceId);
      if (isCancelled) return;

      if (kbFiles.length === 0) {
        setKbContent(null);
        return;
      }

      // Format all files as full content — no chunking, no embeddings.
      // Anthropic recommends full-context injection for KBs < 200K tokens;
      // typical workspace KBs are 2K–20K tokens (well within Claude 200K / GPT-4o 128K).
      const formatted = kbFiles
        .map((f) => `## ${f.name}\n\n${f.content}`)
        .join('\n\n---\n\n');

      if (!isCancelled) setKbContent(formatted);
    }

    loadKnowledgeBaseContent().catch((err) => {
      console.error('[ChatPanel] Failed to load knowledge base content', err);
      if (!isCancelled) setKbContent(null);
    });

    return () => {
      isCancelled = true;
    };
  }, [contextLoadKey, activeWorkspaceId]);

  // useChat hook for streaming AI responses
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
      
      // Get captured metadata from request start time (prevents race condition when switching cards)
      const metadata = streamingRequestMetadataRef.current;
      
      if (!metadata) {
        console.warn('[ChatPanel] onFinish: No request metadata found');
        setPendingAttachments([]);
        return;
      }
      
      // Verify conversation still exists — search both the active workspace and all
      // background workspaces. The user may have navigated away while this stream ran,
      // swapping the active `conversations` Map to a different workspace. Checking only
      // that Map produces a false-negative and silently drops the finished message.
      const onFinishState = useCanvasStore.getState();
      const conversationStillExists =
        onFinishState.conversations.has(metadata.conversationId) ||
        onFinishState.workspaces.some(ws =>
          ws.conversations.some(c => c.id === metadata.conversationId)
        );
      if (!conversationStillExists) {
        console.warn(`[ChatPanel] onFinish: Target conversation ${metadata.conversationId} no longer exists`);
        streamingRequestMetadataRef.current = null;
        setPendingAttachments([]);
        return;
      }

      // Extract text content from UIMessage parts
      const messageText = getMessageText(message);

      // Don't persist an empty assistant message — it would poison future API calls
      // (providers reject conversations containing empty-content turns).
      if (!messageText.trim()) {
        console.warn('[ChatPanel] onFinish: empty assistant message, skipping addAIMessage');
        streamingRequestMetadataRef.current = null;
        setPendingAttachments([]);
        return;
      }

      // Extract web search sources from message parts.
      // AI SDK v6: tool parts have type 'tool-${toolName}' with state/input/output.
      // Source parts are emitted by the SDK for some providers.
      const webSearchSources: Array<{ title: string; url: string }> = [];
      let webSearchUsed = false;
      type AISV6ToolPart = { type: string; state: string; input?: unknown; output?: unknown };
      type AISV6SourcePart = { type: 'source-url'; url: string; title?: string };
      for (const part of message.parts ?? []) {
        // Tool parts: type is 'tool-web_search', 'tool-whatever', etc.
        if (part.type.startsWith('tool-')) {
          const toolName = part.type.slice(5); // Strip 'tool-' prefix
          const tp = part as unknown as AISV6ToolPart;
          if (toolName === 'web_search' && tp.state === 'output' && tp.output) {
            webSearchUsed = true;
            // Anthropic: output is an array of result objects with url/title
            // OpenAI: output is { action: { query }, sources: [{ type: 'url', url }] }
            const out = tp.output as Record<string, unknown> | unknown[];
            const rawResults = Array.isArray(out)
              ? out
              : Array.isArray((out as Record<string, unknown>).sources)
                ? (out as Record<string, unknown>).sources as unknown[]
                : [];
            for (const r of rawResults) {
              const res = r as { url?: string; title?: string };
              if (res.url) webSearchSources.push({ url: res.url, title: res.title ?? res.url });
            }
          }
        }
        // source-url parts: emitted by AI SDK for web citations
        if (part.type === 'source-url') {
          const sp = part as unknown as AISV6SourcePart;
          if (sp.url && !webSearchSources.find((s) => s.url === sp.url)) {
            webSearchUsed = true;
            webSearchSources.push({ url: sp.url, title: sp.title ?? sp.url });
          }
        }
      }
      if (webSearchUsed) {
        console.log('[ChatPanel] 🔍 Web search sources extracted:', webSearchSources.length);
      }

      // Merge server metadata (usage/tokenDetails) with extracted web search data
      const serverMeta = message.metadata as MessageMetadata | undefined;
      const aiMessageMetadata: MessageMetadata = {
        ...serverMeta,
        ...(metadata.onboardingStep ? {
          custom: {
            ...(serverMeta?.custom ?? {}),
            onboardingStep: metadata.onboardingStep,
          },
        } : {}),
        ...(webSearchUsed ? {
          custom: {
            ...(metadata.onboardingStep
              ? { ...(serverMeta?.custom ?? {}), onboardingStep: metadata.onboardingStep }
              : (serverMeta?.custom ?? {})),
            webSearch: { used: true, sources: webSearchSources },
          },
        } : {}),
      };

      // Persist AI message to store using CAPTURED conversationId and model
      addAIMessage(
        metadata.conversationId,
        messageText,
        metadata.model,
        aiMessageMetadata
      );

      // Track usage from message metadata (sent by server via messageMetadata)
      const msgMetadata = message.metadata as { 
        usage?: { inputTokens: number; outputTokens: number };
        actualCost?: {
          inputCost: number;
          outputCost: number;
          totalCost: number;
          cacheCreationCost?: number;
          cacheReadCost?: number;
          toolCallsCost?: number;
          currency: string;
        };
        tokenDetails?: {
          cacheCreationInputTokens?: number;
          cacheReadInputTokens?: number;
        };
        trial?: { messagesUsed: number };
      } | undefined;

      // Sync trial usage from server cookie (authoritative count)
      if (msgMetadata?.trial?.messagesUsed != null) {
        syncTrialFromServer(msgMetadata.trial.messagesUsed);
      }

      const usage = msgMetadata?.usage;

      if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
        console.log('[ChatPanel] Tracking usage:', {
          model: metadata.model,
          provider: detectProvider(metadata.model),
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          hasActualCost: !!msgMetadata?.actualCost,
          actualCost: msgMetadata?.actualCost?.totalCost,
          conversationId: metadata.conversationId,
        });
        addUsage({
          provider: detectProvider(metadata.model),
          model: metadata.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          conversationId: metadata.conversationId,
          source: 'chat',
          actualCost: msgMetadata?.actualCost,
          tokenDetails: msgMetadata?.tokenDetails,
        });
      } else {
        // Fallback: estimate tokens when SDK doesn't provide usage data.
        // Use actual conversation message lengths for a better input estimate.
        const CHARS_PER_TOKEN = 4;
        const conversationChars = (useCanvasStore.getState().conversations.get(metadata.conversationId)?.content ?? [])
          .reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
        const estimatedInputTokens = Math.ceil(Math.max(conversationChars, messageText.length) / CHARS_PER_TOKEN);
        const estimatedOutputTokens = Math.ceil(messageText.length / CHARS_PER_TOKEN);
        
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

      // If the trial is exhausted, sync the client state
      if (error.message?.includes('free messages')) {
        const trialState = useTrialStore.getState();
        trialState.syncFromServer(trialState.cap);
        analytics.trialExhausted();
      }

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

  const buildCanvasContextPayload = useCallback(async (explicitMessage?: string) => {
    const instructions = activeWorkspace?.context?.instructions?.trim() || '';

    console.log('[ChatPanel] buildCanvasContextPayload called', {
      hasInstructions: !!instructions,
      hasKbContent: !!kbContent,
      kbContentLength: kbContent?.length || 0,
    });

    let knowledgeBase = '';

    if (kbContent) {
      if (kbContent.length <= KB_FULL_CONTEXT_MAX_CHARS) {
        // Fits within threshold — send full content directly (Anthropic-recommended approach
        // for KBs < 200K tokens; no chunking or retrieval needed).
        knowledgeBase = kbContent;
      } else {
        // Oversized KB — fall back to TF-IDF keyword retrieval.
        console.warn('[ChatPanel] KB content exceeds full-context threshold, falling back to TF-IDF retrieval');
        const query = explicitMessage || input.trim();
        if (query && activeWorkspaceId) {
          const kbFiles = await getKnowledgeBaseContents(activeWorkspaceId);
          const index = buildRagIndex(kbFiles);
          const ragContext = buildKnowledgeBaseContext(index, query, { maxChars: KB_RAG_FALLBACK_MAX_CHARS });
          if (ragContext?.text?.trim()) {
            knowledgeBase = ragContext.text.trim();
          }
        }
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
      knowledgeBasePreview: payload.knowledgeBase?.substring(0, 100),
    });

    return payload;
  }, [activeWorkspace, kbContent, activeWorkspaceId, input]);

  // Handle message submission
  // =========================================================================
  // SINGLE-SEND ARCHITECTURE
  // =========================================================================
  // All three send paths (submit, retry, edit) follow the same pattern:
  //   1. Set streamingRequestMetadataRef FIRST (blocks sync effect immediately)
  //   2. Persist changes to Zustand store (set() is synchronous)
  //   3. Build canvas context (async — safe because sync effect is blocked)
  //   4. Load full conversation from store → setMessages (single source of truth)
  //   5. sendMessage(null) — triggers API with current messages, NO duplicate user msg
  //   6. onFinish/onError clears the ref, re-enabling sync effect
  // =========================================================================

  const handleSubmit = useCallback(async (text: string, attachments?: MessageAttachment[]) => {
    // Validate input
    if (!text.trim() && !(attachments?.length)) return;
    
    // Prevent concurrent requests
    if (isStreaming) {
      console.warn('[ChatPanel] Cannot start new request while streaming is in progress');
      return;
    }
    
    // Clear input immediately so user sees instant feedback
    setInput('');

    if (!activeConversationId || !currentModel) {
      console.warn('[ChatPanel] Cannot start request: missing conversationId or model');
      return;
    }

    const onboardingState = useOnboardingStore.getState();
    const onboardingStep = onboardingState.active ? onboardingState.step : undefined;
    const demoRecordState = useDemoRecordStore.getState();
    const demoRecordStep = demoRecordState.active ? demoRecordState.step : undefined;
    
    // 1. Lock sync effect — MUST be first to prevent races during setup
    streamingRequestMetadataRef.current = {
      conversationId: activeConversationId,
      model: currentModel,
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
      onboardingStep: onboardingStep ?? demoRecordStep,
    };
    setStreamingConversationId(activeConversationId);

    // 2. Persist user message to store (Zustand set() is synchronous — state is
    //    immediately available even though saveToStorage is async background work)
    useCanvasStore.getState().sendMessage(text, attachments).catch(err =>
      console.error('[ChatPanel] Failed to persist user message to storage:', err)
    );

    // 3. Set pending attachments for body construction
    if (attachments?.length) {
      setPendingAttachments(attachments);
    }

    // 4. Build canvas context (async — safe because sync effect is blocked by ref)
    const canvasContextPayload = await buildCanvasContextPayload(text);

    // 5. Load full conversation from store (includes user msg from step 2)
    // inlineTextAttachments ensures file contents from earlier turns stay in history
    const storeMessages = getConversationMessages(activeConversationId);
    setMessages(storeMessages.map((msg, idx) => ({
      id: `msg-${idx}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, text: inlineTextAttachments(msg) }],
    })));

    // 6. Build request body (inline — don't rely on stale memoized chatBody)
    const isOnboarding = Boolean(onboardingStep);
    const isDemoRecord = Boolean(demoRecordStep);
    const body = {
      model: currentModel,
      anthropicKey: currentKeys.anthropic,
      openaiKey: currentKeys.openai,
      ...(isOnboarding ? { onboarding: true, onboardingStep } : {}),
      ...(isDemoRecord ? { demoRecord: true, demoRecordStep } : {}),
      ...(attachments?.length ? {
        attachments: attachments.map(a => ({
          contentType: a.contentType,
          name: a.name,
          url: a.url,
        })),
      } : {}),
      ...(canvasContextPayload ? { canvasContext: canvasContextPayload } : {}),
    };

    // Analytics: first real message + trial message tracking
    if (!isOnboarding && !isDemoRecord) {
      const firstMsgKey = 'projectloom:first-message-fired';
      if (!localStorage.getItem(firstMsgKey)) {
        localStorage.setItem(firstMsgKey, '1');
        analytics.firstRealMessage({
          has_api_key: !!(currentKeys.anthropic || currentKeys.openai),
          model: currentModel,
        });
      }
      if (isTrialActive) {
        const trialState = useTrialStore.getState();
        analytics.trialMessageSent(trialState.messagesUsed + 1);
      }
    }

    // 7. Send to API — undefined means "use current messages, don't add a new one"
    //    This eliminates the dual-send: no second user message is appended by useChat.
    try {
      await sendMessage(undefined, { body });
    } finally {
      // Safety net: ensure ref is cleared even if sendMessage throws.
      // onFinish/onError should have already handled this.
      if (streamingRequestMetadataRef.current?.conversationId === activeConversationId) {
        streamingRequestMetadataRef.current = null;
      }
      setPendingAttachments([]);
    }
  }, [setInput, buildCanvasContextPayload, sendMessage, isStreaming, isTrialActive, activeConversationId, currentModel, currentKeys, setStreamingConversationId, getConversationMessages, setMessages, setPendingAttachments]);

  // Handle retry: remove all messages after the target user message and re-send it
  const handleRetry = useCallback(async (messageIndex: number) => {
    if (useOnboardingStore.getState().active) return;
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

    if (!activeConversationId || !currentModel) {
      console.warn('[ChatPanel] Cannot retry: missing conversationId or model');
      return;
    }

    const onboardingState = useOnboardingStore.getState();
    const onboardingStep = onboardingState.active ? onboardingState.step : undefined;
    const demoRecordState = useDemoRecordStore.getState();
    const demoRecordStep = demoRecordState.active ? demoRecordState.step : undefined;
    
    // 1. Lock sync effect — MUST be before store mutation
    streamingRequestMetadataRef.current = {
      conversationId: activeConversationId,
      model: currentModel,
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
      onboardingStep,
    };
    setStreamingConversationId(activeConversationId);

    // 2. Truncate conversation in store (set() is synchronous)
    const truncatedMessages = messages.slice(0, messageIndex + 1);
    updateConversation(activeConversation.id, {
      content: truncatedMessages,
    });

    const messageAttachments = targetMessage.attachments || [];
    if (messageAttachments.length > 0) {
      setPendingAttachments(messageAttachments);
    }
    
    // 3. Build canvas context (async — safe because sync effect is blocked)
    const canvasContextPayload = await buildCanvasContextPayload(targetMessage.content);
    
    // 4. Load full conversation from store (truncated, includes target user msg)
    // inlineTextAttachments ensures file contents from earlier turns stay in history
    const storeMessages = getConversationMessages(activeConversation.id);
    setMessages(storeMessages.map((msg, idx) => ({
      id: `msg-${idx}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, text: inlineTextAttachments(msg) }],
    })));
    
    // 5. Build request body inline
    const retryBody = {
      model: currentModel,
      anthropicKey: currentKeys.anthropic,
      openaiKey: currentKeys.openai,
      ...(onboardingStep ? { onboarding: true, onboardingStep } : {}),
      ...(demoRecordStep ? { demoRecord: true, demoRecordStep } : {}),
      ...(messageAttachments.length > 0 ? {
        attachments: messageAttachments.map(a => ({
          contentType: a.contentType,
          name: a.name,
          url: a.url,
        })),
      } : {}),
      ...(canvasContextPayload ? { canvasContext: canvasContextPayload } : {}),
    };

    // 6. Send to API — undefined means "use current messages, don't add a new one"
    try {
      await sendMessage(undefined, { body: retryBody });
    } finally {
      if (streamingRequestMetadataRef.current?.conversationId === activeConversationId) {
        streamingRequestMetadataRef.current = null;
      }
    }
    
    console.log('[ChatPanel] Retrying message:', { messageIndex, content: targetMessage.content });
  }, [activeConversation, isStreaming, stop, updateConversation, setMessages, activeConversationId, currentModel, currentKeys, buildCanvasContextPayload, sendMessage, setPendingAttachments, setStreamingConversationId, getConversationMessages]);

  // Handle edit message click
  const handleEditClick = useCallback((messageIndex: number) => {
    if (useOnboardingStore.getState().active) return;
    if (!activeConversation || isStreaming) return;
    const message = activeConversation.content[messageIndex];
    if (!message || message.role !== 'user') return;
    setEditingMessageIndex(messageIndex);
  }, [activeConversation, isStreaming]);

  // Handle edit save — truncates history after the edited message and re-sends
  const handleEditSave = useCallback(async (content: string, attachments: MessageAttachment[]) => {
    if (useOnboardingStore.getState().active) return;
    if (!activeConversation || editingMessageIndex === null || !activeConversationId || !currentModel) return;

    // Stop any ongoing streaming
    if (isStreaming) {
      stop();
    }

    // 1. Lock sync effect — MUST be before store mutation
    const onboardingState = useOnboardingStore.getState();
    const onboardingStep = onboardingState.active ? onboardingState.step : undefined;
    const demoRecordState = useDemoRecordStore.getState();
    const demoRecordStep = demoRecordState.active ? demoRecordState.step : undefined;

    streamingRequestMetadataRef.current = {
      conversationId: activeConversationId,
      model: currentModel,
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
      onboardingStep,
    };
    setStreamingConversationId(activeConversationId);

    // 2. Build the updated message and truncate conversation in store
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

    const truncatedMessages = [
      ...activeConversation.content.slice(0, editingMessageIndex),
      updatedMessage,
    ];
    updateConversation(activeConversation.id, { content: truncatedMessages });

    // Clear edit state
    setEditingMessageIndex(null);

    if (attachments.length > 0) {
      setPendingAttachments(attachments);
    }

    // 3. Build canvas context (async — safe because sync effect is blocked)
    const canvasContextPayload = await buildCanvasContextPayload(content.trim());

    // 4. Load full conversation from store (truncated, includes edited user msg)
    // inlineTextAttachments ensures file contents from earlier turns stay in history
    const storeMessages = getConversationMessages(activeConversation.id);
    setMessages(storeMessages.map((msg, idx) => ({
      id: `msg-${idx}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, text: inlineTextAttachments(msg) }],
    })));

    // 5. Build request body inline
    const body = {
      model: currentModel,
      anthropicKey: currentKeys.anthropic,
      openaiKey: currentKeys.openai,
      ...(onboardingStep ? { onboarding: true, onboardingStep } : {}),
      ...(demoRecordStep ? { demoRecord: true, demoRecordStep } : {}),
      ...(attachments.length > 0 ? {
        attachments: attachments.map(a => ({
          contentType: a.contentType,
          name: a.name,
          url: a.url,
        })),
      } : {}),
      ...(canvasContextPayload ? { canvasContext: canvasContextPayload } : {}),
    };

    // 6. Send to API — undefined means "use current messages, don't add a new one"
    try {
      await sendMessage(undefined, { body });
    } finally {
      if (streamingRequestMetadataRef.current?.conversationId === activeConversationId) {
        streamingRequestMetadataRef.current = null;
      }
    }
  }, [activeConversation, editingMessageIndex, activeConversationId, currentModel, isStreaming, stop, updateConversation, setMessages, buildCanvasContextPayload, currentKeys, setPendingAttachments, sendMessage, setStreamingConversationId, getConversationMessages]);

  // Handle edit cancel
  const handleEditCancel = useCallback(() => {
    setEditingMessageIndex(null);
  }, []);

  // Sync store messages to useChat when conversation changes.
  // Guard: skip sync when this conversation has an active or pending request.
  // The streamingRequestMetadataRef is set BEFORE any async work (store persist, context build,
  // API call) and cleared in onFinish/onError, so it covers the ENTIRE request lifecycle —
  // including the setup phase before isStreaming becomes true. This eliminates the race
  // condition where the sync effect fires between store.sendMessage and useChat.sendMessage.
  //
  // For other conversations (user switching cards), the guard lets the sync through normally.
  useEffect(() => {
    const streamingConvIdRef = streamingRequestMetadataRef.current?.conversationId ?? null;
    if (activeConversationId === streamingConvIdRef) return;

    if (activeConversationId) {
      const storeMessages = getConversationMessages(activeConversationId);
      // Convert to useChat UIMessage format (v6 uses parts instead of content)
      // inlineTextAttachments ensures file contents from earlier turns stay in history
      const formattedMessages = storeMessages.map((msg, idx) => ({
        id: `msg-${idx}`,
        role: msg.role as 'user' | 'assistant' | 'system',
        parts: [{ type: 'text' as const, text: inlineTextAttachments(msg) }],
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
          setPendingAttachments([]);
          return;
        }
        
        // getConversationMessages() only reads the active `conversations` Map, so it
        // returns [] for conversations in background workspaces — causing a false
        // "not yet saved" and then an existence check that also fails the same way.
        // Instead, do a single global lookup that covers all workspaces.
        const partialSaveState = useCanvasStore.getState();
        const globalConv =
          partialSaveState.conversations.get(metadata.conversationId) ??
          partialSaveState.workspaces
            .flatMap(ws => ws.conversations)
            .find(c => c.id === metadata.conversationId);

        const lastStoreMessage = globalConv?.content[globalConv.content.length - 1];

        // Only save if this message isn't already in the store (avoid duplicate saves)
        // Compare content to detect if it's a new/partial message
        if (!lastStoreMessage || lastStoreMessage.content !== lastMessageText) {
          // Verify conversation still exists globally (including background workspaces)
          if (!globalConv) {
            console.warn(`[ChatPanel] Partial save: Target conversation ${metadata.conversationId} no longer exists`);
            streamingRequestMetadataRef.current = null;
            setPendingAttachments([]);
            return;
          }
          
          // For partial saves (user clicked stop), extract web search metadata
          // from tool parts if available (AI SDK v6: type='tool-web_search', state='output')
          const partialSearchSources: Array<{ title: string; url: string }> = [];
          type PartialToolPart = { type: string; state: string; output?: unknown };
          for (const part of lastMessage.parts ?? []) {
            if (!part.type.startsWith('tool-')) continue;
            const toolName = part.type.slice(5);
            if (toolName !== 'web_search') continue;
            const tp = part as unknown as PartialToolPart;
            if (tp.state !== 'output' || !tp.output) continue;
            const results = Array.isArray(tp.output) ? tp.output : [];
            for (const r of results) {
              const res = r as { url?: string; title?: string };
              if (res.url) partialSearchSources.push({ url: res.url, title: res.title ?? res.url });
            }
          }

          const partialWebSearchMetadata = partialSearchSources.length > 0 ? {
            custom: {
              ...(metadata.onboardingStep ? { onboardingStep: metadata.onboardingStep } : {}),
              webSearch: {
                used: true,
                sources: partialSearchSources,
              },
            },
          } : (metadata.onboardingStep ? { custom: { onboardingStep: metadata.onboardingStep } } : undefined);
          
          // Save partial message using CAPTURED values
          addAIMessage(metadata.conversationId, lastMessageText, metadata.model, partialWebSearchMetadata);
          
          // Don't clear metadata here - let onFinish/onError handle cleanup
          // This prevents race condition where metadata is cleared before onFinish gets it
          
          setPendingAttachments([]);
        }
      }
    }
  }, [isStreaming, chatMessages, addAIMessage]);

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
    const onboardingState = useOnboardingStore.getState();
    if (!canUserCloseChatPanel(onboardingState)) return;
    closeChatPanel();
    setIsMaximized(false);
  }, [closeChatPanel]);

  const handleMaximize = useCallback(() => {
    setIsMaximized(!isMaximized);
  }, [isMaximized]);

  // Memoized panel styles to prevent object recreation on every render
  const panelStyles = useMemo<React.CSSProperties>(() => {
    if (isMobile) {
      return {
        position: 'relative',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        backgroundColor: colors.bg.secondary,
        borderLeft: 'none',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        userSelect: 'auto',
        zIndex: 'auto',
        flexShrink: 1,
        pointerEvents: 'auto',
      } as React.CSSProperties;
    }
    return {
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
      zIndex: isMaximized ? zIndex.ui.sidePanelMaximized : onboardingActive ? zIndex.overlay.modal : zIndex.ui.sidePanel,
      flexShrink: 1,
      pointerEvents: chatPanelOpen ? 'auto' : 'none',
    };
  }, [effectivePanelWidth, isResizing, isMaximized, chatPanelOpen, isMobile, onboardingActive]);

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

  // On mobile, render as a plain div (no SidePanel wrapper, no resize handle)
  if (isMobile) {
    return (
      <div
        ref={panelRef as React.RefObject<HTMLDivElement>}
        style={panelStyles}
      >
        {/* Content */}
        {activeConversation ? (
          <>
            <ChatPanelHeader
              conversation={activeConversation}
              onClose={handleClose}
              onMaximize={handleMaximize}
              branchEnabled={!onboardingActive}
              renameEnabled={!onboardingActive}
              closeEnabled={!onboardingActive}
              isMobile
            />
            <MessageThread
              conversation={activeConversation}
              streamingMessages={
                activeConversationId === streamingConversationId ? chatMessages : []
              }
              isStreaming={isStreaming && activeConversationId === streamingConversationId}
              onHeightChange={setMessageListHeight}
              isMaximized={false}
              onRetry={handleRetry}
              onEditClick={handleEditClick}
              editingMessageIndex={editingMessageIndex}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
              mutationActionsEnabled={!onboardingActive}
            />
            <MessageInput
              conversationId={activeConversation.id}
              input={input}
              setInput={setInput}
              onSubmit={handleSubmit}
              isStreaming={isStreaming && activeConversationId === streamingConversationId}
              onStop={stop}
              hasApiKey={hasAnyApiKey}
              isTrialExhausted={isTrialExhausted}
              error={chatError}
              supportsVision={supportsVision}
              attachments={pendingAttachments}
              onAttachmentsChange={setPendingAttachments}
              currentModel={currentModel}
              onModelChange={handleModelChange}
              maxTextareaHeight={messageListHeight > 0 ? Math.floor(messageListHeight * 0.5) : undefined}
              isMaximized={false}
            />
          </>
        ) : (
          <div style={emptyStateStyles.container}>
            <PanelRightClose size={48} style={emptyStateStyles.icon} />
            <p style={emptyStateStyles.title}>
              Tap a card on the canvas to chat
            </p>
            <p style={emptyStateStyles.subtitle}>
              Open the Canvas tab and tap any conversation card
            </p>
          </div>
        )}
      </div>
    );
  }

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
            branchEnabled={!onboardingActive}
            renameEnabled={!onboardingActive}
            closeEnabled={!onboardingActive}
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
            mutationActionsEnabled={!onboardingActive}
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
            isTrialExhausted={isTrialExhausted}
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
