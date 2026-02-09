'use client';

import { create } from 'zustand';
import type { Conversation } from '@/types';

export interface ConversationTreeNode {
  conversation: Conversation;
  children: ConversationTreeNode[];
  depth: number;
}

export function buildWorkspaceTree(
  workspaceId: string,
  conversations: Map<string, Conversation>
): ConversationTreeNode[] {
  const workspaceConversations = Array.from(conversations.values())
    .filter(c => c.canvasId === workspaceId);

  if (workspaceConversations.length === 0) return [];

  const processedMerge = new Set<string>();

  const rootConvs = workspaceConversations.filter(c =>
    c.parentCardIds.length === 0 ||
    !c.parentCardIds.some(pid => conversations.has(pid))
  );

  const childMap = new Map<string, Conversation[]>();
  workspaceConversations.forEach(conv => {
    conv.parentCardIds.forEach(parentId => {
      if (!childMap.has(parentId)) {
        childMap.set(parentId, []);
      }
      childMap.get(parentId)!.push(conv);
    });
  });

  function buildNode(conv: Conversation, depth: number): ConversationTreeNode {
    const children: ConversationTreeNode[] = [];
    const childConvs = childMap.get(conv.id) || [];

    childConvs.forEach(child => {
      if (child.isMergeNode && child.parentCardIds.length > 1) {
        const primaryParent = child.parentCardIds[0];
        if (conv.id === primaryParent && !processedMerge.has(child.id)) {
          processedMerge.add(child.id);
          children.push(buildNode(child, depth + 1));
        }
      } else {
        children.push(buildNode(child, depth + 1));
      }
    });

    return { conversation: conv, children, depth };
  }

  return rootConvs.map(c => buildNode(c, 0));
}

interface CanvasTreeCacheEntry {
  key: string;
  rootNodes: ConversationTreeNode[];
}

interface CanvasTreeStore {
  treeCache: Record<string, CanvasTreeCacheEntry>;
  setTree: (workspaceId: string, key: string, rootNodes: ConversationTreeNode[]) => void;
  clearTree: (workspaceId: string) => void;
}

export const useCanvasTreeStore = create<CanvasTreeStore>((set) => ({
  treeCache: {},
  setTree: (workspaceId, key, rootNodes) =>
    set((state) => ({
      treeCache: {
        ...state.treeCache,
        [workspaceId]: { key, rootNodes },
      },
    })),
  clearTree: (workspaceId) =>
    set((state) => {
      const next = { ...state.treeCache };
      delete next[workspaceId];
      return { treeCache: next };
    }),
}));
