'use client';

/**
 * MergeNodeCreator - UI for creating merge nodes from multiple sources
 * 
 * Allows users to select multiple cards and merge their context
 * into a synthesis node.
 * 
 * @version 4.0.0
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge, X, Check, AlertTriangle, Plus, Trash2, Loader2 } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';
import { apiKeyManager } from '@/lib/api-key-manager';
import { estimateMessagesTokens, estimateCost, formatCost } from '@/lib/vercel-ai-integration';
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
  
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>(initialCardIds);
  const [synthesisPrompt, setSynthesisPrompt] = useState('');
  const [inheritanceModes, setInheritanceModes] = useState<Record<string, InheritanceMode>>({});
  const [summaryTexts, setSummaryTexts] = useState<Record<string, string>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const modelId = provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
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
        const data = await res.json();
        
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
  }, [inheritanceModes, conversations]);

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
      return { border: 'border-emerald-500', bg: 'bg-emerald-500/10', icon: '⚡' };
    } else if (count <= 5) {
      return { border: 'border-amber-500', bg: 'bg-amber-500/10', icon: '⚠️' };
    }
    return { border: 'border-red-500', bg: 'bg-red-500/10', icon: '🚫' };
  };

  const mergeStyle = getMergeStyle();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-[480px] max-h-[80vh] bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-800/50">
            <div className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Create Merge Node</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selected Cards Preview */}
          <div className={`p-4 border-b border-zinc-700 ${mergeStyle.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-zinc-300">
                Selected Sources ({selectedCardIds.length}/{MERGE_CONFIG.MAX_PARENTS})
              </span>
              <span className="text-lg">{mergeStyle.icon}</span>
            </div>

            {selectedCards.length === 0 ? (
              <div className="text-sm text-zinc-500 italic">
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
                      className={`flex items-center justify-between px-3 py-2 rounded-lg ${mergeStyle.border} border bg-zinc-800`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-zinc-200 text-sm truncate max-w-[140px]">
                          {card.metadata.title}
                        </span>
                        <span className="text-zinc-500 text-xs whitespace-nowrap">{msgCount} msgs</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Inheritance mode toggle */}
                        <button
                          onClick={() => handleToggleMode(card.id)}
                          disabled={isGenerating || isCreating}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            mode === 'summary'
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                              : 'bg-zinc-700 text-zinc-400 border border-zinc-600 hover:text-zinc-200'
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
                          className="p-0.5 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
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
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-400">
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
          <div className="max-h-[240px] overflow-y-auto">
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
                        ? 'bg-emerald-500/20 border border-emerald-500/50'
                        : isDisabled
                          ? 'opacity-50 cursor-not-allowed bg-zinc-800/30'
                          : 'hover:bg-zinc-800 border border-transparent'
                      }
                    `}
                  >
                    <div className={`
                      w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
                      ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'}
                    `}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-200 truncate">
                        {card.metadata.title}
                      </div>
                      <div className="text-xs text-zinc-500">
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
          <div className="p-4 border-t border-zinc-700">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Synthesis Prompt (optional)
            </label>
            <textarea
              value={synthesisPrompt}
              onChange={(e) => setSynthesisPrompt(e.target.value)}
              placeholder="e.g., Compare the REST and GraphQL approaches and recommend the best option..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
              rows={2}
            />
          </div>

          {/* Context Summary */}
          <div className="px-4 py-2 bg-zinc-800/50 text-xs text-zinc-400 flex justify-between">
            <span>Total context: {totalMessages} messages</span>
            <span>~{estimatedTokens.toLocaleString()} tokens</span>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 p-4 border-t border-zinc-700">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="flex-1 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateMerge}
              disabled={!canCreate || isCreating}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
