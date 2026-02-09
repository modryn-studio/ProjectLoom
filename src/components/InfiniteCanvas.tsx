'use client';

import React, { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  Node,
  Edge,
  Connection,
  NodeTypes,
  OnConnect,
  OnConnectEnd,
  OnNodesChange,
  OnEdgesChange,
  ReactFlowInstance,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useShallow } from 'zustand/react/shallow';

import { colors, canvas as canvasConfig, animation, spacing, typography, effects } from '@/lib/design-tokens';
import { logger } from '@/lib/logger';
import type { ConversationNodeData } from '@/types';
import { ConversationCard } from './ConversationCard';
import { CustomConnectionLine } from './CustomConnectionLine';
import DevPerformanceOverlay from './DevPerformanceOverlay';
import { CanvasSearch } from './CanvasSearch';
import { useSearchStore } from '@/stores/search-store';
import { treeLayout } from '@/lib/layout-utils';
import { useToastStore } from '@/stores/toast-store';
import { STORAGE_KEYS, createBackupPayload } from '@/lib/storage';
import { UndoToast } from './UndoToast';
import { BranchDialog } from './BranchDialog';
import { InheritedContextPanel } from './InheritedContextPanel';
import { CanvasBreadcrumb } from './CanvasBreadcrumb';
import { CanvasTreeSidebar } from './CanvasTreeSidebar';
import { SettingsPanel } from './SettingsPanel';
import { CanvasContextModal } from './CanvasContextModal';
import { AgentDialog } from './AgentDialog';
import { ChatPanel } from './ChatPanel';
import { UsageSidebar } from './UsageSidebar';
import { WorkspaceNameModal } from './WorkspaceNameModal';
import { ContextMenu, useContextMenu, ContextMenuItem } from './ContextMenu';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useCanvasStore, selectBranchDialogOpen, selectChatPanelOpen, selectUsagePanelOpen } from '@/stores/canvas-store';
import { usePreferencesStore, selectUIPreferences, selectBranchingPreferences } from '@/stores/preferences-store';
import { Plus } from 'lucide-react';

// =============================================================================
// NODE TYPES
// =============================================================================

const nodeTypes: NodeTypes = {
  conversation: ConversationCard,
};

// =============================================================================
// DEFAULT EDGE OPTIONS
// =============================================================================

const defaultEdgeOptions = {
  type: 'smoothstep',
  style: {
    stroke: canvasConfig.edge.stroke,
    strokeWidth: canvasConfig.edge.strokeWidth,
  },
  animated: false,
};

// =============================================================================
// CANVAS STYLES
// =============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const mainContentStyles: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
  minWidth: 0,
};

const canvasStyles: React.CSSProperties = {
  width: '100%',
  height: '100%',
  backgroundColor: canvasConfig.background.color,
};

const connectionLineStyle: React.CSSProperties = {
  stroke: colors.accent.primary,
  strokeWidth: 2,
};

// Memoized styles to prevent re-creation on every render
const minimapStyle: React.CSSProperties = {
  backgroundColor: canvasConfig.minimap.backgroundColor,
  width: canvasConfig.minimap.width,
  height: canvasConfig.minimap.height,
};

const controlsStyle: React.CSSProperties = {
  backgroundColor: colors.bg.secondary,
  borderColor: colors.border.default,
};

const defaultViewport = { x: 0, y: 0, zoom: canvasConfig.viewport.defaultZoom };

// Top overlay for breadcrumb and inherited context
const topOverlayStyles: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  pointerEvents: 'none',
};

const pointerEventsAutoStyle: React.CSSProperties = {
  pointerEvents: 'auto',
};

const emptyStateStyles: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: canvasConfig.background.color,
  padding: spacing[6],
};

const emptyCardStyles: React.CSSProperties = {
  maxWidth: 480,
  width: '100%',
  backgroundColor: colors.bg.secondary,
  border: `1px solid ${colors.border.default}`,
  borderRadius: effects.border.radius.lg,
  boxShadow: effects.shadow.lg,
  padding: spacing[5],
  textAlign: 'center',
};

// =============================================================================
// INFINITE CANVAS COMPONENT
// =============================================================================

export function InfiniteCanvas() {
  const reactFlowInstance = useRef<ReactFlowInstance<Node<ConversationNodeData>, Edge> | null>(null);

  // Settings panel state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Canvas context modal state
  const [canvasContextOpen, setCanvasContextOpen] = useState(false);

  // Workspace delete modal state
  const [deleteWorkspaceModal, setDeleteWorkspaceModal] = useState<
    | { id: string; label: string; step: 'warn' | 'confirm'; confirmText: string }
    | null
  >(null);

  // Workspace name modal state
  const [workspaceNameModal, setWorkspaceNameModal] = useState<
    | { suggestedName: string }
    | null
  >(null);

  // Agent dialog state
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  
  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Canvas context menu
  const canvasContextMenu = useContextMenu();
  const [canvasClickPosition, setCanvasClickPosition] = useState<{ x: number; y: number } | null>(null);

  // Get data from store using shallow comparison to prevent unnecessary re-renders
  const {
    nodes,
    edges,
    selectedNodeIds,
    activeWorkspaceId,
    workspaces,
  } = useCanvasStore(useShallow((s) => ({
    nodes: s.nodes,
    edges: s.edges,
    selectedNodeIds: s.selectedNodeIds,
    activeWorkspaceId: s.activeWorkspaceId,
    workspaces: s.workspaces,
  })));

  // Get actions from store (these are stable references)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const deleteConversation = useCanvasStore((s) => s.deleteConversation);
  const openBranchDialog = useCanvasStore((s) => s.openBranchDialog);
  const branchFromMessage = useCanvasStore((s) => s.branchFromMessage);
  const navigateToWorkspace = useCanvasStore((s) => s.navigateToWorkspace);
  const deleteWorkspace = useCanvasStore((s) => s.deleteWorkspace);
  const createWorkspace = useCanvasStore((s) => s.createWorkspace);
  const createConversationCard = useCanvasStore((s) => s.createConversationCard);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const applyLayout = useCanvasStore((s) => s.applyLayout);
  const pendingDeleteConversationIds = useCanvasStore((s) => s.pendingDeleteConversationIds);
  const requestDeleteConversation = useCanvasStore((s) => s.requestDeleteConversation);
  const clearDeleteConversationRequest = useCanvasStore((s) => s.clearDeleteConversationRequest);
  const conversations = useCanvasStore((s) => s.conversations);

  // Chat panel state
  const chatPanelOpen = useCanvasStore(selectChatPanelOpen);
  const openChatPanel = useCanvasStore((s) => s.openChatPanel);
  const closeChatPanel = useCanvasStore((s) => s.closeChatPanel);

  // Usage panel state
  const usagePanelOpen = useCanvasStore(selectUsagePanelOpen);
  const toggleUsagePanel = useCanvasStore((s) => s.toggleUsagePanel);
  const closeUsagePanel = useCanvasStore((s) => s.closeUsagePanel);

  // Branch dialog state
  const branchDialogOpen = useCanvasStore(selectBranchDialogOpen);
  const hierarchicalMergeDialogOpen = useCanvasStore((s) => s.hierarchicalMergeDialogOpen);

  // Current workspace context (v4 - flat)
  const currentWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  const requestDeleteWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    const label = workspace?.metadata.title || 'Canvas';
    setDeleteWorkspaceModal({ id: workspaceId, label, step: 'warn', confirmText: '' });
  }, [workspaces]);

  const confirmDeleteWorkspace = useCallback(() => {
    if (!deleteWorkspaceModal) return;
    if (deleteWorkspaceModal.step === 'warn') {
      setDeleteWorkspaceModal((prev) => prev ? { ...prev, step: 'confirm', confirmText: '' } : prev);
      return;
    }

    if (deleteWorkspaceModal.confirmText !== 'DELETE') return;

    deleteWorkspace(deleteWorkspaceModal.id);
    setDeleteWorkspaceModal(null);
  }, [deleteWorkspaceModal, deleteWorkspace]);
  const deleteConversationLabel = useMemo(() => {
    if (pendingDeleteConversationIds.length === 1) {
      const conversation = conversations.get(pendingDeleteConversationIds[0]);
      return conversation?.metadata.title || 'Conversation';
    }
    return `${pendingDeleteConversationIds.length} conversations`;
  }, [conversations, pendingDeleteConversationIds]);

  const confirmDeleteConversation = useCallback(() => {
    if (pendingDeleteConversationIds.length === 0) return;
    pendingDeleteConversationIds.forEach((id) => deleteConversation(id));
    clearDeleteConversationRequest();
  }, [pendingDeleteConversationIds, deleteConversation, clearDeleteConversationRequest]);

  const cancelDeleteConversation = useCallback(() => {
    clearDeleteConversationRequest();
  }, [clearDeleteConversationRequest]);

  const cancelDeleteWorkspace = useCallback(() => {
    setDeleteWorkspaceModal(null);
  }, []);

  useEffect(() => {
    if (!deleteWorkspaceModal && pendingDeleteConversationIds.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'button') return;

      if (deleteWorkspaceModal) {
        if (deleteWorkspaceModal.step === 'confirm' && deleteWorkspaceModal.confirmText !== 'DELETE') return;
        confirmDeleteWorkspace();
        return;
      }

      if (pendingDeleteConversationIds.length > 0) {
        confirmDeleteConversation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteWorkspaceModal, pendingDeleteConversationIds.length, confirmDeleteWorkspace, confirmDeleteConversation]);

  // UI Preferences
  const uiPrefs = usePreferencesStore(selectUIPreferences);
  const branchingPrefs = usePreferencesStore(selectBranchingPreferences);
  const isPrefsLoaded = usePreferencesStore((s) => s.isLoaded);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Settings panel handlers (memoized to prevent re-renders)
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const showDevOverlay = process.env.NODE_ENV === 'development'
    || process.env.NEXT_PUBLIC_ENABLE_DEV_OVERLAY === 'true';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const lastExportRaw = window.localStorage.getItem(STORAGE_KEYS.BACKUP_LAST_EXPORT);
    const lastReminderRaw = window.localStorage.getItem(STORAGE_KEYS.BACKUP_REMINDER_LAST_SHOWN);
    const lastAutoRaw = window.localStorage.getItem(STORAGE_KEYS.BACKUP_LAST_AUTO_EXPORT);
    const lastExport = lastExportRaw ? Date.parse(lastExportRaw) : 0;
    const lastReminder = lastReminderRaw ? Date.parse(lastReminderRaw) : 0;
    const lastAuto = lastAutoRaw ? Date.parse(lastAutoRaw) : 0;

    const needsBackup = !lastExportRaw || now - lastExport > weekMs;
    const canRemind = !lastReminderRaw || now - lastReminder > dayMs;
    const needsAutoBackup = !lastAutoRaw || now - lastAuto > dayMs;

    if (needsAutoBackup) {
      const payload = createBackupPayload();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStamp = payload.exportedAt.slice(0, 10);

      link.href = url;
      link.download = `projectloom-backup-${dateStamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      window.localStorage.setItem(STORAGE_KEYS.BACKUP_LAST_AUTO_EXPORT, payload.exportedAt);
      window.localStorage.setItem(STORAGE_KEYS.BACKUP_LAST_EXPORT, payload.exportedAt);
      useToastStore.getState().info('Daily backup saved.', { duration: 4000 });
    }

    if (needsBackup && canRemind) {
      window.localStorage.setItem(STORAGE_KEYS.BACKUP_REMINDER_LAST_SHOWN, new Date().toISOString());
      useToastStore.getState().info('Backup reminder: export your ProjectLoom data.', {
        action: { label: 'Open Settings', onClick: openSettings },
        duration: 8000,
      });
    }
  }, [openSettings]);

  // Force fitView when nodes are loaded
  useEffect(() => {
    if (nodes.length > 0 && reactFlowInstance.current) {
      setTimeout(() => {
        reactFlowInstance.current?.fitView({
          padding: 0.2,
          duration: 800,
        });
      }, 300);
    }
  }, [nodes.length]);

  // Adjust canvas view when chat panel is opened/closed
  // This ensures the active card stays in view when the viewport changes
  useEffect(() => {
    if (!reactFlowInstance.current) return;
    
    const currentSelectedIds = useCanvasStore.getState().selectedNodeIds;
    if (currentSelectedIds.size !== 1) return;
    
    // Small delay to allow panel animation to complete
    const timer = setTimeout(() => {
      if (reactFlowInstance.current) {
        const selectedId = Array.from(currentSelectedIds)[0];
        reactFlowInstance.current.fitView({
          padding: 0.2,
          duration: 600,
          nodes: [{ id: selectedId }],
        });
      }
    }, 350); // Match panel animation duration
    
    return () => clearTimeout(timer);
  }, [chatPanelOpen]);

  // Adjust canvas view when sidebar is toggled
  useEffect(() => {
    if (!reactFlowInstance.current) return;
    
    const currentSelectedIds = useCanvasStore.getState().selectedNodeIds;
    if (currentSelectedIds.size !== 1) return;
    
    // Small delay to allow sidebar animation to complete
    const timer = setTimeout(() => {
      if (reactFlowInstance.current) {
        const selectedId = Array.from(currentSelectedIds)[0];
        reactFlowInstance.current.fitView({
          padding: 0.2,
          duration: 600,
          nodes: [{ id: selectedId }],
        });
      }
    }, 350);
    
    return () => clearTimeout(timer);
  }, [isSidebarOpen]);

  // Handle node changes (position updates)
  const handleNodesChange: OnNodesChange<Node<ConversationNodeData>> = useCallback(
    (changes) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  // Handle edge changes
  const handleEdgesChange: OnEdgesChange<Edge> = useCallback(
    (changes) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  // Handle new connections (v4: supports merge creation)
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      
      // Read conversations from store state directly to avoid subscribing to the entire Map
      const currentConversations = useCanvasStore.getState().conversations;
      const targetConversation = currentConversations.get(connection.target);
      const sourceConversation = currentConversations.get(connection.source);
      
      if (!targetConversation || !sourceConversation) {
        // Fallback to regular edge if conversations not found
        onConnect(connection);
        return;
      }
      
      // v4: If target is an existing conversation, offer to create merge node
      // For now, create a merge node when connecting two existing cards
      if (targetConversation.isMergeNode) {
        // Target is already a merge node - try to add source as parent
        // This is handled by creating an edge of type 'merge'
        const store = useCanvasStore.getState();
        if (store.canAddMergeParent(connection.target)) {
          const edge = store.createEdge(connection.source, connection.target, 'merge');
          if (!edge) {
            logger.warn('Cannot add parent to merge node - would create cycle or already exists');
          }
        } else {
          // Max parents reached
          logger.warn('Cannot add more parents to merge node - max reached');
        }
      } else {
        // Normal connection - create a standard reference edge
        onConnect(connection);
      }
    },
    [onConnect]
  );

  // Handle node selection - single click opens chat panel
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Open chat panel with this conversation
      openChatPanel(node.id);
    },
    [openChatPanel]
  );

  // Handle node double-click - no longer used for expansion, same as single click
  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Same as single click - open chat panel
      openChatPanel(node.id);
    },
    [openChatPanel]
  );

  // Handle canvas click (deselect and close chat panel)
  const handlePaneClick = useCallback(() => {
    // Close chat panel (also clears selection and active conversation)
    closeChatPanel();
  }, [closeChatPanel]);

  // Handle connection drag end - create new card if dropped on empty canvas
  // Uses React Flow v12 connectionState API
  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      // Check if we had an active connection (fromNode will be set)
      // and if we dropped on empty canvas (toHandle will be null)
      // Also ensure we have a valid drop position
      if (connectionState.fromNode && !connectionState.toHandle && connectionState.to) {
        const targetIsPane = (event.target as Element)?.classList?.contains('react-flow__pane');
        
        if (targetIsPane) {
          // Use the drop position from connectionState (already in flow coordinates)
          const sourceNodeId = connectionState.fromNode.id;
          const dropPosition = connectionState.to;

          // Open branch dialog with the target position
          openBranchDialog(sourceNodeId, undefined, dropPosition);
        }
      }
    },
    [openBranchDialog]
  );

  // Handle creating a new conversation
  const handleAddConversation = useCallback((
    explicitPosition?: { x: number; y: number },
    options?: { workspaceId?: string; openChat?: boolean }
  ) => {
    const workspaceId = options?.workspaceId ?? activeWorkspaceId;
    if (!workspaceId) return;

    let position = explicitPosition || canvasClickPosition;

    // If no click position (keyboard shortcut), use center of viewport
    if (!position && reactFlowInstance.current) {
      const viewport = reactFlowInstance.current.getViewport();
      const centerX = -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom;
      const centerY = -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom;
      position = { x: centerX, y: centerY };
    }

    const finalPosition = position || { x: 0, y: 0 };

    createConversationCard(workspaceId, finalPosition, {
      openChat: options?.openChat ?? true,
    });
    setCanvasClickPosition(null);
  }, [canvasClickPosition, activeWorkspaceId, createConversationCard]);

  const openWorkspaceNameModal = useCallback((suggestedName: string) => {
    setWorkspaceNameModal({ suggestedName });
  }, []);

  const closeWorkspaceNameModal = useCallback(() => {
    setWorkspaceNameModal(null);
  }, []);

  const confirmWorkspaceName = useCallback((name: string) => {
    const workspace = createWorkspace(name);
    navigateToWorkspace(workspace.id);
    handleAddConversation(undefined, {
      workspaceId: workspace.id,
      openChat: true,
    });
    setWorkspaceNameModal(null);
  }, [createWorkspace, navigateToWorkspace, handleAddConversation]);

  const handleCreateWorkspace = useCallback(() => {
    const suggestedName = workspaces.length === 0
      ? 'My First Workspace'
      : `New Workspace ${workspaces.length + 1}`;
    openWorkspaceNameModal(suggestedName);
  }, [openWorkspaceNameModal, workspaces.length]);

  // Handle canvas right-click (context menu)
  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();

      // Cast to get client coordinates - both MouseEvent types have these properties
      const clientX = event.clientX;
      const clientY = event.clientY;

      // Get the canvas position where the user clicked
      let clickPosition: { x: number; y: number } | null = null;
      if (reactFlowInstance.current) {
        const flowPosition = reactFlowInstance.current.screenToFlowPosition({
          x: clientX,
          y: clientY,
        });
        clickPosition = { x: flowPosition.x, y: flowPosition.y };
        setCanvasClickPosition(clickPosition);
      }

      // Open context menu with canvas options
      const menuItems: ContextMenuItem[] = [
        {
          id: 'add-conversation',
          label: 'Add Conversation',
          shortcut: 'N',
          onClick: () => {
            if (clickPosition) {
              handleAddConversation(clickPosition);
            }
            canvasContextMenu.closeMenu();
          },
        },
      ];

      // Create a synthetic React.MouseEvent-like object for the openMenu call
      canvasContextMenu.openMenu({
        clientX,
        clientY,
        preventDefault: () => {},
        stopPropagation: () => {},
      }, menuItems);
    },
    [canvasContextMenu, handleAddConversation]
  );

  // Handle React Flow initialization
  const handleInit = useCallback((instance: ReactFlowInstance<Node<ConversationNodeData>, Edge>) => {
    reactFlowInstance.current = instance;

    // Fit view on mount with padding and animation
    setTimeout(() => {
      instance.fitView({
        padding: canvasConfig.viewport.fitViewPadding,
        duration: animation.duration.slow,
      });
    }, 100);
  }, []);

  // Handle node drag start
  const handleNodeDragStart = useCallback(() => {
    useCanvasStore.getState().setIsAnyNodeDragging(true);
  }, []);

  // Handle node drag stop
  const handleNodeDragStop = useCallback(() => {
    useCanvasStore.getState().setIsAnyNodeDragging(false);
  }, []);

  // Get first selected ID for keyboard shortcut handling
  const firstSelectedId = useMemo(() => {
    const ids = Array.from(selectedNodeIds);
    return ids.length > 0 ? ids[0] : null;
  }, [selectedNodeIds]);

  const isModalOpen = useMemo(() => (
    settingsOpen
    || canvasContextOpen
    || agentDialogOpen
    || branchDialogOpen
    || hierarchicalMergeDialogOpen
    || Boolean(deleteWorkspaceModal)
    || pendingDeleteConversationIds.length > 0
  ), [
    settingsOpen,
    canvasContextOpen,
    agentDialogOpen,
    branchDialogOpen,
    hierarchicalMergeDialogOpen,
    deleteWorkspaceModal,
    pendingDeleteConversationIds.length,
  ]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: !isModalOpen,
    handlers: {
      onDelete: () => {
        const selectedIds = Array.from(selectedNodeIds);
        if (selectedIds.length === 0) {
          if (!activeWorkspaceId) return;
          requestDeleteWorkspace(activeWorkspaceId);
          return;
        }
        
        if (uiPrefs.confirmOnDelete) {
          requestDeleteConversation(selectedIds);
          return;
        }

        selectedIds.forEach(id => deleteConversation(id));
      },
      onEscape: () => {
        // Priority: Close chat panel first, then deselect
        if (usagePanelOpen) {
          closeUsagePanel();
        } else if (chatPanelOpen) {
          closeChatPanel();
        } else {
          clearSelection();
        }
      },
      onUndo: () => {
        if (canUndo()) {
          undo();
        }
      },
      onRedo: () => {
        if (canRedo()) {
          redo();
        }
      },
      onExpand: () => {
        // Space or Enter: Open chat panel for first selected card
        if (firstSelectedId) {
          openChatPanel(firstSelectedId);
        }
      },
      onOpenChat: () => {
        // Enter: Open chat panel for first selected card
        if (firstSelectedId) {
          openChatPanel(firstSelectedId);
        }
      },
      onBranch: () => {
        // Ctrl+B: Branch from first selected card
        if (firstSelectedId) {
          // Check preference: should we show dialog or create instantly?
          if (branchingPrefs.alwaysAskOnBranch) {
            // Show dialog for user to configure
            openBranchDialog(firstSelectedId);
          } else {
            // Create branch instantly with default settings using v4 API
            branchFromMessage({
              sourceCardId: firstSelectedId,
              messageIndex: 0, // Branch from first message by default
              inheritanceMode: branchingPrefs.defaultInheritanceMode,
              branchReason: 'Quick branch',
            });
          }
        }
      },
      onAddConversation: () => {
        // N: Add new conversation at center of viewport
        handleAddConversation();
      },
      // View controls
      onZoomIn: () => {
        reactFlowInstance.current?.zoomIn({ duration: 200 });
      },
      onZoomOut: () => {
        reactFlowInstance.current?.zoomOut({ duration: 200 });
      },
      onFitView: () => {
        reactFlowInstance.current?.fitView({
          padding: canvasConfig.viewport.fitViewPadding,
          duration: 400,
        });
      },
      onResetZoom: () => {
        reactFlowInstance.current?.setViewport(
          { x: 0, y: 0, zoom: 1 },
          { duration: 400 }
        );
      },
      // Selection
      onSelectAll: () => {
        const allIds = Array.from(useCanvasStore.getState().conversations.keys());
        setSelected(allIds);
      },
      // Search
      onSearch: () => {
        useSearchStore.getState().openSearch();
      },
      // Layout
      onSuggestLayout: () => {
        const currentNodes = reactFlowInstance.current?.getNodes() ?? [];
        const currentEdges = reactFlowInstance.current?.getEdges() ?? [];
        
        if (currentNodes.length === 0) {
          useToastStore.getState().info('Add some cards first to organize them.');
          return;
        }
        
        // Try tree layout first (respects hierarchy), fall back to spread
        const result = treeLayout(currentNodes, currentEdges);
        
        if (!result.hasChanges) {
          useToastStore.getState().success('Cards are already well organized!');
          return;
        }
        
        applyLayout(result.positions);
        useToastStore.getState().success(`Organized ${currentNodes.length} cards.`);
      },
    },
  });

  // Canvas context modal handlers
  const openCanvasContext = useCallback(() => setCanvasContextOpen(true), []);
  const closeCanvasContext = useCallback(() => setCanvasContextOpen(false), []);

  // Agent dialog handlers
  const openAgents = useCallback(() => setAgentDialogOpen(true), []);
  const closeAgents = useCallback(() => setAgentDialogOpen(false), []);

  // Focus on a specific node with smooth animation
  const focusOnNode = useCallback((nodeId: string) => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.fitView({
        padding: 0.2,
        duration: 800,
        nodes: [{ id: nodeId }],
      });
    }
  }, []);

  return (
    <div style={containerStyles}>
      {/* Canvas Tree Sidebar (conditionally shown after prefs loaded) */}
      {isPrefsLoaded && uiPrefs.showCanvasTree && (
        <CanvasTreeSidebar 
          onOpenSettings={openSettings}
          onOpenAgents={openAgents}
          onToggleUsagePanel={toggleUsagePanel}
          isUsagePanelOpen={usagePanelOpen}
          onRequestDeleteWorkspace={requestDeleteWorkspace}
          onRequestCreateWorkspace={openWorkspaceNameModal}
          isOpen={isSidebarOpen}
          onToggle={setIsSidebarOpen}
          onFocusNode={focusOnNode}
        />
      )}

      {/* Main content area */}
      <div style={mainContentStyles}>
        {!currentWorkspace ? (
          <div style={emptyStateStyles}>
            <div style={emptyCardStyles}>
              <h2
                style={{
                  margin: 0,
                  fontSize: typography.sizes.lg,
                  fontFamily: typography.fonts.heading,
                  color: colors.fg.primary,
                }}
              >
                Create your first canvas
              </h2>
              <p
                style={{
                  marginTop: spacing[2],
                  marginBottom: spacing[4],
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  color: colors.fg.secondary,
                }}
              >
                Start a new workspace to organize conversations and context.
              </p>
              <button
                onClick={handleCreateWorkspace}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: spacing[2],
                  padding: `${spacing[2]} ${spacing[4]}`,
                  backgroundColor: colors.accent.primary,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: colors.bg.inset,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
                Create Workspace
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Top overlay for breadcrumb and inherited context */}
            <div style={topOverlayStyles}>
              {/* Breadcrumb navigation */}
              <div style={pointerEventsAutoStyle}>
                <CanvasBreadcrumb 
                  showSidebarToggle={!isSidebarOpen}
                  onToggleSidebar={() => setIsSidebarOpen(true)}
                  onOpenCanvasContext={openCanvasContext}
                  onFocusNode={focusOnNode}
                />
              </div>

              {/* Inherited context panel (shown when enabled - cards handle their own parent check) */}
              {isPrefsLoaded && uiPrefs.showInheritedContext && (
                <div style={pointerEventsAutoStyle}>
                  <InheritedContextPanel />
                </div>
              )}
            </div>

            <div style={canvasStyles}>
              <ReactFlow<Node<ConversationNodeData>, Edge>
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onConnectEnd={handleConnectEnd}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onNodeDragStart={handleNodeDragStart}
                onNodeDragStop={handleNodeDragStop}
                onPaneClick={handlePaneClick}
                onPaneContextMenu={handlePaneContextMenu}
                onInit={handleInit}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                connectionLineStyle={connectionLineStyle}
                connectionLineComponent={CustomConnectionLine}
                minZoom={canvasConfig.viewport.minZoom}
                maxZoom={canvasConfig.viewport.maxZoom}
                defaultViewport={defaultViewport}
                fitView={false}
                onlyRenderVisibleElements={true}
                nodesDraggable={true}
                nodesConnectable={true}
                panOnDrag={true}
                panOnScroll={false}
                zoomOnScroll={true}
                zoomOnPinch={true}
                zoomOnDoubleClick={false}
                selectionOnDrag={true}
                selectNodesOnDrag={false}
                snapToGrid={false}
                deleteKeyCode={null}
                multiSelectionKeyCode="Shift"
              >
                {/* Dot grid background */}
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={canvasConfig.background.dotGap}
                  size={canvasConfig.background.dotSize}
                  color={canvasConfig.background.dotColor}
                />

                {/* Minimap */}
                <MiniMap
                  style={minimapStyle}
                  nodeColor={canvasConfig.minimap.nodeColor}
                  maskColor={canvasConfig.minimap.maskColor}
                  zoomable
                  pannable
                />

                {/* Viewport controls */}
                <Controls
                  showZoom={true}
                  showFitView={true}
                  showInteractive={false}
                  style={controlsStyle}
                />

                {/* Canvas Search */}
                <CanvasSearch />
              </ReactFlow>

              {/* Dev performance overlay */}
              {showDevOverlay && (
                <DevPerformanceOverlay
                  nodeCount={nodes.length}
                  edgeCount={edges.length}
                />
              )}

              {/* Branch Dialog */}
              <BranchDialog />

              {/* Canvas Context Menu */}
              <ContextMenu
                isOpen={canvasContextMenu.isOpen}
                position={canvasContextMenu.position}
                items={canvasContextMenu.dynamicItems}
                onClose={canvasContextMenu.closeMenu}
              />

              {/* Undo Toast for branch/merge actions */}
              <UndoToast />
            </div>
          </>
        )}
      </div>

      {/* Settings Panel */}
      <SettingsPanel isOpen={settingsOpen} onClose={closeSettings} />

      {/* Canvas Context Modal */}
      <CanvasContextModal isOpen={canvasContextOpen} onClose={closeCanvasContext} />

      {/* Agent Dialog */}
      <AgentDialog isOpen={agentDialogOpen} onClose={closeAgents} />

      <WorkspaceNameModal
        isOpen={Boolean(workspaceNameModal)}
        suggestedName={workspaceNameModal?.suggestedName ?? ''}
        onConfirm={confirmWorkspaceName}
        onClose={closeWorkspaceNameModal}
      />

      {deleteWorkspaceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={cancelDeleteWorkspace}
        >
          <div
            style={{
              backgroundColor: colors.bg.secondary,
              borderRadius: effects.border.radius.md,
              border: `1px solid ${colors.border.default}`,
              boxShadow: effects.shadow.lg,
              width: '90%',
              maxWidth: 420,
              padding: spacing[4],
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[3],
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: typography.sizes.lg,
                  fontFamily: typography.fonts.heading,
                  color: colors.fg.primary,
                }}
              >
                {deleteWorkspaceModal.step === 'warn'
                  ? `Delete "${deleteWorkspaceModal.label}"?`
                  : 'Final confirmation'}
              </h3>
              {deleteWorkspaceModal.step === 'warn' ? (
                <>
                  <p
                    style={{
                      marginTop: spacing[2],
                      fontSize: typography.sizes.sm,
                      fontFamily: typography.fonts.body,
                      color: colors.fg.secondary,
                    }}
                  >
                    This will permanently delete:
                  </p>
                  <ul
                    style={{
                      margin: `${spacing[2]} 0 0 0`,
                      paddingLeft: spacing[4],
                      fontSize: typography.sizes.sm,
                      fontFamily: typography.fonts.body,
                      color: colors.fg.secondary,
                    }}
                  >
                    <li>All conversations</li>
                    <li>Uploaded files</li>
                    <li>Canvas settings</li>
                  </ul>
                </>
              ) : (
                <>
                  <p
                    style={{
                      marginTop: spacing[2],
                      fontSize: typography.sizes.sm,
                      fontFamily: typography.fonts.body,
                      color: colors.fg.secondary,
                    }}
                  >
                    Type DELETE to confirm this action. This cannot be undone.
                  </p>
                  <input
                    value={deleteWorkspaceModal.confirmText}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      setDeleteWorkspaceModal((prev) => prev ? { ...prev, confirmText: value } : prev);
                    }}
                    placeholder="DELETE"
                    style={{
                      marginTop: spacing[2],
                      width: '100%',
                      padding: `${spacing[2]} ${spacing[3]}`,
                      backgroundColor: colors.bg.inset,
                      border: `1px solid ${colors.border.default}`,
                      borderRadius: effects.border.radius.default,
                      color: colors.fg.primary,
                      fontSize: typography.sizes.sm,
                      fontFamily: typography.fonts.body,
                      outline: 'none',
                    }}
                  />
                </>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing[2] }}>
              <button
                onClick={cancelDeleteWorkspace}
                style={{
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.border.default}`,
                  borderRadius: effects.border.radius.default,
                  color: colors.fg.primary,
                  padding: `${spacing[2]} ${spacing[3]}`,
                  cursor: 'pointer',
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWorkspace}
                style={{
                  backgroundColor: colors.semantic.error,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: colors.bg.secondary,
                  padding: `${spacing[2]} ${spacing[3]}`,
                  cursor: 'pointer',
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  opacity: deleteWorkspaceModal.step === 'confirm' && deleteWorkspaceModal.confirmText !== 'DELETE' ? 0.6 : 1,
                }}
                disabled={deleteWorkspaceModal.step === 'confirm' && deleteWorkspaceModal.confirmText !== 'DELETE'}
              >
                {deleteWorkspaceModal.step === 'warn' ? 'Continue' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteConversationIds.length > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={cancelDeleteConversation}
        >
          <div
            style={{
              backgroundColor: colors.bg.secondary,
              borderRadius: effects.border.radius.md,
              border: `1px solid ${colors.border.default}`,
              boxShadow: effects.shadow.lg,
              width: '90%',
              maxWidth: 420,
              padding: spacing[4],
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[3],
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: typography.sizes.lg,
                  fontFamily: typography.fonts.heading,
                  color: colors.fg.primary,
                }}
              >
                {`Delete "${deleteConversationLabel}"?`}
              </h3>
              <p
                style={{
                  marginTop: spacing[2],
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  color: colors.fg.secondary,
                }}
              >
                This will permanently delete the selected conversation{pendingDeleteConversationIds.length > 1 ? 's' : ''}.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing[2] }}>
              <button
                onClick={cancelDeleteConversation}
                style={{
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.border.default}`,
                  borderRadius: effects.border.radius.default,
                  color: colors.fg.primary,
                  padding: `${spacing[2]} ${spacing[3]}`,
                  cursor: 'pointer',
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteConversation}
                style={{
                  backgroundColor: colors.semantic.error,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: colors.bg.secondary,
                  padding: `${spacing[2]} ${spacing[3]}`,
                  cursor: 'pointer',
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel (right side) */}
      <ChatPanel />

      {/* Usage Sidebar (right side) */}
      <UsageSidebar />
    </div>
  );
}

export default InfiniteCanvas;
