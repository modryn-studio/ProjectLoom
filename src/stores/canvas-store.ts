'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';

import { VersionedStorage, STORAGE_KEYS, CURRENT_SCHEMA_VERSION } from '@/lib/storage';
import { generateMockData } from '@/lib/mock-data';
import { createContextSnapshot, createBranchMetadata, selectContextMessages } from '@/lib/context-utils';
import type { 
  Conversation, 
  Position, 
  EdgeConnection, 
  StorageData, 
  ConversationNodeData,
  Canvas,
  CanvasMetadata,
  BranchData,
  InheritanceMode,
  ContextSnapshot,
} from '@/types';

// Debounce helper for performance
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = 300;

// =============================================================================
// TYPES
// =============================================================================

export type ConversationNode = Node<ConversationNodeData>;

interface HistoryState {
  nodes: ConversationNode[];
  edges: Edge[];
  conversations: Map<string, Conversation>;
}

interface CanvasState {
  // Data
  nodes: ConversationNode[];
  edges: Edge[];
  conversations: Map<string, Conversation>;

  // Multi-Canvas (Phase 2)
  canvases: Canvas[];
  activeCanvasId: string;

  // UI State
  expandedNodeIds: Set<string>;
  selectedNodeIds: Set<string>;
  isInitialized: boolean;

  // Branch Dialog State
  branchDialogOpen: boolean;
  branchSourceId: string | null;
  branchSourcePosition: Position | null;

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

  // Actions - Multi-Canvas (Phase 2)
  createCanvas: (title: string, parentCanvasId?: string | null) => Canvas;
  navigateToCanvas: (canvasId: string) => void;
  getCurrentCanvas: () => Canvas | undefined;
  getCanvasLineage: (canvasId: string) => Canvas[];
  getChildCanvases: (canvasId: string) => Canvas[];
  getRootCanvases: () => Canvas[];
  updateCanvas: (canvasId: string, updates: Partial<Canvas>) => void;
  deleteCanvas: (canvasId: string) => void;

  // Actions - Branching (Phase 2)
  openBranchDialog: (conversationId: string) => void;
  closeBranchDialog: () => void;
  createBranch: (data: BranchData) => Canvas | null;
}

// =============================================================================
// DEFAULT DATA
// =============================================================================

const defaultStorageData: StorageData = {
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
 * Create a default root canvas
 */
function createDefaultCanvas(): Canvas {
  const now = new Date();
  return {
    id: nanoid(),
    parentCanvasId: null,
    contextSnapshot: null,
    conversations: [],
    branches: [],
    tags: [],
    createdFromConversationId: null,
    metadata: {
      title: 'Main Canvas',
      createdAt: now,
      updatedAt: now,
      version: CURRENT_SCHEMA_VERSION,
    },
  };
}

// =============================================================================
// STORAGE INSTANCE
// =============================================================================

const storage = new VersionedStorage<StorageData>({
  key: STORAGE_KEYS.CANVAS_DATA,
  version: CURRENT_SCHEMA_VERSION,
  defaultData: defaultStorageData,
  debug: process.env.NODE_ENV === 'development',
});

// Separate storage for multi-canvas data (Phase 2)
const canvasStorage = new VersionedStorage<{ canvases: Canvas[]; activeCanvasId: string }>({
  key: STORAGE_KEYS.CANVASES,
  version: CURRENT_SCHEMA_VERSION,
  defaultData: { canvases: [], activeCanvasId: '' },
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
 * Convert edge connection to React Flow edge
 */
function connectionToEdge(connection: EdgeConnection): Edge {
  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    type: 'smoothstep',
    animated: connection.animated ?? false,
    style: {
      stroke: '#6366f1',
      strokeWidth: 2,
    },
  };
}

// =============================================================================
// STORE
// =============================================================================

export const useCanvasStore = create<CanvasState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    nodes: [],
    edges: [],
    conversations: new Map(),
    
    // Multi-Canvas (Phase 2)
    canvases: [],
    activeCanvasId: '',
    
    expandedNodeIds: new Set(),
    selectedNodeIds: new Set(),
    isInitialized: false,
    
    // Branch Dialog State
    branchDialogOpen: false,
    branchSourceId: null,
    branchSourcePosition: null,
    
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

      // Limit history to last 50 states
      if (newHistory.length > 50) {
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
      set((state) => ({
        expandedNodeIds: newExpanded,
        nodes: state.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isExpanded: newExpanded.has(node.id),
          },
        })),
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

      set((state) => ({
        expandedNodeIds: newExpanded,
        nodes: state.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isExpanded: newExpanded.has(node.id),
          },
        })),
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
        // Track selection changes to update selectedNodeIds
        const newSelectedIds = new Set(state.selectedNodeIds);
        
        // Handle position and selection changes
        const newNodes = state.nodes.map((node) => {
          const change = changes.find((c) => c.type === 'position' && c.id === node.id);
          if (change && change.type === 'position' && change.position) {
            return {
              ...node,
              position: change.position,
            };
          }

          const selectChange = changes.find((c) => c.type === 'select' && c.id === node.id);
          if (selectChange && selectChange.type === 'select') {
            // Update the selectedNodeIds Set
            if (selectChange.selected) {
              newSelectedIds.add(node.id);
            } else {
              newSelectedIds.delete(node.id);
            }
            return {
              ...node,
              selected: selectChange.selected,
              data: {
                ...node.data,
                isSelected: selectChange.selected,
              },
            };
          }

          return node;
        });

        // Handle remove changes
        const removeIds = changes
          .filter((c) => c.type === 'remove')
          .map((c) => c.id);

        const filteredNodes = removeIds.length > 0
          ? newNodes.filter((n) => !removeIds.includes(n.id))
          : newNodes;
        
        // Also remove deleted nodes from selectedNodeIds
        removeIds.forEach(id => newSelectedIds.delete(id));

        return { nodes: filteredNodes, selectedNodeIds: newSelectedIds };
      });

      // Debounced save after position changes
      const positionChanges = changes.filter((c) => c.type === 'position' && c.dragging === false);
      if (positionChanges.length > 0) {
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
        type: 'smoothstep',
        style: {
          stroke: '#6366f1',
          strokeWidth: 2,
        },
      };

      set((state) => ({
        edges: [...state.edges, newEdge],
      }));

      get().saveToStorage();
    },

    // =========================================================================
    // Persistence
    // =========================================================================

    initializeFromStorage: () => {
      const result = storage.load();
      const canvasResult = canvasStorage.load();

      if (!result.success || result.data.conversations.length === 0) {
        // No stored data or empty, load mock data for demo
        get().loadMockData();
        return;
      }

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

      // Create edges
      const edges: Edge[] = storedData.connections.map(connectionToEdge);

      // Load canvases if available (Phase 2)
      let canvases: Canvas[] = [];
      let activeCanvasId = '';
      
      if (canvasResult.success && canvasResult.data.canvases.length > 0) {
        canvases = canvasResult.data.canvases;
        activeCanvasId = canvasResult.data.activeCanvasId || canvases[0]?.id || '';
      }

      set({
        nodes,
        edges,
        conversations,
        canvases,
        activeCanvasId,
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
        const { nodes, edges, conversations, canvases, activeCanvasId } = get();

        // Build positions map
        const positions: Record<string, Position> = {};
        nodes.forEach((node) => {
          positions[node.id] = {
            x: node.position.x,
            y: node.position.y,
          };
        });

        // Build connections array
        const connections: EdgeConnection[] = edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep' as const,
          animated: false,
        }));

        const data: StorageData = {
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
        
        // Also save canvases separately (Phase 2)
        if (canvases.length > 0) {
          canvasStorage.save({ canvases, activeCanvasId });
        }
      }, SAVE_DEBOUNCE_MS);
    },

    loadMockData: () => {
      const mockData = generateMockData();
      const { conversations: mockConversations, edges: mockEdges } = mockData;

      // Create conversations map
      const conversations = new Map<string, Conversation>();
      mockConversations.forEach((conv: Conversation) => {
        conversations.set(conv.id, conv);
      });

      // Create nodes using conversation positions
      const nodes: ConversationNode[] = mockConversations.map((conv: Conversation) => {
        return conversationToNode(conv, conv.position, false, false);
      });

      // Create edges
      const edges: Edge[] = mockEdges.map(connectionToEdge);

      set({
        nodes,
        edges,
        conversations,
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
        canvases: [],
        activeCanvasId: '',
        expandedNodeIds: new Set(),
        selectedNodeIds: new Set(),
        isInitialized: false,
        branchDialogOpen: false,
        branchSourceId: null,
        branchSourcePosition: null,
      });
    },

    // =========================================================================
    // Multi-Canvas Management (Phase 2)
    // =========================================================================

    createCanvas: (title: string, parentCanvasId: string | null = null) => {
      const now = new Date();
      const newCanvas: Canvas = {
        id: nanoid(),
        parentCanvasId,
        contextSnapshot: null,
        conversations: [],
        branches: [],
        tags: [],
        createdFromConversationId: null,
        metadata: {
          title,
          createdAt: now,
          updatedAt: now,
          version: CURRENT_SCHEMA_VERSION,
        },
      };

      set((state) => {
        const newCanvases = [...state.canvases, newCanvas];
        
        // If this is a child canvas, update parent's branches array
        if (parentCanvasId) {
          const parentIndex = newCanvases.findIndex(c => c.id === parentCanvasId);
          if (parentIndex !== -1) {
            newCanvases[parentIndex] = {
              ...newCanvases[parentIndex],
              branches: [...newCanvases[parentIndex].branches, newCanvas.id],
            };
          }
        }
        
        return { canvases: newCanvases };
      });

      get().saveToStorage();
      return newCanvas;
    },

    navigateToCanvas: (canvasId: string) => {
      const canvas = get().canvases.find(c => c.id === canvasId);
      if (!canvas) {
        console.warn(`Canvas ${canvasId} not found`);
        return;
      }

      // Load conversations for this canvas
      const conversations = new Map<string, Conversation>();
      canvas.conversations.forEach((conv) => {
        conversations.set(conv.id, conv);
      });

      // Create nodes from conversations
      const nodes: ConversationNode[] = canvas.conversations.map((conv) => {
        return conversationToNode(conv, conv.position, false, false);
      });

      // Create edges (for now, empty - will be restored from storage in future)
      const edges: Edge[] = [];

      set({
        activeCanvasId: canvasId,
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

    getCurrentCanvas: () => {
      const { canvases, activeCanvasId } = get();
      return canvases.find(c => c.id === activeCanvasId);
    },

    getCanvasLineage: (canvasId: string) => {
      const { canvases } = get();
      const lineage: Canvas[] = [];
      
      let currentId: string | null = canvasId;
      while (currentId) {
        const canvas = canvases.find(c => c.id === currentId);
        if (!canvas) break;
        lineage.unshift(canvas); // Add to beginning for parent → child order
        currentId = canvas.parentCanvasId;
      }
      
      return lineage;
    },

    getChildCanvases: (canvasId: string) => {
      const { canvases } = get();
      return canvases.filter(c => c.parentCanvasId === canvasId);
    },

    getRootCanvases: () => {
      const { canvases } = get();
      return canvases.filter(c => c.parentCanvasId === null);
    },

    updateCanvas: (canvasId: string, updates: Partial<Canvas>) => {
      set((state) => ({
        canvases: state.canvases.map(c => 
          c.id === canvasId 
            ? { ...c, ...updates, metadata: { ...c.metadata, updatedAt: new Date() } }
            : c
        ),
      }));
      get().saveToStorage();
    },

    deleteCanvas: (canvasId: string) => {
      const { canvases, activeCanvasId, getChildCanvases } = get();
      
      // Don't delete if it has children
      const children = getChildCanvases(canvasId);
      if (children.length > 0) {
        console.warn('Cannot delete canvas with children');
        return;
      }

      // Remove from parent's branches array
      const canvas = canvases.find(c => c.id === canvasId);
      if (canvas?.parentCanvasId) {
        const parent = canvases.find(c => c.id === canvas.parentCanvasId);
        if (parent) {
          set((state) => ({
            canvases: state.canvases.map(c =>
              c.id === canvas.parentCanvasId
                ? { ...c, branches: c.branches.filter(id => id !== canvasId) }
                : c
            ),
          }));
        }
      }

      // Remove the canvas
      set((state) => ({
        canvases: state.canvases.filter(c => c.id !== canvasId),
      }));

      // If we deleted the active canvas, navigate to parent or first root
      if (activeCanvasId === canvasId) {
        const parent = canvas?.parentCanvasId;
        const firstRoot = get().getRootCanvases()[0];
        if (parent) {
          get().navigateToCanvas(parent);
        } else if (firstRoot) {
          get().navigateToCanvas(firstRoot.id);
        }
      }

      get().saveToStorage();
    },

    // =========================================================================
    // Branching (Phase 2)
    // =========================================================================

    openBranchDialog: (conversationId: string) => {
      const conversation = get().conversations.get(conversationId);
      const node = get().nodes.find(n => n.id === conversationId);
      
      if (!conversation || !node) {
        console.warn(`Conversation ${conversationId} not found`);
        return;
      }

      set({
        branchDialogOpen: true,
        branchSourceId: conversationId,
        branchSourcePosition: node.position,
      });
    },

    closeBranchDialog: () => {
      set({
        branchDialogOpen: false,
        branchSourceId: null,
        branchSourcePosition: null,
      });
    },

    createBranch: (data: BranchData) => {
      const { sourceConversationId, branchReason, inheritanceMode, customMessageIds } = data;
      const { conversations, activeCanvasId, canvases } = get();
      
      const sourceConversation = conversations.get(sourceConversationId);
      if (!sourceConversation) {
        console.error(`Source conversation ${sourceConversationId} not found`);
        return null;
      }

      const parentCanvas = canvases.find(c => c.id === activeCanvasId);
      if (!parentCanvas) {
        console.error(`Active canvas ${activeCanvasId} not found`);
        return null;
      }

      // Create context snapshot based on inheritance mode
      const contextSnapshot = createContextSnapshot(
        sourceConversation.content,
        inheritanceMode,
        branchReason,
        sourceConversationId,
        activeCanvasId,
        customMessageIds
      );

      // Create new canvas
      const now = new Date();
      const newCanvas: Canvas = {
        id: nanoid(),
        parentCanvasId: activeCanvasId,
        contextSnapshot,
        conversations: [],
        branches: [],
        tags: [],
        createdFromConversationId: sourceConversationId,
        metadata: {
          title: `Branch: ${branchReason.slice(0, 30)}${branchReason.length > 30 ? '...' : ''}`,
          createdAt: now,
          updatedAt: now,
          version: CURRENT_SCHEMA_VERSION,
        },
      };

      // Update parent canvas to include this branch
      set((state) => ({
        canvases: [
          ...state.canvases.map(c => 
            c.id === activeCanvasId 
              ? { ...c, branches: [...c.branches, newCanvas.id] }
              : c
          ),
          newCanvas,
        ],
        branchDialogOpen: false,
        branchSourceId: null,
        branchSourcePosition: null,
      }));

      get().saveToStorage();

      // Navigate to the new canvas
      get().navigateToCanvas(newCanvas.id);

      return newCanvas;
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectNodes = (state: CanvasState) => state.nodes;
export const selectEdges = (state: CanvasState) => state.edges;
export const selectIsInitialized = (state: CanvasState) => state.isInitialized;
export const selectExpandedNodeIds = (state: CanvasState) => state.expandedNodeIds;
export const selectSelectedNodeIds = (state: CanvasState) => state.selectedNodeIds;

// Multi-Canvas selectors (Phase 2)
export const selectCanvases = (state: CanvasState) => state.canvases;
export const selectActiveCanvasId = (state: CanvasState) => state.activeCanvasId;
export const selectBranchDialogOpen = (state: CanvasState) => state.branchDialogOpen;
export const selectBranchSourceId = (state: CanvasState) => state.branchSourceId;
export const selectBranchSourcePosition = (state: CanvasState) => state.branchSourcePosition;

