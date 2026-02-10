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
import { GitBranch, FileText, X, AlertCircle } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';

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
  }, [branchFromMessage, parentCardId, messageIndex, onClose, onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={`
          absolute z-50 w-72 bg-bg-secondary rounded-lg border border-border-default
          shadow-xl shadow-black/50
          ${position === 'right' ? 'left-full ml-2' : 'right-full mr-2'}
        `}
        style={{ top: '-8px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
          <div className="flex items-center gap-2 text-sm font-medium text-fg-primary">
            <GitBranch className="w-4 h-4 text-accent-primary" />
            <span>Branch from message {messageIndex + 1}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary text-fg-tertiary hover:text-fg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Context Info */}
        <div className="px-3 py-2 bg-bg-tertiary text-xs text-fg-tertiary">
          <div className="flex justify-between">
            <span>Messages to inherit:</span>
            <span className="text-fg-secondary">{contextMessageCount} of {totalMessages}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Estimated tokens:</span>
            <span className="text-fg-secondary">~{estimatedTokens}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-fg-secondary">
            <FileText className="w-3 h-3" />
            <span>Full context inheritance</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-3 mb-2 px-3 py-2 bg-error-bg border border-error-border rounded-md flex items-center gap-2 text-xs text-error-fg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 p-3 pt-1 border-t border-border-default">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="flex-1 px-3 py-2 text-sm font-medium text-fg-secondary bg-bg-tertiary hover:bg-bg-inset rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateBranch}
            disabled={isCreating}
            className="flex-1 px-3 py-2 text-sm font-medium text-accent-contrast bg-accent-primary hover:brightness-110 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-accent-contrast/30 border-t-accent-contrast rounded-full"
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
        <div className="px-3 pb-2 text-xs text-fg-tertiary text-center">
          Tip: Use <kbd className="px-1 py-0.5 bg-bg-tertiary rounded text-fg-secondary">Ctrl+B</kbd> for keyboard workflow
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default InlineBranchPanel;
