/**
 * AgentDialog Component
 * 
 * Main dialog for triggering agent workflows.
 * Shows available agents, accepts user prompts,
 * displays progress, and presents results for confirmation.
 * 
 * @version 1.0.0
 */

'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Trash2, GitBranch, FileText, X, Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

import { useCanvasStore } from '@/stores/canvas-store';
import { colors, spacing, effects, typography } from '@/lib/design-tokens';
import { apiKeyManager } from '@/lib/api-key-manager';
import { detectProvider, estimateCost, formatCost } from '@/lib/vercel-ai-integration';
import { useUsageStore } from '@/stores/usage-store';
import { AgentConfirmationDialog } from './AgentConfirmationDialog';

import type {
  AgentId,
  AgentRunResult,
  AgentStep,
  WorkspaceSnapshot,
  CardSnapshot,
} from '@/lib/agents/types';

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
  zIndex: 9999,
};

const dialogStyles: React.CSSProperties = {
  backgroundColor: colors.bg.secondary,
  borderRadius: effects.border.radius.md,
  border: '1px solid var(--border-primary)',
  boxShadow: effects.shadow.lg,
  width: '90%',
  maxWidth: '650px',
  maxHeight: '85vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

// =============================================================================
// AGENT OPTIONS
// =============================================================================

interface AgentOption {
  id: AgentId;
  name: string;
  description: string;
  icon: React.ReactNode;
  needsPrompt: boolean;
  promptPlaceholder?: string;
}

const AGENT_OPTIONS: AgentOption[] = [
  {
    id: 'cleanup',
    name: 'Clean Up Workspace',
    description: 'Suggest cards to delete or rename for a tidier workspace',
    icon: <Trash2 size={20} />,
    needsPrompt: false,
  },
  {
    id: 'branch',
    name: 'Create Branches',
    description: 'Generate multiple branch cards from a single prompt',
    icon: <GitBranch size={20} />,
    needsPrompt: true,
    promptPlaceholder: 'e.g., Give me 3 approaches to user authentication',
  },
  {
    id: 'summarize',
    name: 'Summarize to Document',
    description: 'Read cards and export a combined markdown summary',
    icon: <FileText size={20} />,
    needsPrompt: false,
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

interface AgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentDialog({ isOpen, onClose }: AgentDialogProps) {
  // State
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [usedModelId, setUsedModelId] = useState<string>('anthropic/claude-sonnet-4-6');

  const abortControllerRef = useRef<AbortController | null>(null);
  const overlayMouseDownRef = useRef(false);

  // Store
  const conversations = useCanvasStore((s) => s.conversations);
  const edges = useCanvasStore((s) => s.edges);
  const activeWorkspaceId = useCanvasStore((s) => s.activeWorkspaceId);
  const addUsage = useUsageStore((s) => s.addUsage);

  // Build workspace snapshot for agent
  const workspaceSnapshot = useMemo<WorkspaceSnapshot>(() => {
    const cards: CardSnapshot[] = [];
    conversations.forEach((conv) => {
      if (conv.canvasId !== activeWorkspaceId) return;
      cards.push({
        id: conv.id,
        title: conv.metadata.title,
        messageCount: conv.content.length,
        createdAt: conv.metadata.createdAt,
        updatedAt: conv.metadata.updatedAt,
        parentCardIds: conv.parentCardIds,
        isMergeNode: conv.isMergeNode,
        tags: conv.metadata.tags,
        firstMessage: conv.content[0]?.content,
        lastMessage: conv.content[conv.content.length - 1]?.content,
      });
    });

    return {
      workspaceId: activeWorkspaceId,
      workspaceTitle: 'Current Workspace',
      cards,
      totalCards: cards.length,
      totalEdges: edges.length,
    };
  }, [conversations, edges, activeWorkspaceId]);

  // Reset state
  const resetState = useCallback(() => {
    setSelectedAgent(null);
    setUserPrompt('');
    setIsRunning(false);
    setResult(null);
    setSteps([]);
    setError(null);
    setShowConfirmation(false);
    setUsedModelId('anthropic/claude-sonnet-4-6');
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (isRunning) {
      abortControllerRef.current?.abort();
    }
    resetState();
    onClose();
  }, [isRunning, onClose, resetState]);

  // Run agent
  const handleRunAgent = useCallback(async () => {
    if (!selectedAgent) return;

    const agentOption = AGENT_OPTIONS.find((a) => a.id === selectedAgent);
    if (!agentOption) return;

    if (agentOption.needsPrompt && !userPrompt.trim()) {
      setError('Please enter a prompt for this agent.');
      return;
    }

    // Check API keys
    const anthropicKey = apiKeyManager.getKey('anthropic') ?? undefined;
    const openaiKey = apiKeyManager.getKey('openai') ?? undefined;
    const modelId = 'anthropic/claude-sonnet-4-6'; // Default agent model

    if (!anthropicKey && !openaiKey) {
      setError('No API key configured. Add one in Settings.');
      return;
    }

    // Agents use Claude by default — need anthropic key
    if (!anthropicKey) {
      setError('Anthropic API key is required for agents (uses Claude). Add it in Settings.');
      return;
    }

    setIsRunning(true);
    setError(null);
    setSteps([]);
    setResult(null);
    setUsedModelId(modelId);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Build request body
      const body: Record<string, unknown> = {
        agentId: selectedAgent,
        userPrompt: userPrompt.trim() || `Run ${agentOption.name} on this workspace`,
        workspace: workspaceSnapshot,
        config: {
          modelId,
          anthropicKey,
          openaiKey,
          maxSteps: 10,
          timeoutMs: 60_000,
          maxCostUsd: 0.50,
        },
      };

      // Add extra data for specific agents
      if (selectedAgent === 'summarize') {
        // Include card contents for summarize agent
        const cardContents: Array<{ id: string; title: string; messages: Array<{ role: string; content: string }> }> = [];
        conversations.forEach((conv) => {
          if (conv.canvasId !== activeWorkspaceId) return;
          cardContents.push({
            id: conv.id,
            title: conv.metadata.title,
            messages: conv.content.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          });
        });
        body.extra = { cardContents };
      }

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errData = await response.json();
        setError(errData.error || 'Agent failed.');
        setIsRunning(false);
        return;
      }

      const agentResult = (await response.json()) as AgentRunResult;
      setResult(agentResult);
      setSteps(agentResult.steps || []);
      setIsRunning(false);

      if (agentResult.usage?.totalTokens > 0) {
        console.log('[AgentDialog] Tracking usage:', {
          model: modelId,
          provider: detectProvider(modelId),
          promptTokens: agentResult.usage.promptTokens,
          completionTokens: agentResult.usage.completionTokens,
        });
        addUsage({
          provider: detectProvider(modelId),
          model: modelId,
          inputTokens: agentResult.usage.promptTokens,
          outputTokens: agentResult.usage.completionTokens,
          source: 'agent',
        });
      } else {
        console.warn('[AgentDialog] Agent usage data missing or zero:', {
          model: modelId,
          usage: agentResult.usage,
        });
      }

      if (agentResult.status === 'error') {
        setError(agentResult.error || 'Agent encountered an error.');
      } else if (agentResult.actions.length > 0) {
        setShowConfirmation(true);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setError('Agent was cancelled.');
      } else {
        setError((err as Error).message || 'Failed to run agent.');
      }
      setIsRunning(false);
    }
  }, [selectedAgent, userPrompt, workspaceSnapshot, conversations, activeWorkspaceId, addUsage]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
  }, []);

  // Handle confirmation complete
  const handleConfirmationComplete = useCallback(() => {
    setShowConfirmation(false);
    handleClose();
  }, [handleClose]);

  useEffect(() => {
    if (!isOpen || showConfirmation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (tagName === 'textarea' || tagName === 'select' || tagName === 'button') return;
        if (isRunning) return;
        if (result && result.actions.length === 0) {
          handleClose();
          return;
        }
        if (!result && selectedAgent) {
          handleRunAgent();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showConfirmation, handleClose, handleRunAgent, isRunning, result, selectedAgent]);

  if (!isOpen) return null;

  // Show confirmation dialog if we have results with actions
  if (showConfirmation && result) {
    return (
      <AgentConfirmationDialog
        result={result}
        onComplete={handleConfirmationComplete}
        onCancel={() => setShowConfirmation(false)}
      />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        style={overlayStyles}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(e) => {
          overlayMouseDownRef.current = e.target === e.currentTarget;
        }}
        onMouseUp={(e) => {
          if (overlayMouseDownRef.current && e.target === e.currentTarget) {
            handleClose();
          }
          overlayMouseDownRef.current = false;
        }}
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
              <Bot size={24} color={colors.accent.primary} />
              <h2 style={{
                margin: 0,
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.semibold,
                color: colors.fg.primary,
                fontFamily: typography.fonts.heading,
              }}>
                Agent Workflows
              </h2>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: spacing[1],
                borderRadius: effects.border.radius.default,
                color: colors.fg.tertiary,
                display: 'flex',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Coming Soon Banner */}
          <div style={{
            padding: `${spacing[2]} ${spacing[4]}`,
            backgroundColor: `${colors.accent.primary}10`,
            borderBottom: '1px solid var(--border-primary)',
            fontSize: typography.sizes.xs,
            color: colors.fg.secondary,
            fontFamily: typography.fonts.body,
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
          }}>
            <span style={{
              padding: '1px 6px',
              backgroundColor: colors.accent.muted,
              color: colors.accent.primary,
              borderRadius: effects.border.radius.default,
              fontWeight: typography.weights.medium,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>Coming Soon</span>
            Agent workflows are in development. Browse the options below — execution will be enabled in an upcoming release.
          </div>

          {/* Content */}
          <div style={{ padding: spacing[4], overflowY: 'auto', flex: 1 }}>
            {/* Agent Selection */}
            {!isRunning && !result && (
              <>
                <div style={{ marginBottom: spacing[4] }}>
                  <label style={{
                    display: 'block',
                    marginBottom: spacing[2],
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.medium,
                    color: colors.fg.secondary,
                    fontFamily: typography.fonts.body,
                  }}>
                    Choose an Agent
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
                    {AGENT_OPTIONS.map((agent) => (
                      <label
                        key={agent.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: spacing[2],
                          padding: spacing[2],
                          backgroundColor: selectedAgent === agent.id
                            ? `${colors.accent.primary}15`
                            : colors.bg.inset,
                          border: `1px solid ${selectedAgent === agent.id
                            ? colors.accent.primary
                            : 'var(--border-primary)'}`,
                          borderRadius: effects.border.radius.default,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="agent-selection"
                          value={agent.id}
                          checked={selectedAgent === agent.id}
                          onChange={() => setSelectedAgent(agent.id)}
                          style={{ marginTop: '2px' }}
                        />
                        <div style={{
                          color: selectedAgent === agent.id ? colors.accent.primary : colors.fg.tertiary,
                          marginTop: '2px',
                        }}>
                          {agent.icon}
                        </div>
                        <div>
                          <div style={{
                            fontWeight: typography.weights.medium,
                            color: colors.fg.primary,
                            marginBottom: '2px',
                            fontFamily: typography.fonts.body,
                          }}>
                            {agent.name}
                          </div>
                          <div style={{
                            fontSize: typography.sizes.xs,
                            color: colors.fg.secondary,
                            fontFamily: typography.fonts.body,
                          }}>
                            {agent.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Prompt Input (for agents that need it) */}
                {selectedAgent && AGENT_OPTIONS.find((a) => a.id === selectedAgent)?.needsPrompt && (
                  <div style={{ marginBottom: spacing[4] }}>
                    <label style={{
                      display: 'block',
                      marginBottom: spacing[1],
                      fontSize: typography.sizes.sm,
                      fontWeight: typography.weights.medium,
                      color: colors.fg.secondary,
                      fontFamily: typography.fonts.body,
                    }}>
                      What should the agent do?
                    </label>
                    <textarea
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      placeholder={AGENT_OPTIONS.find((a) => a.id === selectedAgent)?.promptPlaceholder}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: spacing[2],
                        backgroundColor: colors.bg.inset,
                        border: '1px solid var(--border-primary)',
                        borderRadius: effects.border.radius.default,
                        color: colors.fg.primary,
                        fontSize: typography.sizes.sm,
                        fontFamily: typography.fonts.body,
                        resize: 'vertical',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}

                {/* Workspace Info */}
                <div style={{
                  padding: spacing[2],
                  backgroundColor: colors.bg.inset,
                  borderRadius: effects.border.radius.default,
                  fontSize: typography.sizes.xs,
                  color: colors.fg.secondary,
                  fontFamily: typography.fonts.body,
                }}>
                  <strong style={{ color: colors.fg.secondary }}>Workspace:</strong>{' '}
                  {workspaceSnapshot.totalCards} cards, {workspaceSnapshot.totalEdges} connections
                </div>
              </>
            )}

            {/* Running State */}
            {isRunning && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing[3],
                padding: spacing[4],
              }}>
                <Loader2
                  size={32}
                  color={colors.accent.primary}
                  style={{ animation: 'spin 1s linear infinite' }}
                />
                <div style={{
                  fontSize: typography.sizes.sm,
                  color: colors.fg.primary,
                  fontFamily: typography.fonts.body,
                }}>
                  Agent is working...
                </div>
                {steps.length > 0 && (
                  <div style={{
                    width: '100%',
                    padding: spacing[2],
                    backgroundColor: colors.bg.inset,
                    borderRadius: effects.border.radius.default,
                    fontSize: typography.sizes.xs,
                    color: colors.fg.secondary,
                    fontFamily: typography.fonts.body,
                    maxHeight: 150,
                    overflowY: 'auto',
                  }}>
                    {steps.map((step, i) => (
                      <div key={i} style={{ padding: '2px 0' }}>
                        Step {step.index + 1}: Called <strong>{step.toolName}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Result State (no actions to confirm) */}
            {result && !showConfirmation && result.actions.length === 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: spacing[3],
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[2],
                }}>
                  {result.status === 'success' ? (
                    <CheckCircle size={20} color={colors.semantic.success} />
                  ) : (
                    <AlertCircle size={20} color={colors.semantic.error} />
                  )}
                  <span style={{
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.medium,
                    color: result.status === 'success' ? colors.semantic.success : colors.semantic.error,
                    fontFamily: typography.fonts.body,
                  }}>
                    {result.status === 'success' ? 'Agent Completed' : 'Agent Failed'}
                  </span>
                </div>

                <div style={{
                  padding: spacing[2],
                  backgroundColor: colors.bg.inset,
                  borderRadius: effects.border.radius.default,
                  fontSize: typography.sizes.sm,
                  color: colors.fg.secondary,
                  fontFamily: typography.fonts.body,
                  whiteSpace: 'pre-wrap',
                }}>
                  {result.summary}
                </div>

                {result.usage.totalTokens > 0 && (
                  <div style={{
                    fontSize: typography.sizes.xs,
                    color: colors.fg.tertiary,
                    fontFamily: typography.fonts.body,
                  }}>
                    Tokens used: {result.usage.totalTokens.toLocaleString()} |
                    Est. cost: {formatCost(estimateCost(result.usage.promptTokens, result.usage.completionTokens, usedModelId))}
                  </div>
                )}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div style={{
                marginTop: spacing[2],
                padding: spacing[2],
                backgroundColor: `${colors.semantic.error}15`,
                border: `1px solid ${colors.semantic.error}`,
                borderRadius: effects.border.radius.default,
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1],
                fontSize: typography.sizes.xs,
                color: colors.semantic.error,
                fontFamily: typography.fonts.body,
              }}>
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: spacing[4],
            borderTop: '1px solid var(--border-primary)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: spacing[2],
          }}>
            <button
              onClick={handleClose}
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
              {result ? 'Close' : 'Cancel'}
            </button>

            {isRunning ? (
              <button
                onClick={handleCancel}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: colors.semantic.error,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: colors.semantic.errorContrast,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  fontWeight: typography.weights.medium,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[1],
                }}
              >
                <X size={16} />
                Stop Agent
              </button>
            ) : !result ? (
              <button
                disabled
                title="Coming soon"
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: colors.bg.inset,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: colors.fg.quaternary,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  fontWeight: typography.weights.medium,
                  cursor: 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[1],
                  opacity: 0.5,
                }}
              >
                <Play size={16} />
                Run Agent
              </button>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default AgentDialog;
