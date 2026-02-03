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
  OnNodesChange,
  OnEdgesChange,
  ReactFlowInstance,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { colors, canvas as canvasConfig, animation } from '@/lib/design-tokens';
import type { ConversationNodeData } from '@/types';
import { ConversationCard } from './ConversationCard';
import { CustomConnectionLine } from './CustomConnectionLine';
import DevPerformanceOverlay from './DevPerformanceOverlay';
import { BranchDialog } from './BranchDialog';
import { InheritedContextPanel } from './InheritedContextPanel';
import { CanvasBreadcrumb } from './CanvasBreadcrumb';
import { CanvasTreeSidebar } from './CanvasTreeSidebar';
import { APIKeyWarningBanner } from './APIKeyWarningBanner';
import { SettingsPanel, SettingsButton } from './SettingsPanel';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useCanvasStore, selectBranchDialogOpen } from '@/stores/canvas-store';
import { usePreferencesStore, selectUIPreferences } from '@/stores/preferences-store';

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

const canvasStyles: React.CSSProperties = {
  width: '100%',
  height: '100%',
  backgroundColor: canvasConfig.background.color,
};

const connectionLineStyle: React.CSSProperties = {
  stroke: colors.violet.primary,
  strokeWidth: 2,
};

// =============================================================================
// INFINITE CANVAS COMPONENT
// =============================================================================

export function InfiniteCanvas() {
  const reactFlowInstance = useRef<ReactFlowInstance<Node<ConversationNodeData>, Edge> | null>(null);

  // Settings panel state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Get data and actions from store
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const toggleExpanded = useCanvasStore((s) => s.toggleExpanded);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const deleteConversation = useCanvasStore((s) => s.deleteConversation);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const expandedNodeIds = useCanvasStore((s) => s.expandedNodeIds);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);

  // Branch dialog state
  const branchDialogOpen = useCanvasStore(selectBranchDialogOpen);

  // Current canvas context
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const getCurrentCanvas = useCanvasStore((s) => s.getCurrentCanvas);
  const getCanvasLineage = useCanvasStore((s) => s.getCanvasLineage);
  const currentCanvas = getCurrentCanvas();
  const hasParent = currentCanvas?.parentCanvasId !== undefined;

  // UI Preferences
  const uiPrefs = usePreferencesStore(selectUIPreferences);
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

  // Handle new connections
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      onConnect(connection);
    },
    [onConnect]
  );

  // Handle node selection
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelected([node.id]);
    },
    [setSelected]
  );

  // Handle node double-click for expansion
  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      toggleExpanded(node.id);
    },
    [toggleExpanded]
  );

  // Handle canvas click (deselect)
  const handlePaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

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
        if (firstSelectedId) {
          deleteConversation(firstSelectedId);
        }
      },
      onEscape: () => {
        // Collapse expanded card first, then deselect
        if (firstExpandedId) {
          toggleExpanded(firstExpandedId);
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
    },
  });

  return (
    <div style={canvasStyles}>
      {/* Canvas Tree Sidebar (conditionally shown) */}
      {uiPrefs.showCanvasTree && <CanvasTreeSidebar />}

      {/* Main canvas area with breadcrumb and inherited context */}
      <div style={{ 
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
      }}>
        {/* Breadcrumb navigation */}
        <div style={{ pointerEvents: 'auto' }}>
          <CanvasBreadcrumb />
        </div>

        {/* Inherited context panel (shown when canvas has parent and enabled) */}
        {uiPrefs.showInheritedContext && hasParent && (
          <div style={{ pointerEvents: 'auto' }}>
            <InheritedContextPanel />
          </div>
        )}
      </div>

      <ReactFlow<Node<ConversationNodeData>, Edge>
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        onInit={handleInit}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={connectionLineStyle}
        connectionLineComponent={CustomConnectionLine}
        minZoom={canvasConfig.viewport.minZoom}
        maxZoom={canvasConfig.viewport.maxZoom}
        defaultViewport={{ x: 0, y: 0, zoom: canvasConfig.viewport.defaultZoom }}
        fitView={false}
        onlyRenderVisibleElements={true}
        nodesDraggable={true}
        nodesConnectable={true}
        panOnDrag={true}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
        selectNodesOnDrag={false}
        snapToGrid={false}
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
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
          style={{
            backgroundColor: canvasConfig.minimap.backgroundColor,
            width: canvasConfig.minimap.width,
            height: canvasConfig.minimap.height,
          }}
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
          style={{
            backgroundColor: colors.navy.light,
            borderColor: colors.navy.hover,
          }}
        />
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

      {/* Settings Button and Panel */}
      <SettingsButton onClick={() => setSettingsOpen(true)} />
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default InfiniteCanvas;
