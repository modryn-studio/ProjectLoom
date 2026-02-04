'use client';

/**
 * InlineBranchPanel - Mouse-driven inline branching UI
 * 
 * Appears when user clicks branch icon on a message.
 * Provides quick context inheritance options.
 * 
 * @version 4.0.0
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Paperclip, FileText, Settings2, X, Check, AlertCircle } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';
import type { InheritanceMode } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface InlineBranchPanelProps {
  /** ID of the parent card */
  parentCardId: string;
  /** Message index to branch from (0-indexed) */
  messageIndex: number;
  /** Total messages in the parent card */
  totalMessages: number;
  /** Position for the panel */
  position?: 'left' | 'right';
  /** Called when panel should close */
  onClose: () => void;
  /** Called when branch is created */
  onComplete?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const INHERITANCE_OPTIONS: { value: InheritanceMode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'full',
    label: 'Full Context',
    description: 'Include all messages up to this point',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    value: 'summary',
    label: 'Smart Summary',
    description: 'AI-condensed context for efficiency',
    icon: <Paperclip className="w-4 h-4" />,
  },
  {
    value: 'custom',
    label: 'Custom Selection',
    description: 'Choose specific messages to include',
    icon: <Settings2 className="w-4 h-4" />,
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function InlineBranchPanel({
  parentCardId,
  messageIndex,
  totalMessages,
  position = 'right',
  onClose,
  onComplete,
}: InlineBranchPanelProps) {
  const branchFromMessage = useCanvasStore((s) => s.branchFromMessage);
  
  const [selectedMode, setSelectedMode] = useState<InheritanceMode>('full');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate context info
  const contextMessageCount = messageIndex + 1;
  const estimatedTokens = Math.ceil(contextMessageCount * 150); // Rough estimate

  const handleCreateBranch = useCallback(async () => {
    setIsCreating(true);
    setError(null);

    try {
      const result = branchFromMessage({
        sourceCardId: parentCardId,
        messageIndex,
        inheritanceMode: selectedMode,
      });

      if (result) {
        onComplete?.();
        onClose();
      } else {
        setError('Failed to create branch. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
      console.error('Branch creation error:', err);
    } finally {
      setIsCreating(false);
    }
  }, [branchFromMessage, parentCardId, messageIndex, selectedMode, onClose, onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={`
          absolute z-50 w-72 bg-zinc-900 rounded-lg border border-zinc-700
          shadow-xl shadow-black/50
          ${position === 'right' ? 'left-full ml-2' : 'right-full mr-2'}
        `}
        style={{ top: '-8px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <GitBranch className="w-4 h-4 text-amber-400" />
            <span>Branch from message {messageIndex + 1}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Context Info */}
        <div className="px-3 py-2 bg-zinc-800/50 text-xs text-zinc-400">
          <div className="flex justify-between">
            <span>Messages to inherit:</span>
            <span className="text-zinc-200">{contextMessageCount} of {totalMessages}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Estimated tokens:</span>
            <span className="text-zinc-200">~{estimatedTokens}</span>
          </div>
        </div>

        {/* Inheritance Mode Options */}
        <div className="p-2 space-y-1">
          {INHERITANCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedMode(option.value)}
              className={`
                w-full flex items-start gap-3 p-2 rounded-md text-left transition-colors
                ${selectedMode === option.value
                  ? 'bg-amber-500/20 border border-amber-500/50'
                  : 'hover:bg-zinc-800 border border-transparent'
                }
              `}
            >
              <div className={`
                mt-0.5 p-1 rounded
                ${selectedMode === option.value ? 'text-amber-400' : 'text-zinc-500'}
              `}>
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${selectedMode === option.value ? 'text-amber-100' : 'text-zinc-200'}`}>
                  {option.label}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {option.description}
                </div>
              </div>
              {selectedMode === option.value && (
                <Check className="w-4 h-4 text-amber-400 mt-1" />
              )}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-3 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 p-3 pt-1 border-t border-zinc-700/50">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="flex-1 px-3 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateBranch}
            disabled={isCreating}
            className="flex-1 px-3 py-2 text-sm font-medium text-zinc-900 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full"
                />
                Creating...
              </>
            ) : (
              <>
                <GitBranch className="w-4 h-4" />
                Create Branch
              </>
            )}
          </button>
        </div>

        {/* Keyboard hint */}
        <div className="px-3 pb-2 text-xs text-zinc-500 text-center">
          Tip: Use <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Ctrl+B</kbd> for keyboard workflow
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default InlineBranchPanel;
