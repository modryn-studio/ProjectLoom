'use client';

/**
 * MergeNodeCreator - UI for creating merge nodes from multiple sources
 * 
 * Allows users to select multiple cards and merge their context
 * into a synthesis node.
 * 
 * @version 4.0.0
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';
import { apiKeyManager } from '@/lib/api-key-manager';
import { detectProvider } from '@/lib/vercel-ai-integration';
import { useUsageStore } from '@/stores/usage-store';
import type { Conversation, Position, InheritanceMode } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface MergeNodeCreatorProps {
  /** Pre-selected card IDs (from multi-select) */
  initialCardIds?: string[];
  /** Position for the new merge node */
  position: Position;
  /** Called when dialog should close */
  onClose: () => void;
  /** Called when merge node is created */
  onComplete?: (mergeNodeId: string) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MERGE_CONFIG = {
  MAX_PARENTS: 5,
  WARNING_THRESHOLD: 3,
  BUNDLE_THRESHOLD: 4,
};

// =============================================================================
// COMPONENT
// =============================================================================

export function MergeNodeCreator({
  initialCardIds = [],
  position,
  onClose,
  onComplete,
}: MergeNodeCreatorProps) {
  const conversations = useCanvasStore((s) => s.conversations);
  const createMergeNode = useCanvasStore((s) => s.createMergeNode);
  const addUsage = useUsageStore((s) => s.addUsage);
  
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>(initialCardIds);
  const [synthesisPrompt, setSynthesisPrompt] = useState('');
  const [inheritanceModes, setInheritanceModes] = useState<Record<string, InheritanceMode>>({});
  const [summaryTexts, setSummaryTexts] = useState<Record<string, string>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayMouseDownRef = useRef(false);

  // Get all available cards that can be merged
  const availableCards = useMemo(() => {
    return Array.from(conversations.values()).filter(
      (conv) => !conv.isMergeNode // Can't merge a merge node into another merge
    );
  }, [conversations]);

  // Selected card details
  const selectedCards = useMemo(() => {
    return selectedCardIds
      .map((id) => conversations.get(id))
      .filter((c): c is Conversation => c !== undefined);
  }, [selectedCardIds, conversations]);

  // Calculate total context
  const totalMessages = useMemo(() => {
    return selectedCards.reduce((sum, card) => {
      return sum + (Array.isArray(card.content) ? card.content.length : 0);
    }, 0);
  }, [selectedCards]);

  const estimatedTokens = Math.ceil(totalMessages * 150);

  // Validation
  const isAtLimit = selectedCardIds.length >= MERGE_CONFIG.MAX_PARENTS;
  const isOverWarning = selectedCardIds.length >= MERGE_CONFIG.WARNING_THRESHOLD;
  const canCreate = selectedCardIds.length >= 2;

  const handleToggleCard = useCallback((cardId: string) => {
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      if (prev.length >= MERGE_CONFIG.MAX_PARENTS) {
        return prev; // At limit
      }
      return [...prev, cardId];
    });
  }, []);

  const handleRemoveCard = useCallback((cardId: string) => {
    setSelectedCardIds((prev) => prev.filter((id) => id !== cardId));
    // Clean up mode/summary for removed card
    setInheritanceModes((prev) => { const next = { ...prev }; delete next[cardId]; return next; });
    setSummaryTexts((prev) => { const next = { ...prev }; delete next[cardId]; return next; });
  }, []);

  // Toggle inheritance mode for a specific parent
  const handleToggleMode = useCallback(async (cardId: string) => {
    const currentMode = inheritanceModes[cardId] || 'full';
    
    if (currentMode === 'full') {
      // Switch to summary mode — generate summary
      const conv = conversations.get(cardId);
      if (!conv || !Array.isArray(conv.content) || conv.content.length === 0) return;
      
      const apiKey = apiKeyManager.getKey('anthropic') || apiKeyManager.getKey('openai');
      if (!apiKey) {
        setError('Configure an API key to generate summaries.');
        return;
      }
      
      setGeneratingFor(cardId);
      setError(null);
      
      try {
        const provider = apiKeyManager.getKey('anthropic') ? 'anthropic' : 'openai';
        const modelId = provider === 'anthropic' ? 'claude-sonnet-4-5' : 'gpt-5.2';
        const messagesForApi = conv.content.map(m => ({
          role: m.role,
          content: m.content,
        }));
        
        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messagesForApi, apiKey, model: modelId }),
        });
        
        if (!res.ok) throw new Error('Summary generation failed');
        const data = await res.json() as { summary: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } };

        if (data.usage?.totalTokens) {
          addUsage({
            provider: detectProvider(modelId),
            model: modelId,
            inputTokens: data.usage.promptTokens,
            outputTokens: data.usage.completionTokens,
            conversationId: cardId,
            source: 'summarize',
          });
        }
        
        setSummaryTexts(prev => ({ ...prev, [cardId]: data.summary }));
        setInheritanceModes(prev => ({ ...prev, [cardId]: 'summary' }));
      } catch {
        setError(`Failed to generate summary for "${conv.metadata.title}".`);
      } finally {
        setGeneratingFor(null);
      }
    } else {
      // Switch back to full
      setInheritanceModes(prev => ({ ...prev, [cardId]: 'full' }));
    }
  }, [inheritanceModes, conversations, addUsage]);

  const handleCreateMerge = useCallback(async () => {
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const result = createMergeNode({
        sourceCardIds: selectedCardIds,
        position,
        synthesisPrompt: synthesisPrompt.trim() || undefined,
        inheritanceModes,
        summaryTexts,
      });

      if (result) {
        onComplete?.(result.id);
        onClose();
      } else {
        setError('Failed to create merge node. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
      console.error('Merge creation error:', err);
    } finally {
      setIsCreating(false);
    }
  }, [createMergeNode, selectedCardIds, position, synthesisPrompt, inheritanceModes, summaryTexts, canCreate, onClose, onComplete]);

  // Get merge node style based on parent count
  const getMergeStyle = () => {
    const count = selectedCardIds.length;
    if (count <= 3) {
      return { border: 'border-success-solid', bg: 'bg-success-muted', icon: '⚡' };
    } else if (count <= 5) {
      return { border: 'border-warning-solid', bg: 'bg-warning-muted', icon: '⚠️' };
    }
    return { border: 'border-error-solid', bg: 'bg-error-muted', icon: '🚫' };
  };

  const mergeStyle = getMergeStyle();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onMouseDown={(e) => {
          overlayMouseDownRef.current = e.target === e.currentTarget;
        }}
        onMouseUp={(e) => {
          if (overlayMouseDownRef.current && e.target === e.currentTarget) {
            onClose();
          }
          overlayMouseDownRef.current = false;
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-120 max-h-[80vh] bg-bg-secondary rounded-xl border border-border-primary shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-tertiary">
            <div className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-success-solid" />
              <h2 className="text-lg font-semibold text-fg-primary">Create Merge Node</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-bg-tertiary text-fg-tertiary hover:text-fg-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selected Cards Preview */}
          <div className={`p-4 border-b border-border-primary ${mergeStyle.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-fg-secondary">
                Selected Sources ({selectedCardIds.length}/{MERGE_CONFIG.MAX_PARENTS})
              </span>
              <span className="text-lg">{mergeStyle.icon}</span>
            </div>

            {selectedCards.length === 0 ? (
              <div className="text-sm text-fg-tertiary italic">
                Select at least 2 cards below to merge
              </div>
            ) : (
              <div className="space-y-2">
                {selectedCards.map((card) => {
                  const mode = inheritanceModes[card.id] || 'full';
                  const msgCount = Array.isArray(card.content) ? card.content.length : 0;
                  const isGenerating = generatingFor === card.id;
                  
                  return (
                    <div
                      key={card.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg ${mergeStyle.border} border bg-bg-tertiary`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-fg-primary text-sm truncate max-w-35">
                          {card.metadata.title}
                        </span>
                        <span className="text-fg-tertiary text-xs whitespace-nowrap">{msgCount} msgs</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Inheritance mode toggle */}
                        <button
                          onClick={() => handleToggleMode(card.id)}
                          disabled={isGenerating || isCreating}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            mode === 'summary'
                              ? 'bg-accent-muted text-accent-primary border border-accent-primary/40'
                              : 'bg-bg-tertiary text-fg-tertiary border border-border-secondary hover:text-fg-primary'
                          } ${isGenerating ? 'opacity-60' : ''}`}
                          title={mode === 'full' ? 'Click for AI Summary' : 'Click for Full Context'}
                        >
                          {isGenerating ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Summarizing…
                            </span>
                          ) : (
                            mode === 'summary' ? '📝 Summary' : '📄 Full'
                          )}
                        </button>
                        {/* Remove button */}
                        <button
                          onClick={() => handleRemoveCard(card.id)}
                          className="p-0.5 rounded-full hover:bg-bg-tertiary text-fg-tertiary hover:text-fg-primary"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Warning for complex merges */}
            {isOverWarning && (
              <div className="mt-2 flex items-center gap-2 text-xs text-warning-solid">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  {isAtLimit
                    ? 'Maximum sources reached. Consider hierarchical merging.'
                    : 'Complex merge may affect AI response quality.'}
                </span>
              </div>
            )}
          </div>

          {/* Available Cards List */}
          <div className="max-h-60 overflow-y-auto">
            <div className="p-2 space-y-1">
              {availableCards.map((card) => {
                const isSelected = selectedCardIds.includes(card.id);
                const isDisabled = isAtLimit && !isSelected;
                const messageCount = Array.isArray(card.content) ? card.content.length : 0;

                return (
                  <button
                    key={card.id}
                    onClick={() => handleToggleCard(card.id)}
                    disabled={isDisabled}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors
                      ${isSelected
                        ? 'bg-success-muted border border-success-solid/50'
                        : isDisabled
                          ? 'opacity-50 cursor-not-allowed bg-bg-tertiary/30'
                          : 'hover:bg-bg-tertiary border border-transparent'
                      }
                    `}
                  >
                    <div className={`
                      w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0
                      ${isSelected ? 'bg-success-solid border-success-solid' : 'border-border-secondary'}
                    `}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-fg-primary truncate">
                        {card.metadata.title}
                      </div>
                      <div className="text-xs text-fg-tertiary">
                        {messageCount} messages
                        {card.parentCardIds.length > 0 && (
                          <span> • branched from {card.parentCardIds.length} source(s)</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Synthesis Prompt */}
          <div className="p-4 border-t border-border-primary">
            <label className="block text-sm font-medium text-fg-secondary mb-2">
              Synthesis Prompt (optional)
            </label>
            <textarea
              value={synthesisPrompt}
              onChange={(e) => setSynthesisPrompt(e.target.value)}
              placeholder="e.g., Compare the REST and GraphQL approaches and recommend the best option..."
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-success-solid/50 focus:border-success-solid resize-none"
              rows={2}
            />
          </div>

          {/* Context Summary */}
          <div className="px-4 py-2 bg-bg-tertiary text-xs text-fg-tertiary flex justify-between">
            <span>Total context: {totalMessages} messages</span>
            <span>~{estimatedTokens.toLocaleString()} tokens</span>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 px-3 py-2 bg-error-muted border border-error-solid/30 rounded-md text-xs text-error-solid">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 p-4 border-t border-border-primary">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="flex-1 px-4 py-2 text-sm font-medium text-fg-secondary bg-bg-tertiary hover:bg-bg-secondary rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateMerge}
              disabled={!canCreate || isCreating}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-success-solid hover:bg-success-solid/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Creating...
                </>
              ) : (
                <>
                  <GitMerge className="w-4 h-4" />
                  Create Merge ({selectedCardIds.length})
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default MergeNodeCreator;
