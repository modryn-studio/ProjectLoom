'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';

import { VersionedStorage, STORAGE_KEYS, CURRENT_SCHEMA_VERSION, clearLegacyStorage } from '@/lib/storage';
import { generateMockData } from '@/lib/mock-data';
import { clearKnowledgeBaseStorage, deleteWorkspaceKnowledgeBase } from '@/lib/knowledge-base-db';
import type { 
  Conversation, 
  Message,
  MessageMetadata,
  Position, 
  EdgeConnection, 
  StorageData, 
  ConversationNodeData,
  Workspace,
  BranchFromMessageData,
  CreateMergeNodeData,
  EdgeRelationType,
  BranchPoint,
  InheritedContextEntry,
  MergeMetadata,
  WorkspaceContext,
} from '@/types';
import { logger } from '@/lib/logger';
import { estimateTokens } from '@/lib/context-utils';
import { useToastStore } from '@/stores/toast-store';
import { generateConversationTitle } from '@/utils/formatters';

// Debounce helper for performance
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = 300;

// History configuration
const MAX_HISTORY_LENGTH = 50;

// Merge node configuration (from types)
const MERGE_CONFIG = {
  MAX_PARENTS: 5,
  WARNING_THRESHOLD: 3,
  BUNDLE_THRESHOLD: 4,
};

// Inherited context configuration
const INHERITED_CONTEXT_CONFIG = {
  /** Max estimated tokens for inherited context before truncation */
  MAX_INHERITED_TOKENS: 10000,
  /** Max depth for recursive context collection */
  MAX_DEPTH: 10,
};

const BRANCH_OFFSET_X = 380;
const BRANCH_DEFAULT_LANE_OFFSET_Y = 180;
const BRANCH_LANE_STEP_Y = 220;

const ONBOARDING_STEP_TITLES: Record<string, string> = {
  'auto-chat-0': 'Job Offer Decision Analysis',
  'auto-chat-1': 'Questions Before Accepting',
  'auto-chat-2': 'What I’d Be Giving Up',
  'auto-chat-3': 'Final Decision Synthesis',
};

const DEMO_RECORD_STEP_TITLES: Record<string, string> = {
  'demo-root-chat': 'Freelance Transition',
  'demo-branch-a-chat': 'Client Pipeline',
  'demo-branch-b-chat': 'Runway & Pricing',
  'demo-merge-1-chat': '90-Day Launch Plan',
  'demo-branch-c-chat': 'Risk Review',
  'demo-merge-2-chat': 'Final Transition Plan',
};

const SCRIPTED_STEP_TITLES: Record<string, string> = {
  ...ONBOARDING_STEP_TITLES,
  ...DEMO_RECORD_STEP_TITLES,
};

// =============================================================================
// CYCLE PREVENTION UTILITIES
// =============================================================================

/**
 * Check if adding an edge from sourceId to targetId would create a cycle.
 * Uses DFS to detect if target can reach source through existing edges.
 */
function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  edges: Edge[],
  conversations: Map<string, Conversation>
): boolean {
  // Build adjacency map once for O(1) child lookups
  const childMap = new Map<string, string[]>();
  edges.forEach(edge => {
    if (!childMap.has(edge.source)) childMap.set(edge.source, []);
    const sourceChildren = childMap.get(edge.source);
    if (sourceChildren) sourceChildren.push(edge.target);
  });
  conversations.forEach((conv) => {
    conv.parentCardIds.forEach((parentId) => {
      if (!childMap.has(parentId)) childMap.set(parentId, []);
      const children = childMap.get(parentId);
      if (children && !children.includes(conv.id)) children.push(conv.id);
    });
  });

  // DFS from targetId to see if we can reach sourceId
  const visited = new Set<string>();
  const stack = [targetId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    
    if (current === sourceId) {
      return true;
    }
    
    if (visited.has(current)) continue;
    visited.add(current);
    
    const children = childMap.get(current);
    if (children) {
      for (const childId of children) {
        if (!visited.has(childId)) {
          stack.push(childId);
        }
      }
    }
  }
  
  return false;
}

/**
 * Check if a connection is valid (no self-loops, no cycles)
 */
function canConnect(
  sourceId: string,
  targetId: string,
  edges: Edge[],
  conversations: Map<string, Conversation>
): { valid: boolean; reason?: string } {
  // No self-loops
  if (sourceId === targetId) {
    return { valid: false, reason: 'Cannot connect a card to itself' };
  }
  
  // Check for existing edge
  const existingEdge = edges.find(e => e.source === sourceId && e.target === targetId);
  if (existingEdge) {
    return { valid: false, reason: 'Connection already exists' };
  }
  
  // Check for cycle
  if (wouldCreateCycle(sourceId, targetId, edges, conversations)) {
    return { valid: false, reason: 'Cannot create circular dependency' };
  }
  
  return { valid: true };
}

// =============================================================================
// INHERITED CONTEXT COLLECTION
// =============================================================================

/**
 * Recursively collect inherited messages from all ancestor cards.
 * Handles multi-level branching (grandparent→parent→child) and merge nodes
 * with multiple parents. Uses a visited set for cycle prevention and
 * deduplicates messages by ID.
 */
function collectInheritedMessages(
  conversation: Conversation,
  conversations: Map<string, Conversation>,
  visited: Set<string> = new Set(),
  depth: number = 0,
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  // Guard: max depth and cycle prevention
  if (depth >= INHERITED_CONTEXT_CONFIG.MAX_DEPTH || visited.has(conversation.id)) {
    return [];
  }
  visited.add(conversation.id);

  const result: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  const seenMessageIds = new Set<string>();

  // Process each parent card
  for (const parentId of conversation.parentCardIds) {
    const parentConversation = conversations.get(parentId);
    const inheritedEntry = conversation.inheritedContext[parentId];

    if (parentConversation) {
      // First, recursively collect the parent's own inherited context
      // This gives us grandparent→parent chain messages
      const ancestorMessages = collectInheritedMessages(
        parentConversation,
        conversations,
        visited,
        depth + 1,
      );
      for (const msg of ancestorMessages) {
        result.push(msg);
      }
    }

    // Then add the messages inherited from this specific parent
    if (inheritedEntry?.messages?.length) {
      for (const msg of inheritedEntry.messages) {
        // Deduplicate by message ID if available
        if (msg.id && seenMessageIds.has(msg.id)) continue;
        if (msg.id) seenMessageIds.add(msg.id);

        // Skip empty-content messages — they cause 500s on providers like Perplexity
        if (!msg.content?.trim()) continue;

        result.push({ role: msg.role, content: msg.content });
      }
    }
  }

  return result;
}

/**
 * Build a structural metadata system message that gives the AI awareness
 * of the conversation's position in the canvas tree.
 */
function buildStructuralMetadata(
  conversation: Conversation,
  conversations: Map<string, Conversation>,
): string {
  const parts: string[] = [];

  // Conversation type
  const isMerge = conversation.isMergeNode;
  const isRoot = conversation.parentCardIds.length === 0;
  const isBranch = !isRoot && !isMerge;

  parts.push('[Current Card Context]');
  parts.push(`Conversation: "${conversation.metadata.title}"`);

  if (isRoot) {
    parts.push('Type: Root conversation (no parent cards)');
  } else if (isMerge) {
    const parentNames = conversation.parentCardIds
      .map((id, idx) => {
        const name = conversations.get(id)?.metadata.title || 'Unknown';
        return `  ${idx + 1}. "${name}"`;
      })
      .join('\n');
    parts.push(`Type: Merge node synthesizing ${conversation.parentCardIds.length} parent conversations:`);
    parts.push(parentNames);
  } else if (isBranch) {
    const parentId = conversation.parentCardIds[0];
    const parent = conversations.get(parentId);
    const branchIdx = conversation.branchPoint?.messageIndex;
    parts.push('Type: Branched conversation');
    if (parent) {
      parts.push(`Parent card: "${parent.metadata.title}"${branchIdx !== undefined ? ` (includes first ${branchIdx + 1} messages)` : ''}`);
    }
  }

  // Inform about inherited context
  const totalInherited = Object.values(conversation.inheritedContext)
    .reduce((sum, entry) => sum + (entry.messages?.length || 0), 0);
  if (totalInherited > 0) {
    parts.push(`\nInherited context: ${totalInherited} messages from parent card(s)`);
    parts.push('(Messages below marked with source)');
  }

  return parts.join('\n');
}

/**
 * Generate an AI-powered title for a conversation asynchronously
 * Called after the first AI response to create a meaningful title
 */
async function generateAITitle(
  conversationId: string,
  userMessage: string,
  assistantMessage: string,
  model: string,
  onboardingStep?: string,
): Promise<void> {
  try {
    console.log('[Auto-Title] generateAITitle called:', { conversationId, model });

    if (onboardingStep) {
      const scriptedTitle = SCRIPTED_STEP_TITLES[onboardingStep]
        ?? generateConversationTitle({ userText: userMessage, assistantText: assistantMessage });

      await new Promise((resolve) => setTimeout(resolve, 900));

      const state = useCanvasStore.getState();
      const conversation = state.conversations.get(conversationId);

      if (!conversation) {
        console.warn('[Auto-Title] Onboarding conversation deleted before title update');
        return;
      }

      if (conversation.metadata.titleIsManual) {
        console.log('[Auto-Title] Onboarding title was manually changed, skipping update');
        return;
      }

      state.updateConversation(conversationId, {
        metadata: {
          ...conversation.metadata,
          title: scriptedTitle,
          titleAutoGenerated: true,
          updatedAt: new Date(),
        },
      });

      console.log('[Auto-Title] ✅ Applied onboarding scripted title:', scriptedTitle);
      return;
    }
    
    // Import dynamically to avoid SSR issues
    const { apiKeyManager } = await import('@/lib/api-key-manager');
    
    // Get API keys for the model's provider
    const anthropicKey = apiKeyManager.getKey('anthropic') ?? undefined;
    const openaiKey = apiKeyManager.getKey('openai') ?? undefined;

    if (!anthropicKey && !openaiKey) {
      // If trial mode is active, the server will inject its own key.
      // Check using the public env var (client-accessible).
      const trialEnabled = process.env.NEXT_PUBLIC_TRIAL_REQUEST_CAP !== undefined;
      if (!trialEnabled) {
        console.warn('[Auto-Title] No API keys available for title generation');
        logger.warn('No API keys available for title generation');
        return;
      }
      console.log('[Auto-Title] No user keys, but trial mode active — server will inject key');
    }
    
    console.log('[Auto-Title] Fetching AI-generated title...');

    const response = await fetch('/api/generate-title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userMessage,
        assistantMessage,
        model,
        anthropicKey,
        openaiKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Auto-Title] API request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      logger.warn('Failed to generate AI title:', response.statusText);
      return;
    }

    const { title, usage } = await response.json() as { title: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } };
    
    console.log('[Auto-Title] Received response:', { title, usage });
    
    if (!title) {
      console.warn('[Auto-Title] AI title generation returned empty title');
      logger.warn('AI title generation returned empty title');
      return;
    }

    // Track usage if available
    if (usage && usage.totalTokens > 0) {
      const { useUsageStore } = await import('./usage-store');
      const { detectProvider } = await import('@/lib/vercel-ai-integration');
      
      console.log('[Canvas Store] Tracking title generation usage:', {
        model,
        provider: detectProvider(model),
        usage,
      });
      
      useUsageStore.getState().addUsage({
        provider: detectProvider(model),
        model,
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        conversationId,
        source: 'title-generation' as const,
      });
    } else {
      logger.warn('Title generation usage data missing or zero:', { model, usage });
    }

    // Update the conversation with the generated title
    const state = useCanvasStore.getState();
    const conversation = state.conversations.get(conversationId);
    
    if (!conversation) {
      console.warn('[Auto-Title] Conversation deleted before title update');
      return;
    }
    
    if (conversation.metadata.titleIsManual) {
      console.log('[Auto-Title] Title was manually changed, skipping AI update');
      return;
    }

    console.log('[Auto-Title] Updating conversation with AI title:', {
      conversationId,
      oldTitle: conversation.metadata.title,
      newTitle: title,
    });

    state.updateConversation(conversationId, {
      metadata: {
        ...conversation.metadata,
        title,
        titleAutoGenerated: true,
        updatedAt: new Date(),
      },
    });

    console.log('[Auto-Title] ✅ Successfully updated title to:', title);
    logger.debug(`AI-generated title for ${conversationId}: "${title}"`);
  } catch (error) {
    console.error('[Auto-Title] Error generating AI title:', error);
    logger.error('Error generating AI title:', error);
    // Fail silently - keep the fallback title
  }
}

// =============================================================================
// TYPES
// =============================================================================

export type ConversationNode = Node<ConversationNodeData>;

interface CreateConversationOptions {
  openChat?: boolean;
}

interface HistoryState {
  nodes: ConversationNode[];
  edges: Edge[];
  conversations: Map<string, Conversation>;
}

interface WorkspaceState {
  // Data
  nodes: ConversationNode[];
  edges: Edge[];
  conversations: Map<string, Conversation>;

  // Workspaces (flat, no hierarchy)
  workspaces: Workspace[];
  activeWorkspaceId: string;

  // UI State
  expandedNodeIds: Set<string>;
  selectedNodeIds: Set<string>;
  isInitialized: boolean;
  isAnyNodeDragging: boolean;
  focusNodeId: string | null;

  // Transient flag: suppresses Framer Motion mount animations during workspace switch
  _skipMountAnimation: boolean;

  // Hierarchical Merge Dialog State
  hierarchicalMergeDialogOpen: boolean;

  // Chat Panel State (session-only)
  chatPanelOpen: boolean;
  activeConversationId: string | null;
  draftMessages: Map<string, string>;
  /** One-shot signal for pushing text into a visible MessageInput without a card switch. */
  inputInjection: { cardId: string; text: string; seq: number } | null;
  
  // Last used model (persisted)
  lastUsedModel: string | null;

  // Usage Panel State (session-only)
  usagePanelOpen: boolean;
  // Pending conversation delete request (session-only)
  pendingDeleteConversationIds: string[];

  // History for undo/redo
  history: HistoryState[];
  historyIndex: number;

  // Actions - Node Management
  createConversationCard: (workspaceId: string, position?: Position, options?: CreateConversationOptions) => Conversation;
  addConversation: (conversation: Conversation, position?: Position) => void;
  deleteConversation: (id: string) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;

  // Actions - Node State
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  setSelected: (ids: string[]) => void;
  clearSelection: () => void;
  requestFocusNode: (id: string) => void;
  clearFocusNode: () => void;

  // Actions - History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  recordHistory: () => void;

  // Actions - React Flow Handlers
  onNodesChange: (changes: NodeChange<ConversationNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;

  // Actions - Persistence
  initializeFromStorage: () => void;
  saveToStorage: () => void;
  loadMockData: () => void;
  initializeEmpty: () => void;
  clearAll: () => void;

  // Actions - Workspace Management (flat, no hierarchy)
  createWorkspace: (title: string) => Workspace;
  navigateToWorkspace: (workspaceId: string) => void;
  getCurrentWorkspace: () => Workspace | undefined;
  getWorkspaces: () => Workspace[];
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (workspaceId: string) => void;
  clearWorkspaceKnowledgeBase: (workspaceId: string) => void;

  // Actions - Card-Level Branching (v4)
  branchFromMessage: (data: BranchFromMessageData) => Conversation | null;
  createMergeNode: (data: CreateMergeNodeData) => Conversation | null;
  createEdge: (sourceId: string, targetId: string, relationType: EdgeRelationType) => Edge | null;
  canAddMergeParent: (mergeNodeId: string) => boolean;
  getMergeParentCount: (mergeNodeId: string) => number;

  // Actions - Hierarchical Merge Dialog
  openHierarchicalMergeDialog: () => void;
  closeHierarchicalMergeDialog: () => void;

  // Actions - Chat Panel
  openChatPanel: (conversationId: string) => void;
  closeChatPanel: () => void;
  setDraftMessage: (conversationId: string, content: string) => void;
  getDraftMessage: (conversationId: string) => string;
  /**
   * Immediately push text into the visible MessageInput for `cardId`, even when
   * that card's conversation ID has not changed (e.g. edge-draw merge promotion).
   * Also calls setDraftMessage so the text persists if the panel is closed/reopened.
   */
  injectInputValue: (cardId: string, text: string) => void;
  sendMessage: (content: string, attachments?: import('@/types').MessageAttachment[]) => Promise<void>;
  editMessage: (conversationId: string, messageIndex: number, newContent: string, newAttachments?: import('@/types').MessageAttachment[]) => void;
  // Actions - Usage Panel
  openUsagePanel: () => void;
  closeUsagePanel: () => void;
  toggleUsagePanel: () => void;
  requestDeleteConversation: (conversationIds: string[]) => void;
  clearDeleteConversationRequest: () => void;

  // Actions - AI Integration (Phase 2)
  addUserMessage: (conversationId: string, content: string) => void;
  addAIMessage: (conversationId: string, content: string, model: string, metadata?: MessageMetadata, id?: string) => void;
  setConversationModel: (conversationId: string, model: string) => void;
  getConversationModel: (conversationId: string) => string | undefined;
  getConversationMessages: (conversationId: string) => Array<{ role: 'user' | 'assistant' | 'system'; content: string; attachments?: import('@/types').MessageAttachment[] }>;

  // Actions - Drag State
  setIsAnyNodeDragging: (isDragging: boolean) => void;

  // Actions - Layout
  applyLayout: (positions: Map<string, { x: number; y: number }>) => void;
}

// =============================================================================
// DEFAULT DATA
// =============================================================================

const defaultStorageData: StorageData = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  conversations: [],
  positions: {},
  connections: [],
  settings: {
    theme: 'dark',
    showMinimap: true,
    snapToGrid: false,
  },
};

/**
 * Create a default workspace (flat, no hierarchy)
 */
function createDefaultWorkspace(): Workspace {
  const now = new Date();
  return {
    id: nanoid(),
    title: 'Main Workspace',
    conversations: [],
    edges: [],
    tags: [],
    context: createDefaultWorkspaceContext(),
    metadata: {
      title: 'Main Workspace',
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
  };
}

function createDefaultWorkspaceContext(): WorkspaceContext {
  return {
    instructions: '',
    knowledgeBaseFiles: [],
    updatedAt: new Date(),
  };
}

function normalizeWorkspaceContext(context?: WorkspaceContext): WorkspaceContext {
  if (!context) return createDefaultWorkspaceContext();

  return {
    instructions: context.instructions || '',
    knowledgeBaseFiles: Array.isArray(context.knowledgeBaseFiles) ? context.knowledgeBaseFiles : [],
    updatedAt: context.updatedAt || new Date(),
  };
}

// =============================================================================
// STORAGE INSTANCE (v4 - flat workspaces)
// =============================================================================

const storage = new VersionedStorage<StorageData>({
  key: STORAGE_KEYS.CANVAS_DATA,
  version: CURRENT_SCHEMA_VERSION,
  defaultData: defaultStorageData,
  debug: process.env.NODE_ENV === 'development',
});

// Workspace storage (v4 - flat, no hierarchy)
const workspaceStorage = new VersionedStorage<{ workspaces: Workspace[]; activeWorkspaceId: string }>({
  key: STORAGE_KEYS.WORKSPACES,
  version: CURRENT_SCHEMA_VERSION,
  defaultData: { workspaces: [], activeWorkspaceId: '' },
  debug: process.env.NODE_ENV === 'development',
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert conversation to React Flow node
 */
function conversationToNode(
  conversation: Conversation,
  position: Position,
  isExpanded: boolean,
  isSelected: boolean
): ConversationNode {
  return {
    id: conversation.id,
    type: 'conversation',
    position: { x: position.x, y: position.y },
    data: {
      conversation,
      isExpanded,
      isSelected,
    },
    selected: isSelected,
    draggable: true,
    selectable: true,
  };
}

/**
 * Get edge style based on relation type (v4)
 * Uses CSS variables for theme-aware colors
 */
function getEdgeStyle(relationType: EdgeRelationType): { stroke: string; strokeWidth: number; strokeDasharray?: string } {
  switch (relationType) {
    case 'branch':
      return { stroke: 'var(--accent-primary)', strokeWidth: 2 };
    case 'merge':
      return { stroke: 'var(--success-solid)', strokeWidth: 3 };
    case 'reference':
      return { stroke: 'var(--fg-tertiary)', strokeWidth: 1, strokeDasharray: '5,5' };
    default:
      return { stroke: 'var(--accent-primary)', strokeWidth: 2 };
  }
}

/**
 * Convert edge connection to React Flow edge (v4 with relation types)
 */
function connectionToEdge(connection: EdgeConnection): Edge {
  const relationType = connection.relationType || 'branch';
  const style = getEdgeStyle(relationType);
  
  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    type: connection.curveType || 'bezier',
    animated: connection.animated
      ?? (relationType === 'merge' || relationType === 'reference'),
    style,
    data: { relationType },
  };
}

// =============================================================================
// STORE
// =============================================================================

export const useCanvasStore = create<WorkspaceState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    nodes: [],
    edges: [],
    conversations: new Map(),
    
    // Workspaces (flat, no hierarchy)
    workspaces: [],
    activeWorkspaceId: '',
    
    expandedNodeIds: new Set(),
    selectedNodeIds: new Set(),
    isInitialized: false,
    isAnyNodeDragging: false,
    focusNodeId: null,
    _skipMountAnimation: false,
    
    // Hierarchical Merge Dialog State
    hierarchicalMergeDialogOpen: false,
    
    // Chat Panel State (session-only)
    chatPanelOpen: false,
    activeConversationId: null,
    draftMessages: new Map(),
    inputInjection: null,
    
    // Last used model (persisted)
    lastUsedModel: null,

    // Usage Panel State (session-only)
    usagePanelOpen: false,

    // Pending delete request
    pendingDeleteConversationIds: [],
    
    history: [],
    historyIndex: -1,

    // =========================================================================
    // History Management
    // =========================================================================

    canUndo: () => get().historyIndex > 0,
    
    canRedo: () => {
      const { history, historyIndex } = get();
      return historyIndex < history.length - 1;
    },

    recordHistory: () => {
      const { nodes, edges, conversations, history, historyIndex } = get();
      const newState: HistoryState = {
        nodes: [...nodes],
        edges: [...edges],
        conversations: new Map(conversations),
      };

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newState);

      if (newHistory.length > MAX_HISTORY_LENGTH) {
        newHistory.shift();
      }

      set({
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    },

    undo: () => {
      const { historyIndex, history, conversations } = get();
      
      if (historyIndex <= 0) return; // Nothing to undo

      const previousState = history[historyIndex - 1];

      // Undo is structural-only: node existence, position, and edges.
      // Message content is never reverted — this mirrors how Figma/Miro handle undo
      // (structural undo should not destroy chat history the user cannot recover).
      // For each conversation that survives the undo (exists in both live state and the
      // restored state), carry forward the live message content and its updated metadata.
      const mergedConversations = new Map(previousState.conversations);
      for (const [id, restoredConv] of mergedConversations) {
        const liveConv = conversations.get(id);
        if (liveConv && liveConv.content.length > 0) {
          mergedConversations.set(id, {
            ...restoredConv,
            content: liveConv.content,
            metadata: {
              ...restoredConv.metadata,
              messageCount: liveConv.content.length,
              updatedAt: liveConv.metadata.updatedAt,
              // Preserve the AI-generated title if one was assigned after creation
              title: liveConv.metadata.titleIsManual || liveConv.metadata.titleAutoGenerated
                ? liveConv.metadata.title
                : restoredConv.metadata.title,
              titleIsManual: liveConv.metadata.titleIsManual,
              titleAutoGenerated: liveConv.metadata.titleAutoGenerated,
            },
          });
        }
      }
      
      // Nodes also embed conversation data in node.data.conversation — patch them
      // so the two sources of truth remain consistent after message-content preservation.
      const mergedNodes = previousState.nodes.map((node) => {
        const merged = mergedConversations.get(node.id);
        if (!merged) return node;
        return { ...node, data: { ...node.data, conversation: merged } };
      });

      set({
        nodes: mergedNodes,
        edges: previousState.edges,
        conversations: mergedConversations,
        historyIndex: historyIndex - 1,
      });

      get().saveToStorage();
    },

    redo: () => {
      const { historyIndex, history, conversations } = get();
      
      if (historyIndex >= history.length - 1) return; // Nothing to redo

      const nextState = history[historyIndex + 1];

      // Same structural-only principle for redo: preserve live message content for
      // conversations that exist in both states.
      const mergedConversations = new Map(nextState.conversations);
      for (const [id, restoredConv] of mergedConversations) {
        const liveConv = conversations.get(id);
        if (liveConv && liveConv.content.length > 0) {
          mergedConversations.set(id, {
            ...restoredConv,
            content: liveConv.content,
            metadata: {
              ...restoredConv.metadata,
              messageCount: liveConv.content.length,
              updatedAt: liveConv.metadata.updatedAt,
              title: liveConv.metadata.titleIsManual || liveConv.metadata.titleAutoGenerated
                ? liveConv.metadata.title
                : restoredConv.metadata.title,
              titleIsManual: liveConv.metadata.titleIsManual,
              titleAutoGenerated: liveConv.metadata.titleAutoGenerated,
            },
          });
        }
      }

      // Patch nodes to match the merged conversations.
      const mergedNodes = nextState.nodes.map((node) => {
        const merged = mergedConversations.get(node.id);
        if (!merged) return node;
        return { ...node, data: { ...node.data, conversation: merged } };
      });

      set({
        nodes: mergedNodes,
        edges: nextState.edges,
        conversations: mergedConversations,
        historyIndex: historyIndex + 1,
      });

      get().saveToStorage();
    },

    // =========================================================================
    // Node Management
    // =========================================================================

    createConversationCard: (workspaceId, position, options) => {
      const now = new Date();
      const finalPosition = position ?? { x: Math.random() * 500, y: Math.random() * 500 };
      const content: Message[] = [];

      const newConversation: Conversation = {
        id: nanoid(),
        canvasId: workspaceId,
        position: finalPosition,
        content,
        connections: [],
        parentCardIds: [],
        inheritedContext: {},
        isMergeNode: false,
        metadata: {
          title: 'New Conversation',
          titleIsManual: false,
          titleAutoGenerated: true,
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
          tags: [],
          isExpanded: false,
        },
        // Use last used model if available
        model: get().lastUsedModel ?? undefined,
      };

      get().addConversation(newConversation, finalPosition);

      if (options?.openChat) {
        get().openChatPanel(newConversation.id);
      }

      get().recordHistory();

      return newConversation;
    },

    addConversation: (conversation, position) => {
      const { nodes, conversations } = get();

      // Generate position if not provided
      const pos = position ?? { x: Math.random() * 500, y: Math.random() * 500 };

      // Create node
      const newNode = conversationToNode(conversation, pos, false, false);

      // Update state
      const newConversations = new Map(conversations);
      newConversations.set(conversation.id, conversation);

      set({
        nodes: [...nodes, newNode],
        conversations: newConversations,
      });

      // Persist
      get().saveToStorage();
    },

    deleteConversation: (id) => {
      const { nodes, edges, conversations, history, historyIndex, expandedNodeIds, selectedNodeIds } = get();

      // Remove node
      const newNodes = nodes.filter((n) => n.id !== id);

      // Remove connected edges
      const newEdges = edges.filter((e) => e.source !== id && e.target !== id);

      // Remove from map
      const newConversations = new Map(conversations);
      newConversations.delete(id);

      // Remove from expanded/selected
      const newExpanded = new Set(expandedNodeIds);
      newExpanded.delete(id);
      const newSelected = new Set(selectedNodeIds);
      newSelected.delete(id);

      // Save the NEW state (after deletion) to history
      const newState: HistoryState = {
        nodes: newNodes,
        edges: newEdges,
        conversations: newConversations,
      };

      // Truncate history if we're not at the end (user did undo then made a new change)
      const newHistory = history.slice(0, historyIndex + 1);

      // The pre-deletion snapshot may be stale: messages are never recorded in history
      // (updateConversation / sendMessage / addAIMessage skip recordHistory for perf).
      // Patch the snapshot we're branching from so that undoing the deletion restores
      // the card with its actual message content, not the creation-time empty state.
      if (newHistory.length > 0) {
        const preDeleteEntry = newHistory[newHistory.length - 1];
        const liveConvBeingDeleted = conversations.get(id);
        if (liveConvBeingDeleted && liveConvBeingDeleted.content.length > 0) {
          const patchedConversations = new Map(preDeleteEntry.conversations);
          patchedConversations.set(id, liveConvBeingDeleted);
          const patchedNodes = preDeleteEntry.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, conversation: liveConvBeingDeleted } } : n
          );
          newHistory[newHistory.length - 1] = {
            ...preDeleteEntry,
            conversations: patchedConversations,
            nodes: patchedNodes,
          };
        }
      }

      newHistory.push(newState);

      // Limit history to last N states
      if (newHistory.length > MAX_HISTORY_LENGTH) {
        newHistory.shift();
      }

      set({
        nodes: newNodes,
        edges: newEdges,
        conversations: newConversations,
        expandedNodeIds: newExpanded,
        selectedNodeIds: newSelected,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });

      // Persist
      get().saveToStorage();
    },

    updateConversation: (id, updates) => {
      const { nodes, conversations } = get();

      const existing = conversations.get(id);
      if (!existing) return;

      // Update conversation
      const updated: Conversation = { ...existing, ...updates };
      const newConversations = new Map(conversations);
      newConversations.set(id, updated);

      // Update node data
      const newNodes = nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              conversation: updated,
            },
          };
        }
        return node;
      });

      set({
        nodes: newNodes,
        conversations: newConversations,
      });

      // Persist
      get().saveToStorage();
    },

    // =========================================================================
    // Node State
    // =========================================================================

    toggleExpanded: (id) => {
      const { expandedNodeIds } = get();
      const newExpanded = new Set(expandedNodeIds);

      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }

      // Update nodes with new expanded state
      // Force complete node refresh to clear any cached dimensions
      set((state) => ({
        expandedNodeIds: newExpanded,
        nodes: state.nodes.map((node) => {
          if (node.id === id) {
            // Create completely new node object to force React Flow remeasure
            return {
              ...node,
              data: {
                ...node.data,
                isExpanded: newExpanded.has(node.id),
              },
              // Clear any style that might have cached dimensions
              style: undefined,
            };
          }
          return {
            ...node,
            data: {
              ...node.data,
              isExpanded: newExpanded.has(node.id),
            },
          };
        }),
      }));
    },

    setExpanded: (id, expanded) => {
      const { expandedNodeIds } = get();
      const newExpanded = new Set(expandedNodeIds);

      if (expanded) {
        newExpanded.add(id);
      } else {
        newExpanded.delete(id);
      }

      // Update nodes with new expanded state
      // Force complete node refresh to clear any cached dimensions
      set((state) => ({
        expandedNodeIds: newExpanded,
        nodes: state.nodes.map((node) => {
          if (node.id === id) {
            // Create completely new node object to force React Flow remeasure
            return {
              ...node,
              data: {
                ...node.data,
                isExpanded: newExpanded.has(node.id),
              },
              // Clear any style that might have cached dimensions
              style: undefined,
            };
          }
          return {
            ...node,
            data: {
              ...node.data,
              isExpanded: newExpanded.has(node.id),
            },
          };
        }),
      }));
    },

    setSelected: (ids) => {
      const newSelected = new Set(ids);

      set((state) => ({
        selectedNodeIds: newSelected,
        nodes: state.nodes.map((node) => ({
          ...node,
          selected: newSelected.has(node.id),
          data: {
            ...node.data,
            isSelected: newSelected.has(node.id),
          },
        })),
      }));
    },

    clearSelection: () => {
      set((state) => ({
        selectedNodeIds: new Set(),
        nodes: state.nodes.map((node) => ({
          ...node,
          selected: false,
          data: {
            ...node.data,
            isSelected: false,
          },
        })),
      }));
    },

    requestFocusNode: (id) => {
      set({ focusNodeId: id });
    },

    clearFocusNode: () => {
      set({ focusNodeId: null });
    },

    // =========================================================================
    // React Flow Handlers
    // =========================================================================

    onNodesChange: (changes) => {
      set((state) => {
        // PERFORMANCE: Pre-index changes by id for O(1) lookup instead of O(n*m)
        const positionChanges = new Map<string, { x: number; y: number }>();
        const selectChanges = new Map<string, boolean>();
        const removeIds = new Set<string>();
        
        for (const change of changes) {
          if (change.type === 'position' && change.position) {
            positionChanges.set(change.id, change.position);
          } else if (change.type === 'select') {
            selectChanges.set(change.id, change.selected ?? false);
          } else if (change.type === 'remove') {
            removeIds.add(change.id);
          }
          // Explicitly ignore 'dimensions' changes - we control size via isExpanded state
          // React Flow measures DOM dimensions, but we animate via Framer Motion
        }
        
        // Quick exit if no relevant changes
        if (positionChanges.size === 0 && selectChanges.size === 0 && removeIds.size === 0) {
          return state;
        }
        
        // Track selection changes to update selectedNodeIds
        const newSelectedIds = new Set(state.selectedNodeIds);
        
        // Update nodes with O(n) complexity (single pass)
        let newNodes = state.nodes;
        
        if (positionChanges.size > 0 || selectChanges.size > 0) {
          newNodes = state.nodes.map((node) => {
            const newPosition = positionChanges.get(node.id);
            const newSelected = selectChanges.get(node.id);
            
            // No changes for this node
            if (newPosition === undefined && newSelected === undefined) {
              return node;
            }
            
            // Apply position and/or selection changes. Both can arrive in the same batch
            // (e.g. drag-start: React Flow moves and selects simultaneously).
            if (newPosition !== undefined || newSelected !== undefined) {
              if (newSelected !== undefined) {
                if (newSelected) {
                  newSelectedIds.add(node.id);
                } else {
                  newSelectedIds.delete(node.id);
                }
              }
              return {
                ...node,
                ...(newPosition !== undefined ? { position: newPosition } : {}),
                ...(newSelected !== undefined ? {
                  selected: newSelected,
                  data: { ...node.data, isSelected: newSelected },
                } : {}),
              };
            }
            
            return node;
          });
        }

        // Handle remove changes
        const filteredNodes = removeIds.size > 0
          ? newNodes.filter((n) => !removeIds.has(n.id))
          : newNodes;
        
        // Also remove deleted nodes from selectedNodeIds
        removeIds.forEach(id => newSelectedIds.delete(id));

        return { nodes: filteredNodes, selectedNodeIds: newSelectedIds };
      });

      // Debounced save after position changes (only when drag ends)
      const hasPositionFinalized = changes.some((c) => c.type === 'position' && c.dragging === false);
      if (hasPositionFinalized) {
        get().saveToStorage();
        get().recordHistory();
      }
    },

    onEdgesChange: (changes) => {
      let didRemove = false;
      set((state) => {
        // Handle remove changes
        const removeChanges = changes.filter((c) => c.type === 'remove');
        const removeIds = removeChanges.map((c) => c.id);

        if (removeIds.length > 0) {
          didRemove = true;

          // Find edges being removed to clean up parentCardIds
          const removedEdges = state.edges.filter((e) => removeIds.includes(e.id));
          const newConversations = new Map(state.conversations);

          for (const edge of removedEdges) {
            const targetConv = newConversations.get(edge.target);
            if (targetConv && targetConv.parentCardIds.includes(edge.source)) {
              const updated = {
                ...targetConv,
                parentCardIds: targetConv.parentCardIds.filter(id => id !== edge.source),
              };
              // Also remove inherited context from that parent
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { [edge.source]: _removed, ...remainingContext } = updated.inheritedContext;
              updated.inheritedContext = remainingContext;
              newConversations.set(edge.target, updated);
            }
          }

          return {
            edges: state.edges.filter((e) => !removeIds.includes(e.id)),
            conversations: newConversations,
          };
        }

        return state;
      });

      get().saveToStorage();
      if (didRemove) {
        get().recordHistory();
      }
    },

    onConnect: (connection) => {
      if (!connection.source || !connection.target) return;

      const { nodes, conversations, edges } = get();
      const toast = useToastStore.getState();

      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);

      if (!sourceNode || !targetNode) {
        logger.warn('Connection failed: source or target node not found');
        return;
      }

      if (sourceNode.position.x >= targetNode.position.x) {
        toast.warning('Branches must flow left to right. Drag forward to branch.');
        return;
      }

      const sourceConversation = conversations.get(connection.source);
      const targetConversation = conversations.get(connection.target);

      if (!sourceConversation || !targetConversation) {
        logger.warn('Connection failed: source or target conversation missing');
        return;
      }

      const isMergeTarget = targetConversation.isMergeNode;
      const isAlreadyParent = targetConversation.parentCardIds.includes(sourceConversation.id);
      const proposedParentCount = isAlreadyParent
        ? targetConversation.parentCardIds.length
        : targetConversation.parentCardIds.length + 1;
      const willBecomeMerge = !isMergeTarget && proposedParentCount > 1;

      if ((isMergeTarget || willBecomeMerge) && proposedParentCount > MERGE_CONFIG.MAX_PARENTS) {
        toast.error(
          `Merge limit reached (${MERGE_CONFIG.MAX_PARENTS} sources). Create an intermediate merge first.`,
          {
            action: {
              label: 'Learn More',
              onClick: () => get().openHierarchicalMergeDialog(),
            },
            duration: 8000,
          }
        );
        get().openHierarchicalMergeDialog();
        return;
      }

      if (edges.some((edge) => edge.source === connection.source && edge.target === connection.target)) {
        return;
      }

      const relationType: EdgeRelationType = (isMergeTarget || willBecomeMerge)
        ? 'merge'
        : 'branch';

      const newEdge = get().createEdge(
        connection.source,
        connection.target,
        relationType
      );

      if (!newEdge) return;

      if (!isAlreadyParent) {
        const now = new Date();
        const updatedParentIds = [...targetConversation.parentCardIds, sourceConversation.id];
        const updatedInheritedContext = {
          ...targetConversation.inheritedContext,
          [sourceConversation.id]: {
            mode: 'full' as const,
            messages: sourceConversation.content,
            timestamp: now,
            totalParentMessages: sourceConversation.content.length,
          },
        };

        const shouldInsertNotice = targetConversation.content.length > 0;

        const inheritedNotice: Message = {
          id: nanoid(),
          role: 'system',
          content: `Inherited context added from "${sourceConversation.metadata.title}"`,
          timestamp: now,
          metadata: {
            custom: { inheritedFrom: sourceConversation.id },
          },
        };

        const updatedContent = shouldInsertNotice
          ? [...targetConversation.content, inheritedNotice]
          : targetConversation.content;

        const nextIsMergeNode = isMergeTarget || updatedParentIds.length > 1;
        const nextMergeMetadata = nextIsMergeNode
          ? {
              sourceCardIds: updatedParentIds,
              synthesisPrompt: targetConversation.mergeMetadata?.synthesisPrompt,
              createdAt: targetConversation.mergeMetadata?.createdAt ?? now,
            }
          : undefined;

        if (nextIsMergeNode) {
          set((state) => ({
            edges: state.edges.map((edge) => {
              if (edge.target !== targetConversation.id) return edge;
              return {
                ...edge,
                animated: true,
                style: getEdgeStyle('merge'),
                data: { relationType: 'merge' },
              };
            }),
          }));
        }

        get().updateConversation(targetConversation.id, {
          parentCardIds: updatedParentIds,
          inheritedContext: updatedInheritedContext,
          content: updatedContent,
          isMergeNode: nextIsMergeNode,
          mergeMetadata: nextMergeMetadata,
          branchPoint: nextIsMergeNode ? undefined : targetConversation.branchPoint,
          metadata: {
            ...targetConversation.metadata,
            updatedAt: now,
            messageCount: updatedContent.length,
            tags: nextIsMergeNode
              ? Array.from(new Set([...(targetConversation.metadata.tags || []), 'merge']))
              : targetConversation.metadata.tags,
          },
        });
      }

      get().recordHistory();
    },

    // =========================================================================
    // Persistence (v4 - flat workspaces)
    // =========================================================================

    initializeFromStorage: () => {
      // Clear legacy v3 storage keys on startup
      clearLegacyStorage();
      
      const result = storage.load();
      const workspaceResult = workspaceStorage.load();

      // Check if we have any actual conversation data in canvas-data
      const hasStoredConversations = result.success && 
                                     result.data.conversations && 
                                     result.data.conversations.length > 0;
      
      // Check if workspace storage has any workspaces (user-created or previously saved)
      const hasStoredWorkspaces = workspaceResult.success &&
                                  workspaceResult.data.workspaces &&
                                  workspaceResult.data.workspaces.length > 0;
      
      // Only load mock data on truly first-time use:
      // no conversations AND no workspaces in storage.
      // If the user has workspaces (even empty ones), respect that.
      if (!hasStoredConversations && !hasStoredWorkspaces) {
        logger.debug('First-time use: initializing empty workspace');
        get().initializeEmpty();
        return;
      }
      
      // If workspace storage has data but canvas-data is empty,
      // restore from the active workspace in workspace storage.
      if (!hasStoredConversations && hasStoredWorkspaces) {
        logger.debug('Restoring from workspace storage');
        const workspaces = workspaceResult.data.workspaces.map((workspace: Workspace) => ({
          ...workspace,
          context: normalizeWorkspaceContext(workspace.context),
        }));
        const activeId = workspaceResult.data.activeWorkspaceId || workspaces[0]?.id || '';
        const activeWorkspace = workspaces.find((w: Workspace) => w.id === activeId) || workspaces[0];
        
        const conversations = new Map<string, Conversation>();
        const nodes: ConversationNode[] = [];
        let edges: Edge[] = [];
        
        if (activeWorkspace) {
          activeWorkspace.conversations.forEach((conv: Conversation) => {
            conversations.set(conv.id, conv);
          });
          activeWorkspace.conversations.forEach((conv: Conversation) => {
            nodes.push(conversationToNode(conv, conv.position, false, false));
          });
          edges = (activeWorkspace.edges || []).map(connectionToEdge);
        }
        
        set({
          nodes,
          edges,
          conversations,
          workspaces,
          activeWorkspaceId: activeId,
          expandedNodeIds: new Set(),
          selectedNodeIds: new Set(),
          isInitialized: true,
          history: [{
            nodes: [...nodes],
            edges: [...edges],
            conversations: new Map(conversations),
          }],
          historyIndex: 0,
        });
        return;
      }

      logger.debug('Loading from storage:', result.data.conversations.length, 'conversation(s)');
      const storedData = result.data;

      // Reconstruct state from storage
      const conversations = new Map<string, Conversation>();
      const expandedNodeIds = new Set<string>();
      const selectedNodeIds = new Set<string>();

      storedData.conversations.forEach((conv: Conversation) => {
        conversations.set(conv.id, conv);
      });

      // Restore draft messages
      const draftMessages = new Map<string, string>();
      if (storedData.draftMessages) {
        Object.entries(storedData.draftMessages).forEach(([id, draft]) => {
          if (draft) draftMessages.set(id, draft);
        });
      }

      // Create nodes from stored positions
      const nodes: ConversationNode[] = storedData.conversations.map((conv: Conversation) => {
        const position = storedData.positions[conv.id] ?? { x: 0, y: 0 };
        return conversationToNode(conv, position, false, false);
      });

      // Create edges (v4 with relation types)
      const edges: Edge[] = storedData.connections.map(connectionToEdge);

      // Load workspaces (v4 - flat, no hierarchy)
      let workspaces: Workspace[] = [];
      let activeWorkspaceId = '';
      
      if (workspaceResult.success && workspaceResult.data.workspaces.length > 0) {
        workspaces = workspaceResult.data.workspaces.map((workspace) => ({
          ...workspace,
          context: normalizeWorkspaceContext(workspace.context),
        }));
        activeWorkspaceId = workspaceResult.data.activeWorkspaceId || workspaces[0]?.id || '';
      } else {
        // Create default workspace
        const mainWorkspace = createDefaultWorkspace();
        mainWorkspace.conversations = Array.from(conversations.values());
        mainWorkspace.edges = storedData.connections;
        workspaces = [mainWorkspace];
        activeWorkspaceId = mainWorkspace.id;
      }

      set({
        nodes,
        edges,
        conversations,
        workspaces,
        activeWorkspaceId,
        expandedNodeIds,
        selectedNodeIds,
        draftMessages,
        lastUsedModel: storedData.lastUsedModel ?? null,
        isInitialized: true,
        // Initialize history with the initial state
        history: [{
          nodes: [...nodes],
          edges: [...edges],
          conversations: new Map(conversations),
        }],
        historyIndex: 0,
      });
    },

    saveToStorage: () => {
      // Debounce saves to prevent excessive localStorage writes during drag
      if (saveTimeout) clearTimeout(saveTimeout);
      
      saveTimeout = setTimeout(() => {
        const { nodes, edges, conversations, workspaces, activeWorkspaceId, draftMessages } = get();

        // Build positions map
        const positions: Record<string, Position> = {};
        nodes.forEach((node) => {
          positions[node.id] = {
            x: node.position.x,
            y: node.position.y,
          };
        });

        // Build connections array (v4 with relation types)
        const connections: EdgeConnection[] = edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          curveType: (edge.type as 'smoothstep' | 'bezier' | 'straight') || 'smoothstep',
          relationType: (edge.data?.relationType as EdgeRelationType) || 'branch',
          animated: edge.animated ?? false,
        }));

        // Convert draft messages Map to plain object for storage
        const draftMessagesObj: Record<string, string> = {};
        draftMessages.forEach((draft, id) => {
          draftMessagesObj[id] = draft;
        });

        const data: StorageData = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          conversations: Array.from(conversations.values()),
          positions,
          connections,
          lastUsedModel: get().lastUsedModel,
          draftMessages: draftMessagesObj,
          settings: {
            theme: 'dark',
            showMinimap: true,
            snapToGrid: false,
          },
        };

        storage.save(data);
        
        // Save workspaces (v4 - flat, no hierarchy).
        // Always save, even when empty — otherwise a "delete all workspaces" action
        // won't persist and the old list revives on next page load.
        {
          const updatedWorkspaces = workspaces.map(w => {
            if (w.id === activeWorkspaceId) {
              return {
                ...w,
                // Reconcile conv.position from live node positions so workspace
                // switches restore cards to their current dragged locations
                conversations: Array.from(conversations.values()).map(conv => ({
                  ...conv,
                  position: positions[conv.id] ?? conv.position,
                })),
                edges: connections,
                metadata: { ...w.metadata, updatedAt: new Date() },
              };
            }
            return w;
          });
          workspaceStorage.save({ workspaces: updatedWorkspaces, activeWorkspaceId });
        }

      }, SAVE_DEBOUNCE_MS);
    },

    loadMockData: () => {
      const mockData = generateMockData();
      const { conversations: mockConversations, edges: mockEdges } = mockData;

      // Create main workspace first
      const mainWorkspace = createDefaultWorkspace();

      // Update all conversations to use the actual workspace ID
      const updatedConversations = mockConversations.map(conv => ({
        ...conv,
        canvasId: mainWorkspace.id,
      }));

      // Create conversations map
      const conversations = new Map<string, Conversation>();
      updatedConversations.forEach((conv: Conversation) => {
        conversations.set(conv.id, conv);
      });

      // Create nodes using conversation positions
      const nodes: ConversationNode[] = updatedConversations.map((conv: Conversation) => {
        return conversationToNode(conv, conv.position, false, false);
      });

      // Create edges (v4 with relation types)
      const edges: Edge[] = mockEdges.map(connectionToEdge);

      // Populate workspace with conversations
      mainWorkspace.conversations = Array.from(conversations.values());
      mainWorkspace.edges = mockEdges;

      set({
        nodes,
        edges,
        conversations,
        workspaces: [mainWorkspace],
        activeWorkspaceId: mainWorkspace.id,
        expandedNodeIds: new Set(),
        selectedNodeIds: new Set(),
        isInitialized: true,
        // Initialize history with the initial state
        history: [{
          nodes: [...nodes],
          edges: [...edges],
          conversations: new Map(conversations),
        }],
        historyIndex: 0,
      });

      // Save to storage
      get().saveToStorage();
    },

    initializeEmpty: () => {
      const mainWorkspace = createDefaultWorkspace();

      set({
        nodes: [],
        edges: [],
        conversations: new Map(),
        workspaces: [mainWorkspace],
        activeWorkspaceId: mainWorkspace.id,
        expandedNodeIds: new Set(),
        selectedNodeIds: new Set(),
        isInitialized: true,
        history: [{
          nodes: [],
          edges: [],
          conversations: new Map(),
        }],
        historyIndex: 0,
      });

      get().saveToStorage();
    },

    clearAll: () => {
      storage.clear();
      void clearKnowledgeBaseStorage().catch((error) => {
        logger.warn('Failed to clear knowledge base storage', error);
      });

      set({
        nodes: [],
        edges: [],
        conversations: new Map(),
        workspaces: [],
        activeWorkspaceId: '',
        expandedNodeIds: new Set(),
        selectedNodeIds: new Set(),
        isInitialized: false,
        focusNodeId: null,
      });
    },

    // =========================================================================
    // Workspace Management (v4 - flat, no hierarchy)
    // =========================================================================

    createWorkspace: (title: string) => {
      const now = new Date();
      const newWorkspace: Workspace = {
        id: nanoid(),
        title,
        conversations: [],
        edges: [],
        tags: [],
        context: createDefaultWorkspaceContext(),
        metadata: {
          title,
          createdAt: now,
          updatedAt: now,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        },
      };

      set((state) => ({
        workspaces: [...state.workspaces, newWorkspace],
      }));

      get().saveToStorage();
      return newWorkspace;
    },

    navigateToWorkspace: (workspaceId: string) => {
      const { workspaces, activeWorkspaceId, conversations: currentConversations, edges: currentEdges, nodes: currentNodes } = get();

      // Already on this workspace — do nothing to preserve live canvas state
      if (activeWorkspaceId === workspaceId) return;

      const workspace = workspaces.find(w => w.id === workspaceId);
      if (!workspace) {
        logger.warn(`Workspace ${workspaceId} not found`);
        return;
      }

      // Save current workspace's state before switching
      if (activeWorkspaceId && activeWorkspaceId !== workspaceId) {
        const currentConnections: EdgeConnection[] = currentEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          curveType: (edge.type as 'smoothstep' | 'bezier' | 'straight') || 'smoothstep',
          relationType: (edge.data?.relationType as EdgeRelationType) || 'branch',
          animated: edge.animated ?? false,
        }));

        // Reconcile conv.position from live node positions before snapshotting,
        // so the saved workspace has accurate positions even if the user dragged
        // cards since the last debounced save
        const livePositions: Record<string, Position> = {};
        currentNodes.forEach((node) => {
          livePositions[node.id] = { x: node.position.x, y: node.position.y };
        });

        const updatedWorkspaces = workspaces.map(w => {
          if (w.id === activeWorkspaceId) {
            return {
              ...w,
              conversations: Array.from(currentConversations.values()).map(conv => ({
                ...conv,
                position: livePositions[conv.id] ?? conv.position,
              })),
              edges: currentConnections,
              metadata: { ...w.metadata, updatedAt: new Date() },
            };
          }
          return w;
        });

        set({ workspaces: updatedWorkspaces });
      }

      // Load conversations for the target workspace
      const conversations = new Map<string, Conversation>();
      workspace.conversations.forEach((conv) => {
        conversations.set(conv.id, conv);
      });

      // Use CANVAS_DATA positions as a migration fallback for workspaces that
      // were saved before position reconciliation was in place; conv.position
      // is authoritative once the fix is running
      const storedCanvasData = storage.load();
      const migratedPositions = storedCanvasData?.data?.positions ?? {};

      // Create nodes from conversations
      const nodes: ConversationNode[] = workspace.conversations.map((conv) => {
        const position = migratedPositions[conv.id] ?? conv.position ?? { x: 0, y: 0 };
        return conversationToNode(conv, position, false, false);
      });

      // Restore edges (v4 with relation types)
      const edges: Edge[] = (workspace.edges || []).map(connectionToEdge);

      set({
        _skipMountAnimation: true,
        activeWorkspaceId: workspaceId,
        nodes,
        edges,
        conversations,
        expandedNodeIds: new Set(),
        selectedNodeIds: new Set(),
        chatPanelOpen: false,
        activeConversationId: null,
        history: [{
          nodes: [...nodes],
          edges: [...edges],
          conversations: new Map(conversations),
        }],
        historyIndex: 0,
      });

      // Clear the flag after React has committed the new nodes
      requestAnimationFrame(() => set({ _skipMountAnimation: false }));

      // Persist the workspace switch
      get().saveToStorage();
    },

    getCurrentWorkspace: () => {
      const { workspaces, activeWorkspaceId } = get();
      return workspaces.find(w => w.id === activeWorkspaceId);
    },

    getWorkspaces: () => {
      return get().workspaces;
    },

    updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => {
      set((state) => ({
        workspaces: state.workspaces.map(w => 
          w.id === workspaceId 
            ? { 
                ...w, 
                ...updates, 
                // Keep top-level title in sync with metadata.title
                title: updates.metadata?.title ?? updates.title ?? w.title,
                metadata: { 
                  ...w.metadata, 
                  ...(updates.metadata || {}),
                  updatedAt: new Date() 
                } 
              }
            : w
        ),
      }));
      get().saveToStorage();
    },

    deleteWorkspace: (workspaceId: string) => {
      const { workspaces, activeWorkspaceId } = get();
      const remainingWorkspaces = workspaces.filter(w => w.id !== workspaceId);

      set({
        workspaces: remainingWorkspaces,
      });

      void deleteWorkspaceKnowledgeBase(workspaceId).catch((error) => {
        logger.warn('Failed to delete workspace knowledge base files', error);
      });

      // If we deleted the active workspace, navigate to first remaining
      if (workspaceId === activeWorkspaceId) {
        const remaining = remainingWorkspaces[0];
        if (remaining) {
          get().navigateToWorkspace(remaining.id);
        } else {
          set({
            nodes: [],
            edges: [],
            conversations: new Map(),
            activeWorkspaceId: '',
            expandedNodeIds: new Set(),
            selectedNodeIds: new Set(),
            chatPanelOpen: false,
            activeConversationId: null,
            draftMessages: new Map(),
            usagePanelOpen: false,
            history: [],
            historyIndex: -1,
          });
        }
      }

      get().saveToStorage();
    },

    clearWorkspaceKnowledgeBase: (workspaceId: string) => {
      const { workspaces } = get();
      const targetWorkspace = workspaces.find(w => w.id === workspaceId);

      if (!targetWorkspace) {
        logger.warn(`Workspace ${workspaceId} not found`);
        return;
      }

      void deleteWorkspaceKnowledgeBase(workspaceId).catch((error) => {
        logger.warn('Failed to clear canvas knowledge base files', error);
      });

      set((state) => ({
        workspaces: state.workspaces.map(w =>
          w.id === workspaceId
            ? {
                ...w,
                context: {
                  ...w.context,
                  knowledgeBaseFiles: [],
                  updatedAt: new Date(),
                },
                metadata: {
                  ...w.metadata,
                  updatedAt: new Date(),
                },
              }
            : w
        ),
      }));

      get().saveToStorage();
    },

    // =========================================================================
    // Card-Level Branching (v4)
    // =========================================================================

    branchFromMessage: (data: BranchFromMessageData) => {
      const { sourceCardId, messageIndex, branchReason, targetPosition } = data;
      const { conversations, nodes, activeWorkspaceId } = get();
      
      const sourceConversation = conversations.get(sourceCardId);
      if (!sourceConversation || !Array.isArray(sourceConversation.content)) {
        logger.error(`Invalid source conversation ${sourceCardId}`);
        return null;
      }

      const contentMessages = sourceConversation.content;
      const hasOwnMessages = contentMessages.length > 0;
      const inheritedParentMessages = sourceConversation.parentCardIds.flatMap((parentId) => {
        const entry = sourceConversation.inheritedContext[parentId];
        return entry?.messages ?? [];
      });

      if (!hasOwnMessages && inheritedParentMessages.length === 0) {
        logger.error(`No messages to branch from for conversation ${sourceCardId}`);
        return null;
      }

      if (hasOwnMessages && (messageIndex < 0 || messageIndex >= contentMessages.length)) {
        logger.error(`Invalid message index ${messageIndex} for conversation ${sourceCardId}`);
        return null;
      }

      const sourceNode = nodes.find(n => n.id === sourceCardId);
      if (!sourceNode) {
        logger.error(`Source node not found: ${sourceCardId}`);
        return null;
      }

      // Calculate position for new branch.
      // If no explicit target is provided, place sibling branches into separate
      // vertical lanes so they fan out instead of overlapping.
      let newPosition: Position;
      if (targetPosition) {
        newPosition = targetPosition;
      } else {
        const defaultX = sourceNode.position.x + BRANCH_OFFSET_X;
        const occupiedSiblingYs = Array.from(conversations.values())
          .filter((conv) => conv.parentCardIds.includes(sourceCardId))
          .filter((conv) => Math.abs(conv.position.x - defaultX) < 120)
          .map((conv) => conv.position.y);

        const laneOffsets: number[] = [];
        for (let i = 1; i <= 8; i += 1) {
          const distance = BRANCH_DEFAULT_LANE_OFFSET_Y + (i - 1) * BRANCH_LANE_STEP_Y;
          laneOffsets.push(distance);
          laneOffsets.push(-distance);
        }

        let selectedY = sourceNode.position.y + BRANCH_DEFAULT_LANE_OFFSET_Y;
        for (const offset of laneOffsets) {
          const candidateY = sourceNode.position.y + offset;
          const collides = occupiedSiblingYs.some((y) => Math.abs(y - candidateY) < BRANCH_LANE_STEP_Y * 0.75);
          if (!collides) {
            selectedY = candidateY;
            break;
          }
        }

        newPosition = {
          x: defaultX,
          y: selectedY,
        };
      }

      // Build inherited context - always use full context
      const messagesUpToIndex = hasOwnMessages
        ? contentMessages.slice(0, messageIndex + 1)
        : [];
      // Create branch point info
      const branchPoint: BranchPoint = {
        parentCardId: sourceCardId,
        messageIndex: hasOwnMessages ? messageIndex : 0,
      };

      // Create inherited context entry
      const now = new Date();
      const inheritedContext: Record<string, InheritedContextEntry> = {
        ...sourceConversation.inheritedContext,
        [sourceCardId]: {
          mode: 'full',
          messages: messagesUpToIndex,
          timestamp: now,
          totalParentMessages: contentMessages.length,
        },
      };

      // Create the new branched conversation
      // Copy model from parent conversation if available, otherwise use lastUsedModel
      const inheritedModel = sourceConversation.model ?? get().lastUsedModel ?? undefined;
      
      const newConversation: Conversation = {
        id: nanoid(),
        canvasId: activeWorkspaceId,
        position: newPosition,
        content: [], // New branch starts empty (inherits context)
        connections: [],
        parentCardIds: [sourceCardId],
        branchPoint,
        inheritedContext,
        isMergeNode: false,
        metadata: {
          title: branchReason || `Branch from message ${messageIndex + 1}`,
          titleAutoGenerated: true,
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
          tags: [],
          isExpanded: false,
        },
        // Inherit model from parent
        model: inheritedModel,
      };

      // Add conversation to store
      get().addConversation(newConversation, newPosition);

      // Create branch edge
      get().createEdge(sourceCardId, newConversation.id, 'branch');

      // Record history AFTER all changes so undo restores to this exact state.
      get().recordHistory();

      return newConversation;
    },

    createMergeNode: (data: CreateMergeNodeData) => {
      const { sourceCardIds, position, synthesisPrompt } = data;
      const { conversations, activeWorkspaceId } = get();
      const toast = useToastStore.getState();
      
      // Validate minimum parent count
      if (sourceCardIds.length < 2) {
        logger.error('Merge node requires at least 2 source cards');
        return null;
      }
      
      // Validate parent count - show error toast if blocked
      if (sourceCardIds.length > MERGE_CONFIG.MAX_PARENTS) {
        logger.warn(`Cannot create merge node with ${sourceCardIds.length} parents (max ${MERGE_CONFIG.MAX_PARENTS})`);
        toast.error(
          `Merge node limit reached (${MERGE_CONFIG.MAX_PARENTS} sources). Consider creating intermediate merge nodes.`,
          { 
            action: { 
              label: 'Learn More', 
              onClick: () => get().openHierarchicalMergeDialog() 
            },
            duration: 8000,
          }
        );
        return null;
      }
      
      // Show warning for complex merges (3+ sources)
      if (sourceCardIds.length >= MERGE_CONFIG.WARNING_THRESHOLD) {
        toast.warning(
          `Adding ${sourceCardIds.length}/${MERGE_CONFIG.MAX_PARENTS} sources. Complex merges may reduce AI response quality.`,
          { duration: 5000 }
        );
      }

      // Validate all source cards exist
      const sourceConversations = sourceCardIds
        .map(id => conversations.get(id))
        .filter((c): c is Conversation => c !== undefined);

      if (sourceConversations.length !== sourceCardIds.length) {
        logger.error('One or more source cards not found');
        return null;
      }

      // Build inherited context from all parents.
      // Mirror branchFromMessage: spread each source card's own inheritedContext first
      // so that grandparent/ancestor entries cascade into the merge node. Without this,
      // the UI banner and buildStructuralMetadata only see the two direct parents —
      // not the full ancestry chain — even though the AI does get ancestor messages
      // via collectInheritedMessages in getConversationMessages.
      const now = new Date();
      const inheritedContext: Record<string, InheritedContextEntry> = {};
      sourceCardIds.forEach(cardId => {
        const conv = conversations.get(cardId);
        if (conv && Array.isArray(conv.content)) {
          // Cascade ancestor entries from this source card (same as branchFromMessage)
          Object.assign(inheritedContext, conv.inheritedContext);
          // Then write this source card's own messages as its direct entry
          inheritedContext[cardId] = {
            mode: 'full',
            messages: conv.content,
            timestamp: now,
            totalParentMessages: conv.content.length,
          };
        }
      });

      // Create merge metadata
      const mergeMetadata: MergeMetadata = {
        sourceCardIds,
        synthesisPrompt,
        createdAt: now,
      };

      // Copy model from first parent conversation if available, otherwise use lastUsedModel
      const inheritedModel = sourceConversations[0].model ?? get().lastUsedModel ?? undefined;

      // Create the merge node
      const mergeNode: Conversation = {
        id: nanoid(),
        canvasId: activeWorkspaceId,
        position,
        content: [], // Merge node starts empty
        connections: [],
        parentCardIds: sourceCardIds,
        inheritedContext,
        isMergeNode: true,
        mergeMetadata,
        metadata: {
          title: synthesisPrompt || `Merge of ${sourceCardIds.length} threads`,
          titleAutoGenerated: true,
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
          tags: ['merge'],
          isExpanded: false,
        },
        // Inherit model from first parent
        model: inheritedModel,
      };

      // Add conversation to store
      get().addConversation(mergeNode, position);

      // Record history AFTER all changes so undo restores to this exact state.

      // Create merge edges from all source cards
      // Use edge bundling visual style if 4+ parents for visual simplification
      if (sourceCardIds.length >= MERGE_CONFIG.BUNDLE_THRESHOLD) {
        // Validate all connections first (cycle detection)
        const { edges: currentEdges } = get();
        const validSourceIds = sourceCardIds.filter(sourceId => {
          const check = canConnect(sourceId, mergeNode.id, currentEdges, get().conversations);
          if (!check.valid) {
            logger.warn(`Skipping edge ${sourceId} → ${mergeNode.id}: ${check.reason}`);
          }
          return check.valid;
        });

        // Render all edges but with reduced opacity, plus label on first
        const mergeStyle = getEdgeStyle('merge');
        const newEdges: Edge[] = validSourceIds.map((sourceId, index) => ({
          id: `edge-merge-${sourceId}-${mergeNode.id}`,
          source: sourceId,
          target: mergeNode.id,
          type: 'bezier',
          animated: true,
          style: {
            ...mergeStyle,
            opacity: 0.6, // Reduced opacity for bundled appearance
          },
          label: index === 0 ? `${validSourceIds.length} sources` : undefined, // Only first edge gets label
          data: { 
            relationType: 'merge',
            isBundled: true,
          },
        }));
        
        set((state) => ({
          edges: [...state.edges, ...newEdges],
        }));
      } else {
        // Create individual edges for 3 or fewer parents
        sourceCardIds.forEach(sourceId => {
          get().createEdge(sourceId, mergeNode.id, 'merge');
        });
      }

      get().recordHistory();

      return mergeNode;
    },

    createEdge: (sourceId: string, targetId: string, relationType: EdgeRelationType) => {
      const { edges, conversations } = get();
      
      // Cycle prevention check
      const connectionCheck = canConnect(sourceId, targetId, edges, conversations);
      if (!connectionCheck.valid) {
        logger.warn(`Cannot create edge: ${connectionCheck.reason}`);
        return null;
      }
      
      const style = getEdgeStyle(relationType);
      
      const newEdge: Edge = {
        id: `edge-${relationType}-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        type: 'bezier',
        animated: relationType === 'merge' || relationType === 'reference',
        style,
        data: { relationType },
      };

      set((state) => ({
        edges: [...state.edges, newEdge],
      }));

      get().saveToStorage();
      return newEdge;
    },

    canAddMergeParent: (mergeNodeId: string) => {
      const count = get().getMergeParentCount(mergeNodeId);
      return count < MERGE_CONFIG.MAX_PARENTS;
    },

    getMergeParentCount: (mergeNodeId: string) => {
      const conversation = get().conversations.get(mergeNodeId);
      if (!conversation?.isMergeNode) return 0;
      return conversation.parentCardIds?.length || 0;
    },

    // =========================================================================
    // Hierarchical Merge Dialog
    // =========================================================================

    openHierarchicalMergeDialog: () => {
      set({ hierarchicalMergeDialogOpen: true });
    },

    closeHierarchicalMergeDialog: () => {
      set({ hierarchicalMergeDialogOpen: false });
    },

    // =========================================================================
    // Chat Panel Management
    // =========================================================================

    openChatPanel: (conversationId: string) => {
      const conversation = get().conversations.get(conversationId);
      
      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found`);
        return;
      }

      // Auto-save current draft before switching (if we have one)
      // Draft is managed in MessageInput component state, but we store it here when switching
      
      set((state) => ({
        chatPanelOpen: true,
        activeConversationId: conversationId,
        selectedNodeIds: new Set([conversationId]),
        nodes: state.nodes.map((node) => ({
          ...node,
          selected: node.id === conversationId,
          data: {
            ...node.data,
            isSelected: node.id === conversationId,
          },
        })),
      }));
      
      logger.debug(`Opened chat panel for conversation ${conversationId}`);
    },

    closeChatPanel: () => {
      set((state) => ({
        chatPanelOpen: false,
        activeConversationId: null,
        selectedNodeIds: new Set(),
        nodes: state.nodes.map((node) => ({
          ...node,
          selected: false,
          data: {
            ...node.data,
            isSelected: false,
          },
        })),
      }));
    },

    // =========================================================================
    // Usage Panel Management
    // =========================================================================

    openUsagePanel: () => {
      set({ usagePanelOpen: true });
    },

    closeUsagePanel: () => {
      set({ usagePanelOpen: false });
    },

    toggleUsagePanel: () => {
      set((state) => ({ usagePanelOpen: !state.usagePanelOpen }));
    },

    setDraftMessage: (conversationId: string, content: string) => {
      const { draftMessages } = get();
      const newDrafts = new Map(draftMessages);
      
      if (content.trim()) {
        newDrafts.set(conversationId, content);
      } else {
        newDrafts.delete(conversationId);
      }
      
      set({ draftMessages: newDrafts });
      
      // Persist draft to storage so it survives page refreshes
      get().saveToStorage();
    },

    getDraftMessage: (conversationId: string) => {
      return get().draftMessages.get(conversationId) || '';
    },

    injectInputValue: (cardId: string, text: string) => {
      // Persist so the draft is available if the panel is closed and reopened
      get().setDraftMessage(cardId, text);
      // Bump seq to signal MessageInput to update even when conversationId is unchanged
      const prev = get().inputInjection;
      set({ inputInjection: { cardId, text, seq: (prev?.seq ?? 0) + 1 } });
    },

    requestDeleteConversation: (conversationIds: string[]) => {
      set({ pendingDeleteConversationIds: conversationIds });
    },

    clearDeleteConversationRequest: () => {
      set({ pendingDeleteConversationIds: [] });
    },

    sendMessage: async (content: string, attachments?: import('@/types').MessageAttachment[]) => {
      const { activeConversationId, conversations, draftMessages, workspaces, activeWorkspaceId } = get();
      
      // Allow send when there are attachments even with no text
      const hasText = content.trim().length > 0;
      const hasAttachments = attachments && attachments.length > 0;
      if (!activeConversationId || (!hasText && !hasAttachments)) {
        return;
      }

      const conversation = conversations.get(activeConversationId);
      if (!conversation) {
        logger.warn(`Active conversation ${activeConversationId} not found`);
        return;
      }

      const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
      const instructions = activeWorkspace?.context?.instructions?.trim() || '';
      const knowledgeBaseFileIds = activeWorkspace?.context?.knowledgeBaseFiles?.map(file => file.id) || [];
      const contextSnapshot = (instructions || knowledgeBaseFileIds.length > 0)
        ? {
            instructions: instructions || undefined,
            knowledgeBaseFileIds: knowledgeBaseFileIds.length > 0 ? knowledgeBaseFileIds : undefined,
          }
        : undefined;

      // Create new user message
      const newMessage: Message = {
        id: nanoid(),
        role: 'user' as const,
        content: content.trim(),
        timestamp: new Date(),
        ...(contextSnapshot ? { contextSnapshot } : {}),
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      };

      // Update conversation with new message
      const shouldAutoTitle = conversation.content.length === 0
        && !conversation.metadata.titleIsManual
        && (
          conversation.metadata.titleAutoGenerated === true
          || conversation.metadata.title === 'New Conversation'
          || conversation.metadata.title === ''
          || conversation.metadata.title === 'Untitled'
        );

      const nextTitle = shouldAutoTitle
        ? generateConversationTitle({ userText: newMessage.content })
        : conversation.metadata.title;

      const updatedConversation = {
        ...conversation,
        content: [...conversation.content, newMessage],
        metadata: {
          ...conversation.metadata,
          title: nextTitle,
          titleAutoGenerated: shouldAutoTitle ? true : conversation.metadata.titleAutoGenerated,
          updatedAt: new Date(),
          messageCount: conversation.content.length + 1,
        },
      };

      // Clear draft after sending
      const newDrafts = new Map(draftMessages);
      newDrafts.delete(activeConversationId);

      // Update store
      const newConversations = new Map(conversations);
      newConversations.set(activeConversationId, updatedConversation);

      // Update nodes to reflect new message count
      const { nodes } = get();
      const updatedNodes = nodes.map(node => {
        if (node.id === activeConversationId) {
          return {
            ...node,
            data: {
              ...node.data,
              conversation: updatedConversation,
            },
          };
        }
        return node;
      });

      set({
        conversations: newConversations,
        nodes: updatedNodes,
        draftMessages: newDrafts,
      });

      // Save to storage
      get().saveToStorage();
      
      logger.debug(`Sent message to conversation ${activeConversationId}`);

      // AI response is now handled by ChatPanel via useChat hook
    },

    // =========================================================================
    // AI Integration (Phase 2)
    // =========================================================================

    addUserMessage: (conversationId: string, content: string) => {
      const { conversations, nodes, workspaces, activeWorkspaceId } = get();
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        logger.warn(`Cannot add user message: conversation ${conversationId} not found`);
        return;
      }
      const userMessage = {
        id: nanoid(),
        role: 'user' as const,
        content: content.trim(),
        timestamp: new Date(),
      };
      const updatedConversation = {
        ...conversation,
        content: [...conversation.content, userMessage],
        metadata: {
          ...conversation.metadata,
          updatedAt: new Date(),
          messageCount: conversation.content.length + 1,
        },
      };
      const newConversations = new Map(conversations);
      newConversations.set(conversationId, updatedConversation);
      // Keep nodes in sync so node.data.conversation is never stale
      const updatedNodes = nodes.map((node) =>
        node.id === conversationId
          ? { ...node, data: { ...node.data, conversation: updatedConversation } }
          : node
      );
      const updatedWorkspaces = workspaces.map(ws => {
        if (ws.id !== activeWorkspaceId) return ws;
        return {
          ...ws,
          conversations: ws.conversations.map(c =>
            c.id === conversationId ? updatedConversation : c
          ),
        };
      });
      set({ conversations: newConversations, nodes: updatedNodes, workspaces: updatedWorkspaces });
      get().saveToStorage();
    },

    addAIMessage: (conversationId: string, content: string, model: string, metadata?: MessageMetadata, id?: string) => {
      const { conversations, nodes, workspaces } = get();
      let conversation = conversations.get(conversationId);

      // The conversation may belong to a workspace the user navigated away from while
      // streaming was in progress. In that case it won't be in the active `conversations`
      // Map, but it will still exist in the `workspaces` array. Detect this so we can
      // write the finished message to the correct place.
      let backgroundWorkspaceId: string | null = null;
      if (!conversation) {
        for (const ws of workspaces) {
          const found = ws.conversations.find(c => c.id === conversationId);
          if (found) {
            conversation = found;
            backgroundWorkspaceId = ws.id;
            break;
          }
        }
      }

      if (!conversation) {
        logger.warn(`Cannot add AI message: conversation ${conversationId} not found`);
        return;
      }

      // Create new AI message
      const aiMessage = {
        id: id ?? nanoid(),
        role: 'assistant' as const,
        content: content,
        timestamp: new Date(),
        metadata: {
          model,
          ...(metadata ?? {}),
          custom: {
            ...(metadata?.custom ?? {}),
          },
        },
      };

      // Update conversation
      const hasFirstUserMessage = conversation.content.length === 1;
      const shouldGenerateAITitle = hasFirstUserMessage
        && !conversation.metadata.titleIsManual
        && (
          conversation.metadata.titleAutoGenerated === true
          || conversation.metadata.title === 'New Conversation'
          || conversation.metadata.title === ''
          || conversation.metadata.title === 'Untitled'
        );
      const onboardingStep = typeof metadata?.custom?.onboardingStep === 'string'
        ? metadata.custom.onboardingStep
        : undefined;
      const scriptedStepTitle = onboardingStep
        ? SCRIPTED_STEP_TITLES[onboardingStep]
        : undefined;

      // Use a temporary title while AI title is being generated
      const firstUserText = conversation.content.find(msg => msg.role === 'user')?.content || '';
      const temporaryTitle = shouldGenerateAITitle
        ? (scriptedStepTitle ?? generateConversationTitle({ userText: firstUserText, assistantText: content }))
        : conversation.metadata.title;

      const updatedConversation = {
        ...conversation,
        content: [...conversation.content, aiMessage],
        metadata: {
          ...conversation.metadata,
          title: temporaryTitle,
          titleAutoGenerated: shouldGenerateAITitle ? true : conversation.metadata.titleAutoGenerated,
          updatedAt: new Date(),
          messageCount: conversation.content.length + 1,
        },
      };

      if (backgroundWorkspaceId) {
        // The conversation belongs to a workspace the user navigated away from.
        // Update it directly in the workspaces array so the message is persisted
        // and visible when the user navigates back.
        const updatedWorkspaces = workspaces.map(ws => {
          if (ws.id !== backgroundWorkspaceId) return ws;
          return {
            ...ws,
            conversations: ws.conversations.map(c =>
              c.id === conversationId ? updatedConversation : c
            ),
            metadata: { ...ws.metadata, updatedAt: new Date() },
          };
        });
        set({ workspaces: updatedWorkspaces });
        get().saveToStorage();
        logger.debug(`Added AI message to background conversation ${conversationId} (workspace ${backgroundWorkspaceId})`);

        if (shouldGenerateAITitle) {
          generateAITitle(conversationId, firstUserText, content, model, onboardingStep).catch(err => {
            logger.error('Failed to generate AI title (background):', err);
          });
        }
        return;
      }

      // Normal path: conversation is in the active workspace
      // Update store
      const newConversations = new Map(conversations);
      newConversations.set(conversationId, updatedConversation);

      // Update nodes
      const updatedNodes = nodes.map(node => {
        if (node.id === conversationId) {
          return {
            ...node,
            data: {
              ...node.data,
              conversation: updatedConversation,
            },
          };
        }
        return node;
      });

      set({
        conversations: newConversations,
        nodes: updatedNodes,
      });

      // Save to storage
      get().saveToStorage();
      
      logger.debug(`Added AI message to conversation ${conversationId}`);

      // Generate AI-powered title asynchronously (doesn't block UI)
      console.log('[Auto-Title] Decision point:', {
        conversationId,
        hasFirstUserMessage,
        shouldGenerateAITitle,
        titleIsManual: conversation.metadata.titleIsManual,
        titleAutoGenerated: conversation.metadata.titleAutoGenerated,
        currentTitle: conversation.metadata.title,
        temporaryTitle,
      });

      if (shouldGenerateAITitle) {
        console.log('[Auto-Title] Triggering AI title generation with:', {
          model,
          userMessageLength: firstUserText.length,
          aiMessageLength: content.length,
          onboardingStep,
        });
        generateAITitle(conversationId, firstUserText, content, model, onboardingStep).catch(err => {
          console.error('[Auto-Title] FAILED:', err);
          logger.error('Failed to generate AI title:', err);
        });
      }
    },

    editMessage: (conversationId: string, messageIndex: number, newContent: string, newAttachments?: import('@/types').MessageAttachment[]) => {
      const { conversations, updateConversation } = get();
      
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found for edit`);
        return;
      }

      // Validate message index
      if (messageIndex < 0 || messageIndex >= conversation.content.length) {
        logger.warn(`Invalid message index ${messageIndex} for conversation ${conversationId}`);
        return;
      }

      const message = conversation.content[messageIndex];

      // Only allow editing user messages
      if (message.role !== 'user') {
        logger.warn(`Cannot edit ${message.role} message`);
        return;
      }

      // Validate new content
      if (!newContent.trim()) {
        logger.warn('Cannot save empty message');
        return;
      }

      // Create updated message with edit metadata
      const updatedMessage: Message = {
        ...message,
        content: newContent.trim(),
        attachments: newAttachments,
        timestamp: new Date(), // Update timestamp to reflect edit time
        metadata: {
          ...message.metadata,
          edited: true,
          editedAt: new Date(),
          // Store original content only on first edit
          originalContent: message.metadata?.edited ? message.metadata.originalContent : message.content,
        },
      };

      // Create updated messages array
      const updatedMessages = [...conversation.content];
      updatedMessages[messageIndex] = updatedMessage;

      // Update conversation
      updateConversation(conversationId, {
        content: updatedMessages,
      });

      logger.debug(`Message ${messageIndex} edited in conversation ${conversationId}`);
    },

    setConversationModel: (conversationId: string, model: string) => {
      const { conversations, nodes } = get();
      const conversation = conversations.get(conversationId);
      
      if (!conversation) {
        logger.warn(`Cannot set model: conversation ${conversationId} not found`);
        return;
      }

      // Store model in conversation
      const updatedConversation: Conversation = {
        ...conversation,
        model: model,
      };

      // Update store
      const newConversations = new Map(conversations);
      newConversations.set(conversationId, updatedConversation);

      // Update nodes
      const updatedNodes = nodes.map(node => {
        if (node.id === conversationId) {
          return {
            ...node,
            data: {
              ...node.data,
              conversation: updatedConversation,
            },
          };
        }
        return node;
      });

      set({
        conversations: newConversations,
        nodes: updatedNodes,
        // Update lastUsedModel to remember this selection
        lastUsedModel: model,
      });

      // Persist to storage
      get().saveToStorage();

      logger.debug(`Set model for conversation ${conversationId}: ${model}`);
    },

    getConversationModel: (conversationId: string) => {
      const { conversations } = get();
      const conversation = conversations.get(conversationId);
      return conversation?.model;
    },

    getConversationMessages: (conversationId: string) => {
      const { conversations } = get();
      const conversation = conversations.get(conversationId);
      
      if (!conversation) {
        return [];
      }

      const result: Array<{ role: 'user' | 'assistant' | 'system'; content: string; attachments?: import('@/types').MessageAttachment[] }> = [];

      // --- Collect inherited context from parent cards ---
      const hasParents = conversation.parentCardIds.length > 0;
      const isMerge = conversation.isMergeNode;

      if (hasParents) {
        // Build structural metadata system message
        const metadata = buildStructuralMetadata(conversation, conversations);
        result.push({ role: 'system', content: metadata });

        // For merge nodes with multiple parents, label messages by source
        // For single-parent branches, use simpler unlabeled approach
        if (isMerge && conversation.parentCardIds.length > 1) {
          // Merge node: label inherited messages by parent source
          let allInheritedMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

          // Pass 1: collect all unique ancestor (grandparent+) messages across all parents.
          // Shared ancestors (e.g. both branches forked from the same root) are deduplicated
          // so we only include them once, under a single shared-context header.
          const seenAncestorContent = new Set<string>();
          const sharedAncestorMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

          for (const parentId of conversation.parentCardIds) {
            const parentConv = conversations.get(parentId);
            if (parentConv && parentConv.parentCardIds.length > 0) {
              const ancestorMsgs = collectInheritedMessages(
                parentConv,
                conversations,
                new Set([conversation.id]),
              );
              for (const msg of ancestorMsgs) {
                const key = `${msg.role}::${msg.content}`;
                if (seenAncestorContent.has(key)) continue;
                seenAncestorContent.add(key);
                sharedAncestorMessages.push(msg);
              }
            }
          }

          if (sharedAncestorMessages.length > 0) {
            allInheritedMessages.push({
              role: 'system',
              content: '--- Shared background context (common ancestors) ---',
            });
            allInheritedMessages.push(...sharedAncestorMessages);
          }

          // Pass 2: each parent's own messages, labeled by source.
          for (const parentId of conversation.parentCardIds) {
            const parentConv = conversations.get(parentId);
            const parentName = parentConv?.metadata.title || 'Unknown';
            const inheritedEntry = conversation.inheritedContext[parentId];

            if (inheritedEntry?.messages?.length) {
              allInheritedMessages.push({
                role: 'system',
                content: `--- Messages from parent: "${parentName}" ---`,
              });

              for (const msg of inheritedEntry.messages) {
                if (!msg.content?.trim()) continue;
                allInheritedMessages.push({ role: msg.role, content: msg.content });
              }
            }
          }

          // Apply token limit
          if (allInheritedMessages.length > 0) {
            const tokenCount = estimateTokens(allInheritedMessages as Message[]);
            if (tokenCount > INHERITED_CONTEXT_CONFIG.MAX_INHERITED_TOKENS) {
              let currentTokens = tokenCount;
              let startIdx = 0;
              while (
                startIdx < allInheritedMessages.length - 2 &&
                currentTokens > INHERITED_CONTEXT_CONFIG.MAX_INHERITED_TOKENS
              ) {
                const msgTokens = Math.ceil(allInheritedMessages[startIdx].content.length / 4);
                currentTokens -= msgTokens;
                startIdx++;
              }
              const truncatedCount = startIdx;
              allInheritedMessages = allInheritedMessages.slice(startIdx);

              // Safety check: if still over limit after preserving last 2, keep only last message
              if (estimateTokens(allInheritedMessages as Message[]) > INHERITED_CONTEXT_CONFIG.MAX_INHERITED_TOKENS) {
                allInheritedMessages = allInheritedMessages.slice(-1);
              }

              result.push({
                role: 'system',
                content: `[Note: ${truncatedCount} older inherited messages were omitted for context length.]`,
              });
            }

            result.push(...allInheritedMessages);
          }

          // Handle merge node synthesis prompt
          if (conversation.mergeMetadata?.synthesisPrompt) {
            result.push({
              role: 'system',
              content: `[Synthesis objective: ${conversation.mergeMetadata.synthesisPrompt}]`,
            });
          }
        } else {
          // Single parent branch: use recursive collection without labels
          const collectedMessages = collectInheritedMessages(
            conversation,
            conversations,
          );

          if (collectedMessages.length > 0) {
            // Apply token limit to inherited messages
            let inheritedMessages = collectedMessages;
            const tokenCount = estimateTokens(inheritedMessages as Message[]);

            if (tokenCount > INHERITED_CONTEXT_CONFIG.MAX_INHERITED_TOKENS) {
              let currentTokens = tokenCount;
              let startIdx = 0;
              while (
                startIdx < inheritedMessages.length - 2 &&
                currentTokens > INHERITED_CONTEXT_CONFIG.MAX_INHERITED_TOKENS
              ) {
                const msgTokens = Math.ceil(inheritedMessages[startIdx].content.length / 4);
                currentTokens -= msgTokens;
                startIdx++;
              }
              const truncatedCount = startIdx;
              inheritedMessages = inheritedMessages.slice(startIdx);

              // Safety check: if still over limit after preserving last 2, keep only last message
              if (estimateTokens(inheritedMessages as Message[]) > INHERITED_CONTEXT_CONFIG.MAX_INHERITED_TOKENS) {
                inheritedMessages = inheritedMessages.slice(-1);
              }

              result.push({
                role: 'system',
                content: `[Note: ${truncatedCount} older inherited messages were omitted for context length. Recent messages preserved below.]`,
              });
            }

            // Add inherited messages
            for (const msg of inheritedMessages) {
              result.push({ role: msg.role, content: msg.content });
            }
          }
        }

        // Separator between inherited and current context
        if (conversation.parentCardIds.length > 0) {
          result.push({
            role: 'system',
            content: '--- Current conversation messages (below) ---',
          });
        }
      }

      // --- Add current conversation's own messages ---
      // Exclusions:
      //   1. UI-only system notices (inherited-context banners) — display artifacts
      //      that must not be sent to the LLM.
      //   2. Empty-content messages — an empty assistant turn causes 500 errors on
      //      providers like Perplexity (can happen when a previous stream failed).
      for (const msg of conversation.content) {
        const isUiNotice =
          msg.role === 'system' &&
          typeof msg.metadata?.custom === 'object' &&
          msg.metadata.custom !== null &&
          'inheritedFrom' in (msg.metadata.custom as Record<string, unknown>);
        if (isUiNotice) continue;

        // Skip messages with no meaningful content
        if (!msg.content?.trim()) continue;

        result.push({
          role: msg.role,
          content: msg.content,
          ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
        });
      }

      return result;
    },

    // =========================================================================
    // Drag State Management
    // =========================================================================

    setIsAnyNodeDragging: (isDragging: boolean) => {
      set({ isAnyNodeDragging: isDragging });
    },

    // =========================================================================
    // Layout Management
    // =========================================================================

    applyLayout: (positions: Map<string, { x: number; y: number }>) => {
      set((state) => {
        const newNodes = state.nodes.map((node) => {
          const newPos = positions.get(node.id);
          if (newPos) {
            return {
              ...node,
              position: newPos,
            };
          }
          return node;
        });

        return { nodes: newNodes };
      });
      
      // Save after layout change
      useCanvasStore.getState().saveToStorage();
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectNodes = (state: WorkspaceState) => state.nodes;
export const selectEdges = (state: WorkspaceState) => state.edges;
export const selectIsInitialized = (state: WorkspaceState) => state.isInitialized;
export const selectExpandedNodeIds = (state: WorkspaceState) => state.expandedNodeIds;
export const selectSelectedNodeIds = (state: WorkspaceState) => state.selectedNodeIds;
export const selectIsAnyNodeDragging = (state: WorkspaceState) => state.isAnyNodeDragging;
export const selectSkipMountAnimation = (state: WorkspaceState) => state._skipMountAnimation;

// Workspace selectors (v4 - flat)
export const selectWorkspaces = (state: WorkspaceState) => state.workspaces;
export const selectActiveWorkspaceId = (state: WorkspaceState) => state.activeWorkspaceId;

// Chat panel selectors
export const selectChatPanelOpen = (state: WorkspaceState) => state.chatPanelOpen;
export const selectActiveConversationId = (state: WorkspaceState) => state.activeConversationId;
export const selectDraftMessages = (state: WorkspaceState) => state.draftMessages;

// Usage panel selector
export const selectUsagePanelOpen = (state: WorkspaceState) => state.usagePanelOpen;

// Legacy alias for compatibility
/** @deprecated Use selectWorkspaces instead */
export const selectCanvases = selectWorkspaces;
/** @deprecated Use selectActiveWorkspaceId instead */
export const selectActiveCanvasId = selectActiveWorkspaceId;