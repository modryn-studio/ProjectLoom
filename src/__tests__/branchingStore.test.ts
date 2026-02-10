/**
 * Integration tests for card branching, merges, and undo/redo invariants.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Node, Edge } from '@xyflow/react';

import { useCanvasStore } from '../stores/canvas-store';
import type {
  Conversation,
  ConversationNodeData,
  InheritedContextEntry,
  Message,
  Workspace,
} from '../types';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

const makeMessage = (content: string, role: Message['role'] = 'user'): Message => ({
  id: `msg-${Math.random().toString(36).slice(2)}`,
  role,
  content,
  timestamp: new Date(),
});

const makeConversation = (overrides: Partial<Conversation>): Conversation => {
  const now = new Date();
  return {
    id: overrides.id || `conv-${Math.random().toString(36).slice(2)}`,
    canvasId: overrides.canvasId || 'ws-1',
    position: overrides.position || { x: 0, y: 0 },
    content: overrides.content || [],
    connections: overrides.connections || [],
    parentCardIds: overrides.parentCardIds || [],
    branchPoint: overrides.branchPoint,
    inheritedContext: overrides.inheritedContext || {},
    isMergeNode: overrides.isMergeNode ?? false,
    mergeMetadata: overrides.mergeMetadata,
    metadata: overrides.metadata || {
      title: 'Test Card',
      createdAt: now,
      updatedAt: now,
      messageCount: overrides.content?.length || 0,
      tags: [],
      isExpanded: false,
    },
  };
};

const makeNode = (conversation: Conversation): Node<ConversationNodeData> => ({
  id: conversation.id,
  type: 'conversation',
  position: conversation.position,
  data: {
    conversation,
    isExpanded: false,
    isSelected: false,
  },
});

const makeWorkspace = (conversations: Conversation[], edges: Edge[]): Workspace => {
  const now = new Date();
  return {
    id: 'ws-1',
    title: 'Test Workspace',
    conversations,
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      curveType: (edge.type as 'bezier' | 'smoothstep' | 'straight') || 'smoothstep',
      relationType: (edge.data?.relationType as 'branch' | 'merge' | 'reference') || 'branch',
      animated: edge.animated ?? false,
    })),
    tags: [],
    context: {
      instructions: '',
      knowledgeBaseFiles: [],
      updatedAt: now,
    },
    metadata: {
      title: 'Test Workspace',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 4,
    },
  };
};

const seedStore = (conversations: Conversation[]) => {
  const nodes = conversations.map(makeNode);
  const edges: Edge[] = [];
  const workspace = makeWorkspace(conversations, edges);
  const base = useCanvasStore.getState();
  const conversationMap = new Map(conversations.map((conv) => [conv.id, conv]));

  useCanvasStore.setState({
    ...base,
    nodes,
    edges,
    conversations: conversationMap,
    workspaces: [workspace],
    activeWorkspaceId: workspace.id,
    expandedNodeIds: new Set(),
    selectedNodeIds: new Set(),
    chatPanelOpen: false,
    activeConversationId: null,
    draftMessages: new Map(),
    usagePanelOpen: false,
    history: [{
      nodes: [...nodes],
      edges: [...edges],
      conversations: new Map(conversationMap),
    }],
    historyIndex: 0,
  }, true);
};

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: localStorageMock });
  localStorageMock.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('branching invariants', () => {
  it('preserves full lineage across chained branches', () => {
    const parent = makeConversation({
      id: 'parent',
      content: [makeMessage('Parent message 1')],
      position: { x: 0, y: 0 },
    });

    const inheritedEntry: InheritedContextEntry = {
      mode: 'full',
      messages: parent.content,
      timestamp: new Date(),
      totalParentMessages: parent.content.length,
    };

    const child = makeConversation({
      id: 'child',
      parentCardIds: [parent.id],
      inheritedContext: {
        [parent.id]: inheritedEntry,
      },
      content: [makeMessage('Child message')],
      position: { x: 300, y: 0 },
    });

    seedStore([parent, child]);

    const branch = useCanvasStore.getState().branchFromMessage({
      sourceCardId: child.id,
      messageIndex: 0,
      branchReason: 'Chain branch',
    });

    expect(branch).not.toBeNull();
    expect(branch?.inheritedContext[parent.id]).toEqual(inheritedEntry);
    expect(branch?.inheritedContext[child.id]?.messages).toEqual(child.content.slice(0, 1));
  });

  it('enforces merge parent limit', () => {
    const parents = Array.from({ length: 6 }, (_, index) => (
      makeConversation({
        id: `parent-${index}`,
        content: [makeMessage(`Parent ${index}`)],
        position: { x: index * 100, y: 0 },
      })
    ));

    seedStore(parents);

    const result = useCanvasStore.getState().createMergeNode({
      sourceCardIds: parents.map((conv) => conv.id),
      position: { x: 600, y: 200 },
      synthesisPrompt: 'Too many parents',
    });

    expect(result).toBeNull();
    expect(useCanvasStore.getState().conversations.size).toBe(parents.length);
  });

  it('keeps undo/redo consistent for branch creation', () => {
    const root = makeConversation({
      id: 'root',
      content: [makeMessage('Root message')],
      position: { x: 0, y: 0 },
    });

    seedStore([root]);

    useCanvasStore.getState().branchFromMessage({
      sourceCardId: root.id,
      messageIndex: 0,
      branchReason: 'Undo check',
    });

    expect(useCanvasStore.getState().conversations.size).toBe(2);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().conversations.size).toBe(1);

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().conversations.size).toBe(2);
  });

  it('preserves parent conversation content when undoing branch creation', () => {
    // Regression test for bug where parent conversation content was deleted on undo
    const parentMessages = [
      makeMessage('First message'),
      makeMessage('Second message'),
      makeMessage('Third message'),
    ];
    const parent = makeConversation({
      id: 'parent',
      content: parentMessages,
      position: { x: 0, y: 0 },
    });

    seedStore([parent]);

    // Verify parent has all messages
    const parentBefore = useCanvasStore.getState().conversations.get('parent');
    expect(parentBefore?.content).toHaveLength(3);
    expect(parentBefore?.content[0]?.content).toBe('First message');

    // Branch from the parent
    const branch = useCanvasStore.getState().branchFromMessage({
      sourceCardId: parent.id,
      messageIndex: 1, // Branch from second message
      branchReason: 'Test branch',
    });

    expect(branch).toBeTruthy();
    expect(useCanvasStore.getState().conversations.size).toBe(2);

    // Undo the branch creation
    useCanvasStore.getState().undo();

    // Parent should still exist and have all its messages
    expect(useCanvasStore.getState().conversations.size).toBe(1);
    const parentAfterUndo = useCanvasStore.getState().conversations.get('parent');
    expect(parentAfterUndo).toBeTruthy();
    expect(parentAfterUndo?.content).toHaveLength(3);
    expect(parentAfterUndo?.content[0]?.content).toBe('First message');
    expect(parentAfterUndo?.content[1]?.content).toBe('Second message');
    expect(parentAfterUndo?.content[2]?.content).toBe('Third message');

    // Redo should bring back the branch
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().conversations.size).toBe(2);
    
    // And parent should still have all messages
    const parentAfterRedo = useCanvasStore.getState().conversations.get('parent');
    expect(parentAfterRedo?.content).toHaveLength(3);
  });
});
