'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Folder,
  Edit2,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  GitBranch,
  Zap,
  MoreHorizontal,
  Settings,
  Bot,
} from 'lucide-react';

import { useCanvasStore } from '@/stores/canvas-store';
import { useCanvasTreeStore, buildWorkspaceTree, type ConversationTreeNode } from '@/stores/canvas-tree-store';
import { colors, spacing, effects, typography, layout, components } from '@/lib/design-tokens';
import { enforceTitleWordLimit } from '@/utils/formatters';
import type { Conversation, Workspace } from '@/types';
import { usePreferencesStore, selectUIPreferences } from '@/stores/preferences-store';

// =============================================================================
// CONSTANTS
// =============================================================================
const ACTIVITY_BAR_WIDTH = 48;
const MIN_SIDEBAR_WIDTH = layout.sidebar.width; // Content area width when expanded
const MAX_SIDEBAR_WIDTH = 600;

// =============================================================================
// CONVERSATION TREE COMPONENT (v4 DAG display)

interface ConversationTreeProps {
  workspaceId: string;
  isExpanded: boolean;
  onFocusNode?: (nodeId: string) => void;
}

// Track collapsed conversation nodes
const collapsedNodesState = new Map<string, Set<string>>(); // workspaceId -> Set of collapsed conversation IDs

// PERFORMANCE: Selector that creates a stable reference based on workspace conversations
// Only recalculates when conversation structure actually changes (ids, parents, merge status)
const createWorkspaceTreeSelector = (workspaceId: string) => 
  (state: { conversations: Map<string, Conversation> }) => {
    const arr = Array.from(state.conversations.values())
      .filter(c => c.canvasId === workspaceId)
      .map(c => ({
        id: c.id,
        title: c.metadata.title,
        parentCardIds: c.parentCardIds,
        isMergeNode: c.isMergeNode,
        canvasId: c.canvasId,
      }));
    // Return a stable string key for comparison
    return JSON.stringify(arr);
  };

const EMPTY_ROOT_NODES: ConversationTreeNode[] = [];

function ConversationTree({ workspaceId, isExpanded, onFocusNode }: ConversationTreeProps) {
  const selectedNodeIds = useCanvasStore(state => state.selectedNodeIds);
  const setSelected = useCanvasStore(state => state.setSelected);
  const openChatPanel = useCanvasStore(state => state.openChatPanel);
  const updateConversation = useCanvasStore(state => state.updateConversation);
  const deleteConversation = useCanvasStore(state => state.deleteConversation);
  const requestDeleteConversation = useCanvasStore(state => state.requestDeleteConversation);
  const uiPrefs = usePreferencesStore(selectUIPreferences);
  const setTree = useCanvasTreeStore((state) => state.setTree);
  const rootNodes = useCanvasTreeStore(
    (state) => state.treeCache[workspaceId]?.rootNodes ?? EMPTY_ROOT_NODES
  );
  
  // Track which conversation nodes are collapsed in this workspace
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    if (!collapsedNodesState.has(workspaceId)) {
      collapsedNodesState.set(workspaceId, new Set());
    }
    return collapsedNodesState.get(workspaceId)!;
  });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [conversationMenuPos, setConversationMenuPos] = useState({ x: 0, y: 0 });
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);
  
  // PERFORMANCE: Use a stable key for the workspace tree to minimize recalculations
  // useMemo dependency is now just the serialized tree structure
  const treeKey = useCanvasStore(useMemo(() => createWorkspaceTreeSelector(workspaceId), [workspaceId]));
  
  useEffect(() => {
    const conversations = useCanvasStore.getState().conversations;
    const nextRootNodes = buildWorkspaceTree(workspaceId, conversations);
    setTree(workspaceId, treeKey, nextRootNodes);
  }, [treeKey, workspaceId, setTree]);
  
  // PERFORMANCE: Memoize handler to prevent re-renders of child nodes
  // IMPORTANT: Define ALL hooks before any conditional returns
  const handleSelectCard = useCallback((cardId: string) => {
    setSelected([cardId]);
    openChatPanel(cardId);
    if (onFocusNode) {
      onFocusNode(cardId);
    }
  }, [setSelected, openChatPanel, onFocusNode]);
  
  // Toggle collapse state for a conversation node
  const toggleNodeCollapse = useCallback((conversationId: string) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      collapsedNodesState.set(workspaceId, newSet);
      return newSet;
    });
  }, [workspaceId]);

  useEffect(() => {
    if (renamingId) {
      requestAnimationFrame(() => renameInputRef.current?.focus());
    }
  }, [renamingId]);

  const handleStartRename = useCallback((conversation: Conversation, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenamingId(conversation.id);
    setRenamingValue(conversation.metadata.title);
  }, []);

  const handleFinishRename = useCallback((conversation: Conversation) => {
    const trimmed = renamingValue.trim();
    const limitedTitle = enforceTitleWordLimit(trimmed, 5);

    if (limitedTitle && limitedTitle !== conversation.metadata.title) {
      updateConversation(conversation.id, {
        metadata: {
          ...conversation.metadata,
          title: limitedTitle,
          titleIsManual: true,
          titleAutoGenerated: false,
          updatedAt: new Date(),
        },
      });
    }

    setRenamingId(null);
    setRenamingValue('');
  }, [renamingValue, updateConversation]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenamingValue('');
  }, []);

  const handleConversationRightClick = useCallback((conversation: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConversationMenuPos({ x: e.clientX, y: e.clientY });
    setConversationMenuId(conversation.id);
    setShowConversationMenu(true);
  }, []);
  
  // Auto-expand path to selected node
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const selectedId = Array.from(selectedNodeIds)[0];
    if (!selectedId) return;
    
    const conversations = useCanvasStore.getState().conversations;
    const selectedConv = conversations.get(selectedId);
    if (!selectedConv || selectedConv.canvasId !== workspaceId) return;
    
    // Build path to root by following parent links
    const pathIds = new Set<string>();
    let current = selectedConv;
    const visited = new Set<string>();
    
    while (current) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      
      const parentIds = current.parentCardIds || [];
      const firstParentId = parentIds[0];
      if (!firstParentId) break;
      
      const parent = conversations.get(firstParentId);
      if (!parent) break;
      
      pathIds.add(parent.id);
      current = parent;
    }

    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      pathIds.forEach(id => newSet.delete(id));
      collapsedNodesState.set(workspaceId, newSet);
      return newSet;
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedNodeIds, treeKey, workspaceId]);
  
  // Early return AFTER all hooks are defined (React hooks rules)
  if (!isExpanded || rootNodes.length === 0) {
    return null;
  }
  
  // Recursive render
  function renderNode(node: ConversationTreeNode): React.ReactNode {
    const { conversation, children, depth } = node;
    const isSelected = selectedNodeIds.has(conversation.id);
    const isMerge = conversation.isMergeNode;
    const isBranched = conversation.parentCardIds.length > 0 && !isMerge;
    const mergeSourceCount = isMerge ? conversation.parentCardIds.length : 0;
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedNodes.has(conversation.id);
    
    return (
      <div key={conversation.id}>
        <motion.div
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[1],
            padding: `${spacing[1]} ${spacing[2]}`,
            paddingLeft: `${components.tree.indentBase + depth * components.tree.indentStep}px`,
            backgroundColor: isSelected ? `${colors.accent.primary}20` : 'transparent',
            borderRadius: effects.border.radius.default,
            fontSize: typography.sizes.xs,
            fontFamily: typography.fonts.body,
            color: colors.fg.tertiary,
            transition: 'background-color 0.15s ease',
          }}
          onContextMenu={(e) => handleConversationRightClick(conversation, e)}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = `${colors.accent.primary}10`;
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {/* Collapse chevron (only if has children) */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeCollapse(conversation.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: colors.fg.tertiary,
              }}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          ) : (
            <div style={{ width: 12 }} />
          )}
          
          {/* Clickable content */}
          <div
            onClick={() => handleSelectCard(conversation.id)}
            style={{ display: 'flex', alignItems: 'center', gap: spacing[1], flex: 1, cursor: 'pointer' }}
          >
            {/* Icon */}
            {isMerge ? (
              <Zap size={12} color={colors.semantic.success} />
            ) : isBranched ? (
              <GitBranch size={12} color={colors.accent.primary} />
            ) : (
              <MessageSquare size={12} color={colors.fg.tertiary} />
            )}
            
            {/* Title */}
            {renamingId === conversation.id ? (
              <input
                ref={renameInputRef}
                value={renamingValue}
                onChange={(e) => setRenamingValue(e.target.value)}
                onBlur={() => handleFinishRename(conversation)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleFinishRename(conversation);
                  } else if (e.key === 'Escape') {
                    handleCancelRename();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fonts.body,
                  color: colors.fg.primary,
                  backgroundColor: colors.bg.inset,
                  border: `1px solid ${colors.accent.primary}`,
                  borderRadius: effects.border.radius.default,
                  padding: `1px ${spacing[1]}`,
                  outline: 'none',
                  minWidth: 0,
                }}
                aria-label="Rename conversation"
              />
            ) : (
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isSelected ? colors.accent.primary : colors.fg.primary,
                }}
                title={conversation.metadata.title}
                onDoubleClick={(e) => handleStartRename(conversation, e)}
              >
                {conversation.metadata.title}
              </span>
            )}
            
            {/* Merge indicator with source count */}
            {isMerge && mergeSourceCount > 0 && (
              <span
                style={{
                  fontSize: typography.sizes.xs,
                  color: colors.semantic.success,
                  backgroundColor: `${colors.semantic.success}20`,
                  padding: `0 ${spacing[1]}`,
                  borderRadius: effects.border.radius.default,
                }}
                title={`Merged from ${mergeSourceCount} cards`}
              >
                {mergeSourceCount}
              </span>
            )}
          </div>
        </motion.div>
        
        {/* Children (only show if not collapsed) */}
        {hasChildren && !isCollapsed && (
          <div style={{ marginLeft: '0px' }}>
            {children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div style={{ marginTop: spacing[1] }}>
      {rootNodes.map(node => renderNode(node))}

      {showConversationMenu && conversationMenuId && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
            }}
            onClick={() => setShowConversationMenu(false)}
          />
          <div
            style={{
              position: 'fixed',
              left: conversationMenuPos.x,
              top: conversationMenuPos.y,
              backgroundColor: colors.bg.secondary,
              border: '1px solid var(--border-primary)',
              borderRadius: effects.border.radius.default,
              boxShadow: effects.shadow.lg,
              padding: spacing[1],
              zIndex: 9999,
              minWidth: 160,
            }}
          >
            <button
              onClick={() => {
                const conv = useCanvasStore.getState().conversations.get(conversationMenuId);
                if (conv) {
                  handleStartRename(conv);
                }
                setShowConversationMenu(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: spacing[2],
                padding: `${spacing[2]} ${spacing[2]}`,
                background: 'none',
                border: 'none',
                borderRadius: effects.border.radius.default,
                color: colors.fg.primary,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.accent.primary}15`}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Edit2 size={14} />
              Rename
            </button>
            <button
              onClick={() => {
                if (uiPrefs.confirmOnDelete) {
                  requestDeleteConversation([conversationMenuId]);
                } else {
                  deleteConversation(conversationMenuId);
                }
                setShowConversationMenu(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: spacing[2],
                padding: `${spacing[2]} ${spacing[2]}`,
                background: 'none',
                border: 'none',
                borderRadius: effects.border.radius.default,
                color: colors.semantic.error,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.semantic.error}15`}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Trash2 size={14} />
              Delete card
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing[2]} ${spacing[3]}`,
  borderBottom: '1px solid var(--border-secondary)',
  flexShrink: 0,
};

const contentStyles: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: spacing[2],
  minHeight: 0, // Critical for flex scrolling
};

// =============================================================================
// WORKSPACE ITEM COMPONENT
// =============================================================================

interface WorkspaceItemProps {
  workspace: Workspace;
  isActive: boolean;
  canDelete: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  triggerRename?: boolean;
  onRenameStart?: () => void;
  selectedNodeId?: string; // For auto-expanding when card is selected
  onFocusNode?: (nodeId: string) => void;
}

function WorkspaceItem({ 
  workspace, 
  isActive, 
  canDelete,
  onSelect,
  onDelete,
  onRename,
  triggerRename,
  onRenameStart,
  selectedNodeId,
  onFocusNode,
}: WorkspaceItemProps) {
  const conversations = useCanvasStore(state => state.conversations);
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isTreeExpanded, setIsTreeExpanded] = useState(false);
  const [renamingValue, setRenamingValue] = useState(workspace.metadata.title);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Auto-expand tree when workspace is active
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isActive) {
      setIsTreeExpanded(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isActive]);
  
  // Auto-expand workspace when a card in it is selected
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!selectedNodeId) return;
    
    const selectedConv = conversations.get(selectedNodeId);
    if (selectedConv && selectedConv.canvasId === workspace.id) {
      setIsTreeExpanded(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedNodeId, conversations, workspace.id]);

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleStartRename = useCallback(() => {
    setRenamingValue(workspace.metadata.title);
    setIsRenaming(true);
    setShowContextMenu(false);
  }, [workspace.metadata.title]);

  // Trigger rename from F2 key
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (triggerRename && isActive) {
      handleStartRename();
      onRenameStart?.();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [triggerRename, isActive, handleStartRename, onRenameStart]);

  const handleFinishRename = () => {
    const trimmed = renamingValue.trim();
    if (trimmed && trimmed !== workspace.metadata.title) {
      onRename(workspace.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setRenamingValue(workspace.metadata.title);
    setIsRenaming(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleStartRename();
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenuPos({ x: rect.left, y: rect.bottom + 6 });
    setShowContextMenu(true);
  };

  return (
    <div>
      {/* Workspace row */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleRightClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[1],
          padding: `${spacing[1]} ${spacing[2]}`,
          paddingLeft: spacing[1],
          backgroundColor: isActive ? `${colors.accent.primary}15` : 'transparent',
          borderRadius: effects.border.radius.default,
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
        }}
        onClick={() => {
          if (!isRenaming) {
            onSelect(workspace.id);
            // Auto-expand tree when clicking on workspace
            if (!isTreeExpanded) {
              setIsTreeExpanded(true);
            }
          }
        }}
      >
        {/* Expand/collapse chevron */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsTreeExpanded(!isTreeExpanded);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: colors.fg.tertiary,
          }}
          title={isTreeExpanded ? 'Collapse' : 'Expand'}
        >
          {isTreeExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        
        {/* Icon */}
        <Folder size={14} color={isActive ? colors.accent.primary : colors.fg.tertiary} />

        {/* Name (or rename input) */}
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renamingValue}
            onChange={(e) => setRenamingValue(e.target.value)}
            onBlur={handleFinishRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFinishRename();
              } else if (e.key === 'Escape') {
                handleCancelRename();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              fontSize: typography.sizes.sm,
              fontFamily: typography.fonts.body,
              color: colors.fg.primary,
              backgroundColor: colors.bg.inset,
              border: `1px solid ${colors.accent.primary}`,
              borderRadius: effects.border.radius.default,
              padding: `2px ${spacing[1]}`,
              outline: 'none',
            }}
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            style={{
              flex: 1,
              fontSize: typography.sizes.sm,
              fontFamily: typography.fonts.body,
              color: isActive ? colors.accent.primary : colors.fg.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {workspace.metadata.title}
          </span>
        )}

        {/* Actions (shown on hover or for active item) */}
        {(isActive || isHovered) && (
          <div style={{ display: 'flex', gap: spacing[1] }}>
            <button
              onClick={handleMenuClick}
              style={{
                background: 'none',
                border: '1px solid var(--border-primary)',
                padding: spacing[1],
                cursor: 'pointer',
                borderRadius: effects.border.radius.default,
                color: colors.fg.tertiary,
                display: 'flex',
                alignItems: 'center',
              }}
              title="Canvas menu"
            >
              <MoreHorizontal size={12} />
            </button>
          </div>
        )}
      </motion.div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
            }}
            onClick={() => setShowContextMenu(false)}
          />
          <div
            style={{
              position: 'fixed',
              left: contextMenuPos.x,
              top: contextMenuPos.y,
              backgroundColor: colors.bg.secondary,
              border: '1px solid var(--border-primary)',
              borderRadius: effects.border.radius.default,
              boxShadow: effects.shadow.lg,
              padding: spacing[1],
              zIndex: 9999,
              minWidth: 160,
            }}
          >
            <button
              onClick={handleStartRename}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: spacing[2],
                padding: `${spacing[2]} ${spacing[2]}`,
                background: 'none',
                border: 'none',
                borderRadius: effects.border.radius.default,
                color: colors.fg.primary,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.accent.primary}15`}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Edit2 size={14} />
              Rename
            </button>
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContextMenu(false);
                  onDelete(workspace.id);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[2],
                  padding: `${spacing[2]} ${spacing[2]}`,
                  background: 'none',
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: colors.semantic.error,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.semantic.error}15`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Trash2 size={14} />
                Delete canvas
              </button>
            )}
          </div>
        </>
      )}
      
      {/* Conversation Tree (v4 DAG display) */}
      <AnimatePresence>
        {isTreeExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <ConversationTree 
              workspaceId={workspace.id} 
              isExpanded={isTreeExpanded}
              onFocusNode={onFocusNode}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// CANVAS TREE SIDEBAR COMPONENT (v4 - Flat Workspace Switcher)
// =============================================================================

interface CanvasTreeSidebarProps {
  onOpenSettings: () => void;
  onOpenAgents?: () => void;
  onOpenFeedback?: () => void;
  onRequestDeleteWorkspace: (workspaceId: string) => void;
  onRequestCreateWorkspace: (suggestedName: string) => void;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onFocusNode?: (nodeId: string) => void;
  /** When true, renders full-width without activity bar or resize handle */
  isMobile?: boolean;
}

export function CanvasTreeSidebar({
  onOpenSettings,
  onOpenAgents,
  onOpenFeedback,
  onRequestDeleteWorkspace,
  onRequestCreateWorkspace,
  isOpen: externalIsOpen,
  onToggle,
  onFocusNode,
  isMobile = false,
}: CanvasTreeSidebarProps) {
  const [sidebarWidth, setSidebarWidth] = useState(MIN_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [triggerF2Rename, setTriggerF2Rename] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Use external state for open/close
  const isOpen = externalIsOpen;
  const setIsOpen = onToggle;

  // v4: Use workspaces instead of canvases (flat structure)
  const workspaces = useCanvasStore((s) => s.workspaces);
  const activeWorkspaceId = useCanvasStore((s) => s.activeWorkspaceId);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const navigateToWorkspace = useCanvasStore((s) => s.navigateToWorkspace);
  const updateWorkspace = useCanvasStore((s) => s.updateWorkspace);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Handlers
  const handleSelect = useCallback((id: string) => {
    navigateToWorkspace(id);
  }, [navigateToWorkspace]);

  const handleDelete = useCallback((id: string) => {
    onRequestDeleteWorkspace(id);
  }, [onRequestDeleteWorkspace]);

  const handleCreateWorkspace = useCallback((title: string) => {
    onRequestCreateWorkspace(title);
  }, [onRequestCreateWorkspace]);


  const handleRename = useCallback((workspaceId: string, newName: string) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (workspace) {
      updateWorkspace(workspaceId, {
        metadata: {
          ...workspace.metadata,
          title: newName,
          updatedAt: new Date(),
        },
      });
    }
  }, [workspaces, updateWorkspace]);

  // F2 keyboard shortcut for renaming
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setTriggerF2Rename(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRenameStart = useCallback(() => {
    setTriggerF2Rename(false);
  }, []);

  // Resize handle styles
  const resizeHandleStyles: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: '100%',
    cursor: 'ew-resize',
    zIndex: 10,
  };
  
  const resizeLineStyles: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 3,
    height: '100%',
    backgroundColor: isResizing || isResizeHovered ? colors.accent.primary : 'transparent',
    transition: isResizing ? 'none' : 'background-color 0.15s ease',
    pointerEvents: 'none',
  };

  // Mobile mode: render full-width without activity bar or resize handle
  if (isMobile) {
    return (
      <div
        ref={sidebarRef}
        style={{
          position: 'relative',
          width: '100%',
          backgroundColor: colors.bg.secondary,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={headerStyles}>
          <span style={{
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.semibold,
            color: colors.fg.primary,
            fontFamily: typography.fonts.heading,
          }}>
            Workspaces
          </span>
          <button
            onClick={() => {
              handleCreateWorkspace(`New Workspace ${workspaces.length + 1}`);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: spacing[1],
              cursor: 'pointer',
              borderRadius: effects.border.radius.default,
              color: colors.accent.contrast,
              backgroundColor: colors.accent.primary,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Create new workspace"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Workspace list */}
        <div style={{ ...contentStyles, WebkitOverflowScrolling: 'touch' }}>
          {workspaces.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: spacing[4],
              color: colors.fg.tertiary,
              fontSize: typography.sizes.sm,
              fontFamily: typography.fonts.body,
            }}>
              <Folder size={32} style={{ marginBottom: spacing[2], opacity: 0.5 }} />
              <p>No workspaces yet</p>
              <button
                onClick={() => {
                  handleCreateWorkspace('My First Workspace');
                }}
                style={{
                  marginTop: spacing[2],
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: colors.accent.primary,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: colors.accent.contrast,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  cursor: 'pointer',
                }}
              >
                Create Workspace
              </button>
            </div>
          ) : (
            workspaces.map((workspace) => (
              <WorkspaceItem
                key={workspace.id}
                workspace={workspace}
                isActive={workspace.id === activeWorkspaceId}
                canDelete={workspaces.length > 0}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onRename={handleRename}
                triggerRename={triggerF2Rename}
                onRenameStart={handleRenameStart}
                selectedNodeId={Array.from(selectedNodeIds)[0]}
                onFocusNode={onFocusNode}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: spacing[2],
          borderTop: '1px solid var(--border-secondary)',
          fontSize: typography.sizes.xs,
          color: colors.fg.tertiary,
          fontFamily: typography.fonts.body,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span>{workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={sidebarRef}
      style={{
        position: 'relative',
        width: isOpen ? sidebarWidth + ACTIVITY_BAR_WIDTH : ACTIVITY_BAR_WIDTH,
        backgroundColor: colors.bg.secondary,
        borderRight: `1px solid ${colors.border.default}`,
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        overflow: 'hidden',
        zIndex: 2,
        flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: isResizing ? 'none' : 'auto',
      }}
    >
      {/* Activity Bar - Always Visible */}
      <div
        style={{
          width: ACTIVITY_BAR_WIDTH,
          height: '100%',
          backgroundColor: colors.bg.secondary,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${spacing[2]} 0`,
          gap: spacing[1],
          flexShrink: 0,
          borderRight: `1px solid ${colors.border.default}`,
        }}
      >
        {/* Workspaces Toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: `${ACTIVITY_BAR_WIDTH - 8}px`,
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isOpen ? colors.accent.muted : 'transparent',
            border: 'none',
            borderLeft: isOpen ? `2px solid ${colors.accent.primary}` : '2px solid transparent',
            borderRadius: 0,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          title="Workspaces"
          onMouseEnter={(e) => {
            if (!isOpen) {
              e.currentTarget.style.backgroundColor = colors.bg.tertiary;
            }
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <Folder size={20} color={isOpen ? colors.accent.primary : colors.fg.secondary} />
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Agents Button */}
        {onOpenAgents && (
          <button
            onClick={onOpenAgents}
            style={{
              width: `${ACTIVITY_BAR_WIDTH - 8}px`,
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderLeft: '2px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            title="AI Agents"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.tertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Bot size={20} color={colors.fg.secondary} />
          </button>
        )}

        {/* Feedback Button */}
        {onOpenFeedback && (
          <button
            onClick={onOpenFeedback}
            style={{
              width: `${ACTIVITY_BAR_WIDTH - 8}px`,
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderLeft: '2px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            title="Share feedback"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.tertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <MessageSquare size={20} color={colors.fg.secondary} />
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          style={{
            width: `${ACTIVITY_BAR_WIDTH - 8}px`,
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            border: 'none',
            borderLeft: '2px solid transparent',
            borderRadius: 0,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          title="Settings"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.bg.tertiary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Settings size={20} color={colors.fg.secondary} />
        </button>
      </div>

      {/* Sidebar Content - Only visible when expanded */}
      {isOpen && (
        <div
          style={{
            width: sidebarWidth,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
      {/* Resize handle */}
      <div
        style={resizeHandleStyles}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsResizeHovered(true)}
        onMouseLeave={() => setIsResizeHovered(false)}
      >
        <div style={resizeLineStyles} />
      </div>
      {/* Header */}
      <div style={headerStyles}>
        <span style={{
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.fg.primary,
          fontFamily: typography.fonts.heading,
        }}>
          Workspaces
        </span>
        <button
          onClick={() => {
            handleCreateWorkspace(`New Workspace ${workspaces.length + 1}`);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: spacing[1],
            cursor: 'pointer',
            borderRadius: effects.border.radius.default,
            color: colors.accent.contrast,
            backgroundColor: colors.accent.primary,
            display: 'flex',
            alignItems: 'center',
          }}
          title="Create new workspace"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Workspace list (flat, no tree hierarchy) */}
      <div style={contentStyles}>
        {workspaces.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: spacing[4],
            color: colors.fg.tertiary,
            fontSize: typography.sizes.sm,
            fontFamily: typography.fonts.body,
          }}>
            <Folder size={32} style={{ marginBottom: spacing[2], opacity: 0.5 }} />
            <p>No workspaces yet</p>
            <button
              onClick={() => {
                handleCreateWorkspace('My First Workspace');
              }}
              style={{
                marginTop: spacing[2],
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: colors.accent.primary,
                border: 'none',
                borderRadius: effects.border.radius.default,
                color: colors.accent.contrast,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                cursor: 'pointer',
              }}
            >
              Create Workspace
            </button>
          </div>
        ) : (
          workspaces.map((workspace) => (
            <WorkspaceItem
              key={workspace.id}
              workspace={workspace}
              isActive={workspace.id === activeWorkspaceId}
              canDelete={workspaces.length > 0}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onRename={handleRename}
              triggerRename={triggerF2Rename}
              onRenameStart={handleRenameStart}
              selectedNodeId={Array.from(selectedNodeIds)[0]}
              onFocusNode={onFocusNode}
            />
          ))
        )}
      </div>

        {/* Footer with stats */}
        <div style={{
          padding: spacing[2],
          borderTop: '1px solid var(--border-secondary)',
          fontSize: typography.sizes.xs,
          color: colors.fg.tertiary,
          fontFamily: typography.fonts.body,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span>{workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      )}
    </div>
  );
}

export default CanvasTreeSidebar;
