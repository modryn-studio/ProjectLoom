'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';

import { VersionedStorage, STORAGE_KEYS, CURRENT_SCHEMA_VERSION, clearLegacyStorage } from '@/lib/storage';
import { smartTruncate } from '@/utils/formatters';
import { generateMockData } from '@/lib/mock-data';
import { createContextSnapshot, createBranchMetadata, selectContextMessages } from '@/lib/context-utils';
import type { 
  Conversation, 
  Message,
  Position, 
  EdgeConnection, 
  StorageData, 
  ConversationNodeData,
  Workspace,
  WorkspaceMetadata,
  BranchFromMessageData,
  CreateMergeNodeData,
  InheritanceMode,
  ContextSnapshot,
  EdgeRelationType,
  BranchPoint,
  InheritedContextEntry,
  MergeMetadata,
  MERGE_NODE_CONFIG,
} from '@/types';
import { logger } from '@/lib/logger';
import { useToastStore } from '@/stores/toast-store';

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
  // If we can reach sourceId starting from targetId, we'd create a cycle
  const visited = new Set<string>();
  const stack = [targetId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    
    if (current === sourceId) {
      // Found a path from target to source - would create cycle
      return true;
    }
    
    if (visited.has(current)) continue;
    visited.add(current);
    
    // Find all nodes that the current node points to (children)
    const conv = conversations.get(current);
    if (conv) {
      // Check edges where current is the source
      edges.forEach(edge => {
        if (edge.source === current && !visited.has(edge.target)) {
          stack.push(edge.target);
        }
      });
      
      // Also check parentCardIds (for merge node relationships not represented by edges)
      // If current has parents, those parents' children include current
      // So we need to find cards where current is in their parentCardIds
      conversations.forEach((otherConv) => {
        if (otherConv.parentCardIds.includes(current) && !visited.has(otherConv.id)) {
          stack.push(otherConv.id);
        }
      });
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
// TYPES
// =============================================================================

export type ConversationNode = Node<ConversationNodeData>;

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

  // Branch Dialog State (for keyboard workflow)
  branchDialogOpen: boolean;
  branchSourceId: string | null;
  branchMessageIndex: number | null;
  branchSourcePosition: Position | null;
  branchTargetPosition: Position | null;

  // Hierarchical Merge Dialog State
  hierarchicalMergeDialogOpen: boolean;

  // Chat Panel State (session-only)
  chatPanelOpen: boolean;
  activeConversationId: string | null;
  draftMessages: Map<string, string>;

  // History for undo/redo
  history: HistoryState[];
  historyIndex: number;

  // Actions - Node Management
  addConversation: (conversation: Conversation, position?: Position) => void;
  deleteConversation: (id: string) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;

  // Actions - Node State
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  setSelected: (ids: string[]) => void;
  clearSelection: () => void;

  // Actions - History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions - React Flow Handlers
  onNodesChange: (changes: NodeChange<ConversationNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;

  // Actions - Persistence
  initializeFromStorage: () => void;
  saveToStorage: () => void;
  loadMockData: () => void;
  clearAll: () => void;

  // Actions - Workspace Management (flat, no hierarchy)
  createWorkspace: (title: string) => Workspace;
  navigateToWorkspace: (workspaceId: string) => void;
  getCurrentWorkspace: () => Workspace | undefined;
  getWorkspaces: () => Workspace[];
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (workspaceId: string) => void;

  // Actions - Card-Level Branching (v4)
  branchFromMessage: (data: BranchFromMessageData) => Conversation | null;
  createMergeNode: (data: CreateMergeNodeData) => Conversation | null;
  createEdge: (sourceId: string, targetId: string, relationType: EdgeRelationType) => Edge | null;
  canAddMergeParent: (mergeNodeId: string) => boolean;
  getMergeParentCount: (mergeNodeId: string) => number;
  updateInheritedSummary: (conversationId: string, parentId: string, newSummaryText: string) => void;

  // Actions - Branch Dialog (keyboard workflow)
  openBranchDialog: (conversationId: string, messageIndex?: number, targetPosition?: Position) => void;
  closeBranchDialog: () => void;

  // Actions - Hierarchical Merge Dialog
  openHierarchicalMergeDialog: () => void;
  closeHierarchicalMergeDialog: () => void;

  // Actions - Chat Panel
  openChatPanel: (conversationId: string) => void;
  closeChatPanel: () => void;
  setDraftMessage: (conversationId: string, content: string) => void;
  getDraftMessage: (conversationId: string) => string;
  sendMessage: (content: string, attachments?: import('@/types').MessageAttachment[]) => Promise<void>;

  // Actions - AI Integration (Phase 2)
  addAIMessage: (conversationId: string, content: string, model: string) => void;
  setConversationModel: (conversationId: string, model: string) => void;
  getConversationModel: (conversationId: string) => string | undefined;
  getConversationMessages: (conversationId: string) => Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;

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
    metadata: {
      title: 'Main Workspace',
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
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
    animated: connection.animated ?? (relationType === 'reference'),
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
    
    // Branch Dialog State (keyboard workflow)
    branchDialogOpen: false,
    branchSourceId: null,
    branchMessageIndex: null,
    branchSourcePosition: null,
    branchTargetPosition: null,
    
    // Hierarchical Merge Dialog State
    hierarchicalMergeDialogOpen: false,
    
    // Chat Panel State (session-only)
    chatPanelOpen: false,
    activeConversationId: null,
    draftMessages: new Map(),
    
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

    undo: () => {
      const { historyIndex, history } = get();
      
      if (historyIndex <= 0) return; // Nothing to undo

      const previousState = history[historyIndex - 1];
      
      set({
        nodes: previousState.nodes,
        edges: previousState.edges,
        conversations: new Map(previousState.conversations),
        historyIndex: historyIndex - 1,
      });

      get().saveToStorage();
    },

    redo: () => {
      const { historyIndex, history } = get();
      
      if (historyIndex >= history.length - 1) return; // Nothing to redo

      const nextState = history[historyIndex + 1];
      
      set({
        nodes: nextState.nodes,
        edges: nextState.edges,
        conversations: new Map(nextState.conversations),
        historyIndex: historyIndex + 1,
      });

      get().saveToStorage();
    },

    // =========================================================================
    // Node Management
    // =========================================================================

    addConversation: (conversation, position) => {
      const { nodes, edges, conversations, expandedNodeIds, selectedNodeIds } = get();

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
      const { nodes, edges, conversations, expandedNodeIds, selectedNodeIds, history, historyIndex } = get();

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
            
            // Apply position change
            if (newPosition !== undefined) {
              return {
                ...node,
                position: newPosition,
              };
            }
            
            // Apply selection change
            if (newSelected !== undefined) {
              if (newSelected) {
                newSelectedIds.add(node.id);
              } else {
                newSelectedIds.delete(node.id);
              }
              return {
                ...node,
                selected: newSelected,
                data: {
                  ...node.data,
                  isSelected: newSelected,
                },
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
      }
    },

    onEdgesChange: (changes) => {
      set((state) => {
        // Handle remove changes
        const removeIds = changes
          .filter((c) => c.type === 'remove')
          .map((c) => c.id);

        if (removeIds.length > 0) {
          return {
            edges: state.edges.filter((e) => !removeIds.includes(e.id)),
          };
        }

        return state;
      });

      get().saveToStorage();
    },

    onConnect: (connection) => {
      if (!connection.source || !connection.target) return;

      const newEdge: Edge = {
        id: `edge-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        type: 'bezier',
        style: {
          stroke: 'var(--accent-primary)',
          strokeWidth: 2,
        },
      };

      set((state) => ({
        edges: [...state.edges, newEdge],
      }));

      get().saveToStorage();
    },

    // =========================================================================
    // Persistence (v4 - flat workspaces)
    // =========================================================================

    initializeFromStorage: () => {
      // Clear legacy v3 storage keys on startup
      clearLegacyStorage();
      
      const result = storage.load();
      const workspaceResult = workspaceStorage.load();

      // Check if we have any actual conversation data
      const hasStoredConversations = result.success && 
                                     result.data.conversations && 
                                     result.data.conversations.length > 0;
      
      const hasWorkspaces = workspaceResult.success && 
                           workspaceResult.data.workspaces && 
                           workspaceResult.data.workspaces.length > 0;
      
      // Load mock data if there are no conversations in storage
      // (even if a workspace structure exists)
      if (!hasStoredConversations) {
        logger.debug('Loading mock data (no stored conversations found)');
        get().loadMockData();
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
        workspaces = workspaceResult.data.workspaces;
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
        const { nodes, edges, conversations, workspaces, activeWorkspaceId } = get();

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

        const data: StorageData = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          conversations: Array.from(conversations.values()),
          positions,
          connections,
          settings: {
            theme: 'dark',
            showMinimap: true,
            snapToGrid: false,
          },
        };

        storage.save(data);
        
        // Save workspaces (v4 - flat, no hierarchy)
        if (workspaces.length > 0) {
          const updatedWorkspaces = workspaces.map(w => {
            if (w.id === activeWorkspaceId) {
              return {
                ...w,
                conversations: Array.from(conversations.values()),
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

    clearAll: () => {
      storage.clear();

      set({
        nodes: [],
        edges: [],
        conversations: new Map(),
        workspaces: [],
        activeWorkspaceId: '',
        expandedNodeIds: new Set(),
        selectedNodeIds: new Set(),
        isInitialized: false,
        branchDialogOpen: false,
        branchSourceId: null,
        branchMessageIndex: null,
        branchSourcePosition: null,
        branchTargetPosition: null,
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
      const workspace = get().workspaces.find(w => w.id === workspaceId);
      if (!workspace) {
        logger.warn(`Workspace ${workspaceId} not found`);
        return;
      }

      // Load conversations for this workspace
      const conversations = new Map<string, Conversation>();
      workspace.conversations.forEach((conv) => {
        conversations.set(conv.id, conv);
      });

      // Create nodes from conversations
      const nodes: ConversationNode[] = workspace.conversations.map((conv) => {
        return conversationToNode(conv, conv.position, false, false);
      });

      // Restore edges (v4 with relation types)
      const edges: Edge[] = (workspace.edges || []).map(connectionToEdge);

      set({
        activeWorkspaceId: workspaceId,
        nodes,
        edges,
        conversations,
        expandedNodeIds: new Set(),
        selectedNodeIds: new Set(),
        history: [{
          nodes: [...nodes],
          edges: [...edges],
          conversations: new Map(conversations),
        }],
        historyIndex: 0,
      });
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
      
      // Don't delete the last workspace
      if (workspaces.length <= 1) {
        logger.warn('Cannot delete the last workspace');
        return;
      }

      set((state) => ({
        workspaces: state.workspaces.filter(w => w.id !== workspaceId),
      }));

      // If we deleted the active workspace, navigate to first remaining
      if (workspaceId === activeWorkspaceId) {
        const remaining = get().workspaces[0];
        if (remaining) {
          get().navigateToWorkspace(remaining.id);
        }
      }

      get().saveToStorage();
    },

    // =========================================================================
    // Card-Level Branching (v4)
    // =========================================================================

    branchFromMessage: (data: BranchFromMessageData) => {
      const { sourceCardId, messageIndex, inheritanceMode = 'full', branchReason, summaryText } = data;
      const { conversations, nodes, activeWorkspaceId, branchTargetPosition } = get();
      
      const sourceConversation = conversations.get(sourceCardId);
      if (!sourceConversation || !Array.isArray(sourceConversation.content)) {
        logger.error(`Invalid source conversation ${sourceCardId}`);
        return null;
      }

      const sourceNode = nodes.find(n => n.id === sourceCardId);
      if (!sourceNode) {
        logger.error(`Source node not found: ${sourceCardId}`);
        return null;
      }

      // Calculate position for new branch
      // Use branchTargetPosition if set (from drag-to-create), otherwise calculate offset
      const newPosition: Position = branchTargetPosition ?? {
        x: sourceNode.position.x + 300,
        y: sourceNode.position.y + 150,
      };

      // Build inherited context based on mode
      const messagesUpToIndex = sourceConversation.content.slice(0, messageIndex + 1);
      let inheritedMessages: Message[];

      if (inheritanceMode === 'summary' && summaryText) {
        // AI-generated summary: store as a single system message
        inheritedMessages = [{
          id: nanoid(),
          role: 'system' as const,
          content: `Summary of previous conversation (${messagesUpToIndex.length} messages):\n\n${summaryText}`,
          timestamp: new Date(),
          metadata: {
            custom: { isSummary: true, originalMessageCount: messagesUpToIndex.length },
          },
        }];
      } else {
        // Full context: pass all messages up to branch point
        inheritedMessages = messagesUpToIndex;
      }

      // Create branch point info
      const branchPoint: BranchPoint = {
        parentCardId: sourceCardId,
        messageIndex,
      };

      // Create inherited context entry
      const now = new Date();
      const inheritedContext: Record<string, InheritedContextEntry> = {
        [sourceCardId]: {
          mode: inheritanceMode,
          messages: inheritedMessages,
          timestamp: now,
          totalParentMessages: sourceConversation.content.length,
        },
      };

      // Create the new branched conversation
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
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
          tags: [],
          isExpanded: false,
        },
      };

      // Add conversation to store
      get().addConversation(newConversation, newPosition);

      // Create branch edge
      get().createEdge(sourceCardId, newConversation.id, 'branch');

      // Close dialog if open
      get().closeBranchDialog();

      return newConversation;
    },

    updateInheritedSummary: (conversationId: string, parentId: string, newSummaryText: string) => {
      const { conversations } = get();
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        logger.error(`Conversation not found for summary update: ${conversationId}`);
        return;
      }

      const entry = conversation.inheritedContext[parentId];
      if (!entry) {
        logger.error(`No inherited context from parent ${parentId} in conversation ${conversationId}`);
        return;
      }

      // Replace summary message(s) with new summary
      const updatedMessages: Message[] = [{
        id: nanoid(),
        role: 'system' as const,
        content: `Summary of previous conversation (${entry.totalParentMessages} messages):\n\n${newSummaryText}`,
        timestamp: new Date(),
        metadata: {
          custom: { isSummary: true, originalMessageCount: entry.totalParentMessages },
        },
      }];

      const updatedConversation: Conversation = {
        ...conversation,
        inheritedContext: {
          ...conversation.inheritedContext,
          [parentId]: {
            ...entry,
            messages: updatedMessages,
            timestamp: new Date(),
          },
        },
        metadata: {
          ...conversation.metadata,
          updatedAt: new Date(),
        },
      };

      const newConversations = new Map(conversations);
      newConversations.set(conversationId, updatedConversation);
      set({ conversations: newConversations });
      get().saveToStorage();
    },

    createMergeNode: (data: CreateMergeNodeData) => {
      const { sourceCardIds, position, synthesisPrompt, inheritanceModes = {}, summaryTexts = {} } = data;
      const { conversations, activeWorkspaceId } = get();
      const toast = useToastStore.getState();
      
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

      // Build inherited context from all parents
      const now = new Date();
      const inheritedContext: Record<string, InheritedContextEntry> = {};
      sourceCardIds.forEach(cardId => {
        const conv = conversations.get(cardId);
        if (conv && Array.isArray(conv.content)) {
          const mode = inheritanceModes[cardId] || 'full';
          if (mode === 'summary' && summaryTexts[cardId]) {
            // Use pre-generated summary
            const summaryMessage: Message = {
              id: nanoid(),
              role: 'system',
              content: summaryTexts[cardId],
              timestamp: now,
              metadata: { custom: { isSummary: true, originalMessageCount: conv.content.length } },
            };
            inheritedContext[cardId] = {
              mode: 'summary',
              messages: [summaryMessage],
              timestamp: now,
              totalParentMessages: conv.content.length,
            };
          } else {
            // If user requested summary but text is missing, warn and fall back to full
            if (mode === 'summary' && !summaryTexts[cardId]) {
              logger.warn(`Summary text missing for card ${cardId} in merge node creation, falling back to full context`);
            }
            inheritedContext[cardId] = {
              mode: 'full',
              messages: conv.content,
              timestamp: now,
              totalParentMessages: conv.content.length,
            };
          }
        }
      });

      // Create merge metadata
      const mergeMetadata: MergeMetadata = {
        sourceCardIds,
        synthesisPrompt,
        createdAt: now,
      };

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
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
          tags: ['merge'],
          isExpanded: false,
        },
      };

      // Add conversation to store
      get().addConversation(mergeNode, position);

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
        const newEdges: Edge[] = validSourceIds.map((sourceId, index) => ({
          id: `edge-merge-${sourceId}-${mergeNode.id}`,
          source: sourceId,
          target: mergeNode.id,
          type: 'bezier',
          animated: false,
          style: {
            stroke: '#10b981',
            strokeWidth: 2,
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
        animated: relationType === 'reference',
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
    // Branch Dialog (keyboard workflow)
    // =========================================================================

    openBranchDialog: (conversationId: string, messageIndex?: number, targetPosition?: Position) => {
      const conversation = get().conversations.get(conversationId);
      const node = get().nodes.find(n => n.id === conversationId);
      
      if (!conversation || !node) {
        logger.warn(`Conversation ${conversationId} not found`);
        return;
      }

      set({
        branchDialogOpen: true,
        branchSourceId: conversationId,
        branchMessageIndex: messageIndex ?? (Array.isArray(conversation.content) ? conversation.content.length - 1 : 0),
        branchSourcePosition: node.position,
        branchTargetPosition: targetPosition ?? null,
      });
    },

    closeBranchDialog: () => {
      set({
        branchDialogOpen: false,
        branchSourceId: null,
        branchMessageIndex: null,
        branchSourcePosition: null,
        branchTargetPosition: null,
      });
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
      const { activeConversationId, draftMessages } = get();
      const conversation = get().conversations.get(conversationId);
      
      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found`);
        return;
      }

      // Auto-save current draft before switching (if we have one)
      // Draft is managed in MessageInput component state, but we store it here when switching
      
      set({
        chatPanelOpen: true,
        activeConversationId: conversationId,
        selectedNodeIds: new Set([conversationId]),
      });
      
      logger.debug(`Opened chat panel for conversation ${conversationId}`);
    },

    closeChatPanel: () => {
      set((state) => ({
        chatPanelOpen: false,
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

    setDraftMessage: (conversationId: string, content: string) => {
      const { draftMessages } = get();
      const newDrafts = new Map(draftMessages);
      
      if (content.trim()) {
        newDrafts.set(conversationId, content);
      } else {
        newDrafts.delete(conversationId);
      }
      
      set({ draftMessages: newDrafts });
    },

    getDraftMessage: (conversationId: string) => {
      return get().draftMessages.get(conversationId) || '';
    },

    sendMessage: async (content: string, attachments?: import('@/types').MessageAttachment[]) => {
      const { activeConversationId, conversations, draftMessages } = get();
      
      if (!activeConversationId || !content.trim()) {
        return;
      }

      const conversation = conversations.get(activeConversationId);
      if (!conversation) {
        logger.warn(`Active conversation ${activeConversationId} not found`);
        return;
      }

      // Create new user message
      const newMessage: Message = {
        id: nanoid(),
        role: 'user' as const,
        content: content.trim(),
        timestamp: new Date(),
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      };

      // Update conversation with new message
      const updatedConversation = {
        ...conversation,
        content: [...conversation.content, newMessage],
        metadata: {
          ...conversation.metadata,
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

    addAIMessage: (conversationId: string, content: string, model: string) => {
      const { conversations, nodes } = get();
      const conversation = conversations.get(conversationId);
      
      if (!conversation) {
        logger.warn(`Cannot add AI message: conversation ${conversationId} not found`);
        return;
      }

      // Create new AI message
      const aiMessage = {
        id: nanoid(),
        role: 'assistant' as const,
        content: content,
        timestamp: new Date(),
        metadata: {
          model,
        },
      };

      // Update conversation
      const updatedConversation = {
        ...conversation,
        content: [...conversation.content, aiMessage],
        metadata: {
          ...conversation.metadata,
          updatedAt: new Date(),
          messageCount: conversation.content.length + 1,
        },
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
      });

      // Save to storage
      get().saveToStorage();
      
      logger.debug(`Added AI message to conversation ${conversationId}`);
    },

    setConversationModel: (conversationId: string, model: string) => {
      const { conversations, nodes } = get();
      const conversation = conversations.get(conversationId);
      
      if (!conversation) {
        logger.warn(`Cannot set model: conversation ${conversationId} not found`);
        return;
      }

      // Store model in conversation metadata
      const updatedConversation = {
        ...conversation,
        metadata: {
          ...conversation.metadata,
          // Using custom metadata for model storage
        },
        // Store model at conversation level for easy access
        model: model,
      } as Conversation & { model?: string };

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

      logger.debug(`Set model for conversation ${conversationId}: ${model}`);
    },

    getConversationModel: (conversationId: string) => {
      const { conversations } = get();
      const conversation = conversations.get(conversationId) as (Conversation & { model?: string }) | undefined;
      return conversation?.model;
    },

    getConversationMessages: (conversationId: string) => {
      const { conversations } = get();
      const conversation = conversations.get(conversationId);
      
      if (!conversation) {
        return [];
      }

      // Convert messages to format expected by useChat
      return conversation.content.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
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

// Workspace selectors (v4 - flat)
export const selectWorkspaces = (state: WorkspaceState) => state.workspaces;
export const selectActiveWorkspaceId = (state: WorkspaceState) => state.activeWorkspaceId;

// Branch dialog selectors
export const selectBranchDialogOpen = (state: WorkspaceState) => state.branchDialogOpen;
export const selectBranchSourceId = (state: WorkspaceState) => state.branchSourceId;
export const selectBranchMessageIndex = (state: WorkspaceState) => state.branchMessageIndex;
export const selectBranchSourcePosition = (state: WorkspaceState) => state.branchSourcePosition;

// Chat panel selectors
export const selectChatPanelOpen = (state: WorkspaceState) => state.chatPanelOpen;
export const selectActiveConversationId = (state: WorkspaceState) => state.activeConversationId;
export const selectDraftMessages = (state: WorkspaceState) => state.draftMessages;

// Legacy alias for compatibility
/** @deprecated Use selectWorkspaces instead */
export const selectCanvases = selectWorkspaces;
/** @deprecated Use selectActiveWorkspaceId instead */
export const selectActiveCanvasId = selectActiveWorkspaceId;