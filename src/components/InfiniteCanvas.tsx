'use client';

import React, { useCallback, useRef, useMemo, useEffect } from 'react';
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
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useCanvasStore } from '@/stores/canvas-store';

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
    </div>
  );
}

export default InfiniteCanvas;
