'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  PanelLeftClose, 
  PanelLeft,
  Folder,
  Edit2,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  GitBranch,
  Zap,
  Settings,
} from 'lucide-react';

import { useCanvasStore } from '@/stores/canvas-store';
import { usePreferencesStore, selectUIPreferences } from '@/stores/preferences-store';
import { colors, spacing, effects, typography, animation, layout } from '@/lib/design-tokens';
import type { Workspace, Conversation } from '@/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_SIDEBAR_WIDTH = layout.sidebar.width;
const MAX_SIDEBAR_WIDTH = 600;

// =============================================================================
// CONVERSATION TREE COMPONENT (v4 DAG display)
// =============================================================================

interface ConversationTreeNode {
  conversation: Conversation;
  children: ConversationTreeNode[];
  depth: number;
}

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

function ConversationTree({ workspaceId, isExpanded, onFocusNode }: ConversationTreeProps) {
  const conversations = useCanvasStore(state => state.conversations);
  const selectedNodeIds = useCanvasStore(state => state.selectedNodeIds);
  const setSelected = useCanvasStore(state => state.setSelected);
  
  // Track which conversation nodes are collapsed in this workspace
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    if (!collapsedNodesState.has(workspaceId)) {
      collapsedNodesState.set(workspaceId, new Set());
    }
    return collapsedNodesState.get(workspaceId)!;
  });
  
  // PERFORMANCE: Use a stable key for the workspace tree to minimize recalculations
  // useMemo dependency is now just the serialized tree structure
  const treeKey = useCanvasStore(useMemo(() => createWorkspaceTreeSelector(workspaceId), [workspaceId]));
  
  // Build tree structure from conversations
  const { rootNodes, processedMergeNodes } = useMemo(() => {
    const workspaceConversations = Array.from(conversations.values())
      .filter(c => c.canvasId === workspaceId);
    
    // Track which merge nodes we've already rendered (to avoid duplication)
    const processedMerge = new Set<string>();
    
    // Find root conversations (no parent or parent not in this workspace)
    const rootConvs = workspaceConversations.filter(c => 
      c.parentCardIds.length === 0 || 
      !c.parentCardIds.some(pid => conversations.has(pid))
    );
    
    // Build child map
    const childMap = new Map<string, Conversation[]>();
    workspaceConversations.forEach(conv => {
      conv.parentCardIds.forEach(parentId => {
        if (!childMap.has(parentId)) {
          childMap.set(parentId, []);
        }
        childMap.get(parentId)!.push(conv);
      });
    });
    
    // Recursive tree builder
    function buildNode(conv: Conversation, depth: number): ConversationTreeNode {
      const children: ConversationTreeNode[] = [];
      const childConvs = childMap.get(conv.id) || [];
      
      childConvs.forEach(child => {
        // For merge nodes with multiple parents, only show under the FIRST parent
        // in the parentCardIds array to avoid duplication and maintain the order
        // defined when the merge was created
        if (child.isMergeNode && child.parentCardIds.length > 1) {
          const primaryParent = child.parentCardIds[0];
          // Only add if we're the primary parent and haven't processed this merge yet
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
    
    const roots = rootConvs.map(c => buildNode(c, 0));
    return { rootNodes: roots, processedMergeNodes: processedMerge };
  // PERFORMANCE: Only rebuild tree when structure changes (tracked via treeKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeKey, conversations, workspaceId]);
  
  // PERFORMANCE: Memoize handler to prevent re-renders of child nodes
  // IMPORTANT: Define ALL hooks before any conditional returns
  const handleSelectCard = useCallback((cardId: string) => {
    setSelected([cardId]);
    if (onFocusNode) {
      onFocusNode(cardId);
    }
  }, [setSelected, onFocusNode]);
  
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
  
  // Auto-expand path to selected node
  useEffect(() => {
    const selectedId = Array.from(selectedNodeIds)[0];
    if (!selectedId) return;
    
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
      
      // Add parent to path (but not the selected node itself)
      pathIds.add(parent.id);
      current = parent;
    }
    
    // Expand all nodes in the path
    if (pathIds.size > 0) {
      setCollapsedNodes(prev => {
        const newSet = new Set(prev);
        pathIds.forEach(id => newSet.delete(id));
        collapsedNodesState.set(workspaceId, newSet);
        return newSet;
      });
    }
  }, [selectedNodeIds, conversations, workspaceId]);
  
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
            padding: `${spacing[1]} ${spacing[1]}`,
            paddingLeft: `${8 + depth * 16}px`,
            backgroundColor: isSelected ? `${colors.amber.primary}20` : 'transparent',
            borderRadius: effects.border.radius.default,
            fontSize: typography.sizes.xs,
            fontFamily: typography.fonts.body,
            color: colors.contrast.grayDark,
            transition: 'background-color 0.15s ease',
            borderLeft: isMerge 
              ? `2px solid ${colors.semantic.success}` 
              : isBranched 
                ? `2px solid ${colors.amber.primary}` 
                : '2px solid transparent',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = `${colors.violet.primary}10`;
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
                color: colors.contrast.grayDark,
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
              <GitBranch size={12} color={colors.amber.primary} />
            ) : (
              <MessageSquare size={12} color={colors.contrast.grayDark} />
            )}
            
            {/* Title */}
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: isSelected ? colors.amber.primary : colors.contrast.white,
              }}
              title={conversation.metadata.title}
            >
              {conversation.metadata.title}
            </span>
            
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
  padding: spacing[3],
  borderBottom: `1px solid rgba(99, 102, 241, 0.2)`,
  flexShrink: 0,
};

const contentStyles: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: spacing[2],
  minHeight: 0, // Critical for flex scrolling
};

const toggleButtonStyles: React.CSSProperties = {
  position: 'absolute',
  top: spacing[3],
  left: spacing[3],
  padding: spacing[2],
  backgroundColor: colors.navy.light,
  border: `1px solid rgba(99, 102, 241, 0.3)`,
  borderRadius: effects.border.radius.default,
  color: colors.contrast.grayDark,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99,
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
    if (isActive) {
      setIsTreeExpanded(true);
    }
  }, [isActive]);
  
  // Auto-expand workspace when a card in it is selected
  useEffect(() => {
    if (!selectedNodeId) return;
    
    const selectedConv = conversations.get(selectedNodeId);
    if (selectedConv && selectedConv.canvasId === workspace.id) {
      setIsTreeExpanded(true);
    }
  }, [selectedNodeId, conversations, workspace.id]);

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Trigger rename from F2 key
  useEffect(() => {
    if (triggerRename && isActive) {
      handleStartRename();
      onRenameStart?.();
    }
  }, [triggerRename, isActive]);

  const handleStartRename = () => {
    setRenamingValue(workspace.metadata.title);
    setIsRenaming(true);
    setShowContextMenu(false);
  };

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
          backgroundColor: isActive ? `${colors.amber.primary}15` : 'transparent',
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
            color: colors.contrast.grayDark,
          }}
          title={isTreeExpanded ? 'Collapse' : 'Expand'}
        >
          {isTreeExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        
        {/* Icon */}
        <Folder size={14} color={isActive ? colors.amber.primary : colors.contrast.grayDark} />

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
              color: colors.contrast.white,
              backgroundColor: colors.navy.dark,
              border: `1px solid ${colors.amber.primary}`,
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
              color: isActive ? colors.amber.primary : colors.contrast.white,
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
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(workspace.id);
                }}
                style={{
                  background: 'none',
                  border: `1px solid rgba(99, 102, 241, 0.3)`,
                  padding: spacing[1],
                  cursor: 'pointer',
                  borderRadius: effects.border.radius.default,
                  color: colors.contrast.grayDark,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Delete workspace"
              >
                <Trash2 size={12} />
              </button>
            )}
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
              backgroundColor: colors.navy.light,
              border: `1px solid rgba(99, 102, 241, 0.3)`,
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
                color: colors.contrast.white,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.violet.primary}15`}
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
                Delete
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
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onFocusNode?: (nodeId: string) => void;
}

export function CanvasTreeSidebar({ onOpenSettings, isOpen: externalIsOpen, onToggle, onFocusNode }: CanvasTreeSidebarProps) {
  const [sidebarWidth, setSidebarWidth] = useState(MIN_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [triggerF2Rename, setTriggerF2Rename] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  
  // Use external state for open/close
  const isOpen = externalIsOpen;
  const setIsOpen = onToggle;

  // v4: Use workspaces instead of canvases (flat structure)
  const workspaces = useCanvasStore((s) => s.workspaces);
  const activeWorkspaceId = useCanvasStore((s) => s.activeWorkspaceId);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const navigateToWorkspace = useCanvasStore((s) => s.navigateToWorkspace);
  const deleteWorkspace = useCanvasStore((s) => s.deleteWorkspace);
  const createWorkspace = useCanvasStore((s) => s.createWorkspace);
  const updateWorkspace = useCanvasStore((s) => s.updateWorkspace);
  
  // UI preferences
  const uiPrefs = usePreferencesStore(selectUIPreferences);

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
    // Check if confirmation is required
    if (uiPrefs.confirmOnDelete) {
      if (confirm('Delete this workspace?')) {
        deleteWorkspace(id);
      }
    } else {
      deleteWorkspace(id);
    }
  }, [deleteWorkspace, uiPrefs.confirmOnDelete]);

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

  // Dynamic sidebar styles
  const sidebarStyles: React.CSSProperties = {
    width: sidebarWidth,
    minWidth: MIN_SIDEBAR_WIDTH,
    maxWidth: MAX_SIDEBAR_WIDTH,
    flexShrink: 0,
    backgroundColor: colors.navy.light,
    borderRight: `1px solid rgba(99, 102, 241, 0.2)`,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
    position: 'relative',
    userSelect: isResizing ? 'none' : 'auto',
  };

  // Resize handle styles
  const resizeHandleStyles: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: -2,
    width: isResizing || isResizeHovered ? 4 : 4,
    height: '100%',
    cursor: 'ew-resize',
    backgroundColor: isResizing || isResizeHovered ? colors.amber.primary : 'transparent',
    transition: isResizing ? 'none' : 'background-color 0.15s ease, width 0.15s ease',
    zIndex: 10,
  };

  // Don't render anything when closed - toggle button is in breadcrumb
  if (!isOpen) {
    return null;
  }

  return (
    <motion.aside
      ref={sidebarRef}
      initial={{ x: -MIN_SIDEBAR_WIDTH }}
      animate={{ x: 0 }}
      exit={{ x: -sidebarWidth }}
      transition={animation.spring.gentle}
      style={sidebarStyles}
    >
      {/* Resize handle */}
      <div
        style={resizeHandleStyles}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsResizeHovered(true)}
        onMouseLeave={() => setIsResizeHovered(false)}
      />
      {/* Header */}
      <div style={headerStyles}>
        <span style={{
          fontSize: typography.sizes.sm,
          fontWeight: 600,
          color: colors.contrast.white,
          fontFamily: typography.fonts.heading,
        }}>
          Workspaces
        </span>
        <div style={{ display: 'flex', gap: spacing[1] }}>
          <button
            onClick={() => createWorkspace(`New Workspace ${workspaces.length + 1}`)}
            style={{
              background: 'none',
              border: 'none',
              padding: spacing[1],
              cursor: 'pointer',
              borderRadius: effects.border.radius.default,
              color: colors.navy.dark,
              backgroundColor: colors.amber.primary,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Create new workspace"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: `1px solid rgba(99, 102, 241, 0.3)`,
              padding: spacing[1],
              cursor: 'pointer',
              borderRadius: effects.border.radius.default,
              color: colors.contrast.grayDark,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Close sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      {/* Workspace list (flat, no tree hierarchy) */}
      <div style={contentStyles}>
        {workspaces.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: spacing[4],
            color: colors.contrast.grayDark,
            fontSize: typography.sizes.sm,
            fontFamily: typography.fonts.body,
          }}>
            <Folder size={32} style={{ marginBottom: spacing[2], opacity: 0.5 }} />
            <p>No workspaces yet</p>
            <button
              onClick={() => createWorkspace('My First Workspace')}
              style={{
                marginTop: spacing[2],
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: colors.amber.primary,
                border: 'none',
                borderRadius: effects.border.radius.default,
                color: colors.navy.dark,
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
              canDelete={workspaces.length > 1 && workspace.id !== activeWorkspaceId}
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

      {/* Footer with stats and settings */}
      <div style={{
        padding: spacing[2],
        borderTop: `1px solid rgba(99, 102, 241, 0.2)`,
        fontSize: typography.sizes.xs,
        color: colors.contrast.grayDark,
        fontFamily: typography.fonts.body,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>{workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}</span>
        <button
          onClick={onOpenSettings}
          title="Settings"
          style={{
            padding: spacing[2],
            backgroundColor: 'transparent',
            border: `1px solid rgba(99, 102, 241, 0.3)`,
            borderRadius: effects.border.radius.default,
            color: colors.contrast.gray,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.navy.dark;
            e.currentTarget.style.color = colors.amber.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = colors.contrast.gray;
          }}
        >
          <Settings size={14} />
        </button>
      </div>
    </motion.aside>
  );
}

export default CanvasTreeSidebar;
