/**
 * MultiSelectFloatingBar
 *
 * Floating action bar that appears when 2+ conversation cards are selected.
 * Provides a "Merge" button that creates a merge node from the selected cards.
 *
 * Positioned at the midpoint above the selected nodes on the canvas.
 */

'use client';

import React, { useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { analytics } from '@/lib/analytics';
import { useCanvasStore } from '@/stores/canvas-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { colors, typography, effects } from '@/lib/design-tokens';
import { zIndex } from '@/constants/zIndex';
import { canMergeSelectedCards } from '@/lib/onboarding-guards';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Vertical offset above the topmost selected node (in screen px) */
const FLOAT_OFFSET_Y = 56;
const MERGE_CARD_OFFSET_X = 300;

// =============================================================================
// COMPONENT
// =============================================================================

export function MultiSelectFloatingBar() {
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const nodes = useCanvasStore((s) => s.nodes);
  const conversations = useCanvasStore((s) => s.conversations);
  const createMergeNode = useCanvasStore((s) => s.createMergeNode);
  const openChatPanel = useCanvasStore((s) => s.openChatPanel);
  const requestFocusNode = useCanvasStore((s) => s.requestFocusNode);
  const setDraftMessage = useCanvasStore((s) => s.setDraftMessage);
  const reactFlow = useReactFlow();
  const onboardingActive = useOnboardingStore((s) => s.active);
  const onboardingStep = useOnboardingStore((s) => s.step);
  const onboardingRootCardId = useOnboardingStore((s) => s.rootCardId);
  const onboardingBranch1CardId = useOnboardingStore((s) => s.branch1CardId);
  const onboardingBranch2CardId = useOnboardingStore((s) => s.branch2CardId);

  const selectedIds = useMemo(() => Array.from(selectedNodeIds), [selectedNodeIds]);

  // Calculate screen-space midpoint of selected nodes
  const barPosition = useMemo(() => {
    if (selectedIds.length < 2) return null;

    const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id));
    if (selectedNodes.length < 2) return null;

    // Find bounding box in flow coordinates
    let minX = Infinity, maxX = -Infinity, minY = Infinity;
    for (const node of selectedNodes) {
      const x = node.position.x;
      const y = node.position.y;
      const w = node.measured?.width ?? 280;
      if (x < minX) minX = x;
      if (x + w > maxX) maxX = x + w;
      if (y < minY) minY = y;
    }

    // Convert flow center-top to screen coordinates
    const centerFlow = { x: (minX + maxX) / 2, y: minY };
    const screenPos = reactFlow.flowToScreenPosition(centerFlow);

    return {
      x: screenPos.x,
      y: screenPos.y - FLOAT_OFFSET_Y,
    };
  }, [selectedIds, nodes, reactFlow]);

  const handleMerge = useCallback(() => {
    if (selectedIds.length < 2) return;
    if (!canMergeSelectedCards({
      active: onboardingActive,
      step: onboardingStep,
      rootCardId: onboardingRootCardId,
      branch1CardId: onboardingBranch1CardId,
      branch2CardId: onboardingBranch2CardId,
    }, selectedIds)) return;

    // Calculate merge position — to the right of the rightmost selected node
    const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id));
    let maxX = -Infinity, avgY = 0;
    for (const node of selectedNodes) {
      const x = node.position.x + (node.measured?.width ?? 280);
      if (x > maxX) maxX = x;
      avgY += node.position.y;
    }
    avgY /= selectedNodes.length;

    const mergePosition = { x: maxX + MERGE_CARD_OFFSET_X, y: avgY };

    const mergeNode = createMergeNode({
      sourceCardIds: selectedIds,
      position: mergePosition,
    });

    if (mergeNode) {
      analytics.mergeCompleted(selectedIds.length);

      // Auto-fill a synthesis prompt so the user just hits send
      const cardTitles = selectedIds
        .map((id) => conversations.get(id)?.metadata.title)
        .filter(Boolean);

      const autoPrompt = cardTitles.length === 2
        ? `I explored "${cardTitles[0]}" and "${cardTitles[1]}" as separate directions. Compare the two paths and synthesize the key tradeoffs into a recommendation.`
        : `I explored these ${cardTitles.length} directions separately: ${cardTitles.map((t) => `"${t}"`).join(', ')}. Synthesize the key findings and give me a final recommendation.`;

      setDraftMessage(mergeNode.id, autoPrompt);

      // Open the chat panel for the new merge card
      openChatPanel(mergeNode.id);
      requestFocusNode(mergeNode.id);
    }
  }, [
    selectedIds,
    nodes,
    conversations,
    createMergeNode,
    openChatPanel,
    requestFocusNode,
    setDraftMessage,
    onboardingActive,
    onboardingStep,
    onboardingRootCardId,
    onboardingBranch1CardId,
    onboardingBranch2CardId,
  ]);

  const canMerge = canMergeSelectedCards({
    active: onboardingActive,
    step: onboardingStep,
    rootCardId: onboardingRootCardId,
    branch1CardId: onboardingBranch1CardId,
    branch2CardId: onboardingBranch2CardId,
  }, selectedIds);
  const show = selectedIds.length >= 2 && barPosition !== null && canMerge;

  const bar = (
    <AnimatePresence>
      {show && barPosition && (
        <motion.div
          key="multi-select-bar"
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            left: barPosition.x,
            top: barPosition.y,
            transform: 'translate(-50%, 0)',
            zIndex: zIndex.ui.floatingBar,
            pointerEvents: 'auto',
          }}
        >
          <div style={styles.bar}>
            <span style={styles.label}>
              {selectedIds.length} cards selected
            </span>
            <button data-onboarding="merge-button" onClick={handleMerge} style={styles.mergeBtn}>
              <GitMerge size={14} />
              Merge
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render into document.body to escape React Flow's CSS-transform stacking
  // context, which otherwise blocks pointer events on the fixed-position bar.
  return typeof document !== 'undefined' ? createPortal(bar, document.body) : null;
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 8px 8px 16px',
    borderRadius: 14,
    backgroundColor: colors.bg.secondary,
    border: `1px solid ${colors.border.default}`,
    boxShadow: effects.shadow.lg,
    whiteSpace: 'nowrap' as const,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
    color: colors.fg.secondary,
    fontWeight: typography.weights.medium,
  },
  mergeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: colors.accent.primary,
    color: colors.accent.contrast,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.body,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
};
