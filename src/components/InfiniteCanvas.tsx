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

import { colors, canvas as canvasConfig, animation } from '@/lib/design-tokens';
import { logger } from '@/lib/logger';
import type { ConversationNodeData, Conversation, Message } from '@/types';
import { ConversationCard } from './ConversationCard';
import { CustomConnectionLine } from './CustomConnectionLine';
import DevPerformanceOverlay from './DevPerformanceOverlay';
import { CanvasSearch } from './CanvasSearch';
import { useSearchStore } from '@/stores/search-store';
import { getOverlapCount, spreadLayout, treeLayout } from '@/lib/layout-utils';
import { useToastStore } from '@/stores/toast-store';
import { UndoToast } from './UndoToast';
import { BranchDialog } from './BranchDialog';
import { InheritedContextPanel } from './InheritedContextPanel';
import { CanvasBreadcrumb } from './CanvasBreadcrumb';
import { CanvasTreeSidebar } from './CanvasTreeSidebar';
import { APIKeyWarningBanner } from './APIKeyWarningBanner';
import { SettingsPanel } from './SettingsPanel';
import { AgentDialog } from './AgentDialog';
import { ChatPanel } from './ChatPanel';
import { ContextMenu, useContextMenu, ContextMenuItem } from './ContextMenu';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useCanvasStore, selectBranchDialogOpen, selectChatPanelOpen } from '@/stores/canvas-store';
import { usePreferencesStore, selectUIPreferences, selectBranchingPreferences } from '@/stores/preferences-store';
import { nanoid } from 'nanoid';

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

// =============================================================================
// INFINITE CANVAS COMPONENT
// =============================================================================

export function InfiniteCanvas() {
  const reactFlowInstance = useRef<ReactFlowInstance<Node<ConversationNodeData>, Edge> | null>(null);

  // Settings panel state
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    expandedNodeIds,
    activeWorkspaceId,
    workspaces,
  } = useCanvasStore(useShallow((s) => ({
    nodes: s.nodes,
    edges: s.edges,
    selectedNodeIds: s.selectedNodeIds,
    expandedNodeIds: s.expandedNodeIds,
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
  const createMergeNode = useCanvasStore((s) => s.createMergeNode);
  const navigateToWorkspace = useCanvasStore((s) => s.navigateToWorkspace);
  const addConversation = useCanvasStore((s) => s.addConversation);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const applyLayout = useCanvasStore((s) => s.applyLayout);

  // Chat panel state
  const chatPanelOpen = useCanvasStore(selectChatPanelOpen);
  const openChatPanel = useCanvasStore((s) => s.openChatPanel);
  const closeChatPanel = useCanvasStore((s) => s.closeChatPanel);

  // Branch dialog state
  const branchDialogOpen = useCanvasStore(selectBranchDialogOpen);

  // Current workspace context (v4 - flat)
  const currentWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  // UI Preferences
  const uiPrefs = usePreferencesStore(selectUIPreferences);
  const branchingPrefs = usePreferencesStore(selectBranchingPreferences);
  const isPrefsLoaded = usePreferencesStore((s) => s.isLoaded);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const showDevOverlay = process.env.NODE_ENV === 'development';

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
    // Use React Flow instance to ensure proper deselection
    if (reactFlowInstance.current) {
      const currentNodes = reactFlowInstance.current.getNodes();
      const hasSelectedNodes = currentNodes.some((node) => node.selected);
      
      if (hasSelectedNodes) {
        // Explicitly clear selection through React Flow's state management
        reactFlowInstance.current.setNodes(
          currentNodes.map((node) => ({
            ...node,
            selected: false,
          })) as Node<ConversationNodeData>[]
        );
      }
    }
    
    // Close chat panel (which also clears our internal selection state)
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
  const handleAddConversation = useCallback((explicitPosition?: { x: number; y: number }) => {
    let position = explicitPosition || canvasClickPosition;

    // If no click position (keyboard shortcut), use center of viewport
    if (!position && reactFlowInstance.current) {
      const viewport = reactFlowInstance.current.getViewport();
      const centerX = -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom;
      const centerY = -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom;
      position = { x: centerX, y: centerY };
    }

    const finalPosition = position || { x: 0, y: 0 };

    // Create a new empty conversation (v4 with card-level branching fields)
    const newConversation: Conversation = {
      id: nanoid(),
      canvasId: activeWorkspaceId,
      position: finalPosition,
      content: [
        {
          id: nanoid(),
          role: 'user',
          content: 'New conversation - click to edit',
          timestamp: new Date(),
        } as Message,
      ],
      connections: [],
      // v4 card-level branching
      parentCardIds: [],
      inheritedContext: {},
      isMergeNode: false,
      metadata: {
        title: 'New Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 1,
        tags: [],
        isExpanded: false,
      },
    };

    addConversation(newConversation, finalPosition);
    setCanvasClickPosition(null);
  }, [canvasClickPosition, activeWorkspaceId, addConversation]);

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
      canvasContextMenu.openMenu({ clientX, clientY, preventDefault: () => {} } as React.MouseEvent, menuItems);
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

  const firstExpandedId = useMemo(() => {
    const ids = Array.from(expandedNodeIds);
    return ids.length > 0 ? ids[0] : null;
  }, [expandedNodeIds]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: true,
    handlers: {
      onDelete: () => {
        const selectedIds = Array.from(selectedNodeIds);
        if (selectedIds.length === 0) return;
        
        if (selectedIds.length === 1) {
          // Single deletion
          if (uiPrefs.confirmOnDelete) {
            if (window.confirm('Delete this conversation?')) {
              deleteConversation(selectedIds[0]);
            }
          } else {
            deleteConversation(selectedIds[0]);
          }
        } else {
          // Multi-select deletion - always confirm
          if (window.confirm(`Delete ${selectedIds.length} conversations?`)) {
            selectedIds.forEach(id => deleteConversation(id));
          }
        }
      },
      onEscape: () => {
        // Priority: Close chat panel first, then deselect
        if (chatPanelOpen) {
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

  // Settings panel handlers (memoized to prevent re-renders)
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

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
          isOpen={isSidebarOpen}
          onToggle={setIsSidebarOpen}
          onFocusNode={focusOnNode}
        />
      )}

      {/* Main content area */}
      <div style={mainContentStyles}>
        {/* Top overlay for breadcrumb and inherited context */}
        <div style={topOverlayStyles}>
          {/* Breadcrumb navigation */}
          <div style={pointerEventsAutoStyle}>
            <CanvasBreadcrumb 
              showSidebarToggle={!isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen(true)}
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

          {/* API Key Warning Banner */}
          <APIKeyWarningBanner position="bottom" />

          {/* Settings Panel */}
          <SettingsPanel isOpen={settingsOpen} onClose={closeSettings} />

          {/* Agent Dialog */}
          <AgentDialog isOpen={agentDialogOpen} onClose={closeAgents} />

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
      </div>

      {/* Chat Panel (right side) */}
      <ChatPanel onFocusNode={focusOnNode} />
    </div>
  );
}

export default InfiniteCanvas;
