/**
 * AgentConfirmationDialog Component
 * 
 * Shows the agent's proposed actions for user review.
 * Users can approve/reject individual actions before execution.
 * Destructive actions (delete) are highlighted in red.
 * 
 * @version 1.0.0
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, Trash2, Edit3, GitBranch, FileText, Check, X } from 'lucide-react';

import { useCanvasStore } from '@/stores/canvas-store';
import { useToastStore } from '@/stores/toast-store';
import { colors, spacing, effects, typography } from '@/lib/design-tokens';
import { enforceTitleWordLimit } from '@/utils/formatters';
import type { AgentRunResult, AgentAction } from '@/lib/agents/types';

// =============================================================================
// STYLES
// =============================================================================

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'var(--bg-overlay)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const dialogStyles: React.CSSProperties = {
  backgroundColor: colors.bg.secondary,
  borderRadius: effects.border.radius.md,
  border: '1px solid var(--border-primary)',
  boxShadow: effects.shadow.lg,
  width: '90%',
  maxWidth: '600px',
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

// =============================================================================
// HELPERS
// =============================================================================

function getActionIcon(type: AgentAction['type']) {
  switch (type) {
    case 'delete': return <Trash2 size={16} color={colors.semantic.error} />;
    case 'rename': return <Edit3 size={16} color={colors.accent.primary} />;
    case 'create_branch': return <GitBranch size={16} color={colors.semantic.success} />;
    case 'create_document': return <FileText size={16} color={colors.accent.primary} />;
    default: return null;
  }
}

function getActionColor(type: AgentAction['type']): string {
  switch (type) {
    case 'delete': return colors.semantic.error;
    case 'rename': return colors.accent.primary;
    case 'create_branch': return colors.semantic.success;
    case 'create_document': return colors.accent.primary;
    default: return colors.fg.tertiary;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

interface AgentConfirmationDialogProps {
  result: AgentRunResult;
  onComplete: () => void;
  onCancel: () => void;
}

export function AgentConfirmationDialog({ result, onComplete, onCancel }: AgentConfirmationDialogProps) {
  const [approvals, setApprovals] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    result.actions.forEach((action) => {
      // Auto-approve non-destructive actions, require explicit approval for destructive
      initial[action.id] = action.type !== 'delete';
    });
    return initial;
  });
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);

  // Store actions
  const deleteConversation = useCanvasStore((s) => s.deleteConversation);
  const conversations = useCanvasStore((s) => s.conversations);
  const toast = useToastStore((s) => s);

  // Toggle individual action
  const toggleApproval = useCallback((actionId: string) => {
    setApprovals((prev) => ({
      ...prev,
      [actionId]: !prev[actionId],
    }));
  }, []);

  // Approve all
  const approveAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    result.actions.forEach((action) => {
      all[action.id] = true;
    });
    setApprovals(all);
  }, [result.actions]);

  // Reject all
  const rejectAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    result.actions.forEach((action) => {
      all[action.id] = false;
    });
    setApprovals(all);
  }, [result.actions]);

  // Execute approved actions
  const handleExecute = useCallback(async () => {
    setIsExecuting(true);
    const log: string[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const action of result.actions) {
      if (!approvals[action.id]) {
        log.push(`⏭️ Skipped: ${action.description}`);
        continue;
      }

      try {
        switch (action.type) {
          case 'delete': {
            const cardId = action.data.cardId as string;
            const cardTitle = action.data.cardTitle as string;
            deleteConversation(cardId);
            log.push(`✅ Deleted: "${cardTitle}"`);
            successCount++;
            break;
          }

          case 'rename': {
            const cardId = action.data.cardId as string;
            const newTitle = action.data.newTitle as string;
            const limitedTitle = enforceTitleWordLimit(newTitle, 2);
            const conv = conversations.get(cardId);
            if (conv) {
              const store = useCanvasStore.getState();
              if (!limitedTitle) {
                log.push(`⚠️ Skipped rename (empty title): "${action.data.currentTitle}"`);
              } else {
                store.updateConversation(cardId, {
                  metadata: {
                    ...conv.metadata,
                    title: limitedTitle,
                    titleIsManual: true,
                    titleAutoGenerated: false,
                    updatedAt: new Date(),
                  },
                });
                log.push(`✅ Renamed: "${action.data.currentTitle}" → "${limitedTitle}"`);
                successCount++;
              }
            } else {
              log.push(`❌ Card not found for rename: ${cardId}`);
              failCount++;
            }
            break;
          }

          case 'create_branch': {
            const branchReason = action.data.branchReason as string;
            const parentCardId = action.data.parentCardId as string | null;

            if (parentCardId) {
              const parentConv = conversations.get(parentCardId);
              if (parentConv) {
                const messageCount = Array.isArray(parentConv.content)
                  ? parentConv.content.length
                  : 0;

                if (messageCount === 0) {
                  log.push(`❌ Cannot branch from empty card: ${parentCardId}`);
                  failCount++;
                } else {
                  const store = useCanvasStore.getState();
                  store.branchFromMessage({
                    sourceCardId: parentCardId,
                    messageIndex: messageCount - 1,
                    branchReason,
                  });
                  log.push(`✅ Created branch: "${branchReason}"`);
                  successCount++;
                }
              } else {
                log.push(`❌ Parent card not found: ${parentCardId}`);
                failCount++;
              }
            } else {
              // Standalone card (no parent)
              const store = useCanvasStore.getState();
              const position = {
                x: 100 + Math.random() * 400,
                y: 100 + Math.random() * 400,
              };
              const newConversation = store.createConversationCard(
                store.activeWorkspaceId,
                position
              );
              store.updateConversation(newConversation.id, {
                metadata: {
                  ...newConversation.metadata,
                  title: branchReason,
                  titleIsManual: true,
                  titleAutoGenerated: false,
                  updatedAt: new Date(),
                },
              });
              log.push(`✅ Created card: "${branchReason}"`);
              successCount++;
            }
            break;
          }

          case 'create_document': {
            const title = action.data.title as string;
            const markdown = action.data.markdown as string;

            // Copy to clipboard
            try {
              await navigator.clipboard.writeText(markdown);
              log.push(`✅ Document "${title}" copied to clipboard`);
              successCount++;
            } catch {
              // Fallback: create a blob URL
              const blob = new Blob([markdown], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
              log.push(`✅ Document "${title}" opened in new tab`);
              successCount++;
            }
            break;
          }

          default:
            log.push(`⚠️ Unknown action type: ${action.type}`);
            failCount++;
        }
      } catch (err) {
        log.push(`❌ Failed: ${action.description} — ${(err as Error).message}`);
        failCount++;
      }
    }

    setExecutionLog(log);
    setIsExecuting(false);

    // Show toast summary
    if (successCount > 0) {
      toast.success(`Agent completed: ${successCount} action${successCount !== 1 ? 's' : ''} executed.`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} action${failCount !== 1 ? 's' : ''} failed.`);
    }

    // Auto-close after 2 seconds
    setTimeout(onComplete, 2000);
  }, [approvals, result.actions, deleteConversation, conversations, toast, onComplete]);

  const approvedCount = Object.values(approvals).filter(Boolean).length;
  const destructiveCount = result.actions.filter((a) => a.type === 'delete' && approvals[a.id]).length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'textarea' || tagName === 'select' || tagName === 'button') return;
      if (approvedCount === 0 || isExecuting || executionLog.length > 0) return;

      handleExecute();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [approvedCount, handleExecute, isExecuting, executionLog.length]);

  return (
    <motion.div
      style={overlayStyles}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        style={dialogStyles}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: spacing[4],
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
            <AlertTriangle size={20} color={colors.accent.primary} />
            <h2 style={{
              margin: 0,
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.semibold,
              color: colors.fg.primary,
              fontFamily: typography.fonts.heading,
            }}>
              Review Agent Actions ({result.actions.length})
            </h2>
          </div>
        </div>

        {/* Summary */}
        {result.summary && (
          <div style={{
            padding: `${spacing[2]} ${spacing[4]}`,
            fontSize: typography.sizes.xs,
            color: colors.fg.tertiary,
            fontFamily: typography.fonts.body,
            borderBottom: '1px solid var(--border-secondary)',
          }}>
            {result.summary}
          </div>
        )}

        {/* Actions List */}
        <div style={{ padding: spacing[4], overflowY: 'auto', flex: 1 }}>
          {executionLog.length > 0 ? (
            // Execution results
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[1],
            }}>
              {executionLog.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    padding: spacing[1],
                    fontSize: typography.sizes.xs,
                    color: colors.fg.secondary,
                    fontFamily: typography.fonts.body,
                  }}
                >
                  {entry}
                </div>
              ))}
            </div>
          ) : (
            // Action checkboxes
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
              {result.actions.map((action) => (
                <label
                  key={action.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing[2],
                    padding: spacing[2],
                    backgroundColor: approvals[action.id]
                      ? `${getActionColor(action.type)}10`
                      : colors.bg.inset,
                    border: `1px solid ${approvals[action.id]
                      ? getActionColor(action.type)
                      : 'var(--border-secondary)'}`,
                    borderRadius: effects.border.radius.default,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: approvals[action.id] ? 1 : 0.6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={approvals[action.id] || false}
                    onChange={() => toggleApproval(action.id)}
                    style={{
                      marginTop: '2px',
                      accentColor: getActionColor(action.type),
                    }}
                  />
                  <div style={{ marginTop: '1px' }}>
                    {getActionIcon(action.type)}
                  </div>
                  <div>
                    <div style={{
                      fontSize: typography.sizes.sm,
                      color: colors.fg.primary,
                      fontFamily: typography.fonts.body,
                    }}>
                      {action.description}
                    </div>
                    {action.type === 'delete' && (
                      <div style={{
                        fontSize: typography.sizes.xs,
                        color: colors.semantic.error,
                        fontFamily: typography.fonts.body,
                        marginTop: '2px',
                      }}>
                        This action cannot be undone
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {executionLog.length === 0 && (
          <div style={{
            padding: spacing[4],
            borderTop: '1px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
          }}>
            {/* Bulk controls */}
            <button
              onClick={approveAll}
              style={{
                padding: `${spacing[1]} ${spacing[2]}`,
                backgroundColor: 'transparent',
                border: '1px solid var(--border-primary)',
                borderRadius: effects.border.radius.default,
                color: colors.fg.tertiary,
                fontSize: typography.sizes.xs,
                fontFamily: typography.fonts.body,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Check size={12} /> All
            </button>
            <button
              onClick={rejectAll}
              style={{
                padding: `${spacing[1]} ${spacing[2]}`,
                backgroundColor: 'transparent',
                border: '1px solid var(--border-primary)',
                borderRadius: effects.border.radius.default,
                color: colors.fg.tertiary,
                fontSize: typography.sizes.xs,
                fontFamily: typography.fonts.body,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <X size={12} /> None
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing[2] }}>
              <button
                onClick={onCancel}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-primary)',
                  borderRadius: effects.border.radius.default,
                  color: colors.fg.secondary,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={approvedCount === 0 || isExecuting}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: approvedCount === 0 || isExecuting
                    ? colors.bg.inset
                    : destructiveCount > 0
                      ? colors.semantic.error
                      : colors.accent.primary,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: approvedCount === 0 || isExecuting
                    ? colors.fg.quaternary
                    : colors.fg.primary,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  fontWeight: typography.weights.medium,
                  cursor: approvedCount === 0 || isExecuting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[1],
                }}
              >
                <CheckCircle size={16} />
                {isExecuting
                  ? 'Executing...'
                  : `Execute ${approvedCount} Action${approvedCount !== 1 ? 's' : ''}`
                }
                {destructiveCount > 0 && ` (${destructiveCount} destructive)`}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default AgentConfirmationDialog;
