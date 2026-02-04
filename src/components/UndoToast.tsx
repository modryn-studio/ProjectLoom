'use client';

/**
 * UndoToast - Lightweight undo notification for branch/merge actions
 * 
 * Shows toast after creating branches or merge nodes with quick undo option.
 * Auto-hides after 5 seconds per spec.
 * 
 * @version 4.0.0
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, GitMerge, Trash2, X, Undo2 } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';

// =============================================================================
// TYPES
// =============================================================================

type ActionType = 'branch' | 'merge' | 'delete';

interface ToastState {
  type: ActionType;
  message: string;
  timestamp: Date;
  canUndo: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const AUTO_HIDE_MS = 5000; // 5 seconds per spec

const ICONS: Record<ActionType, React.ReactNode> = {
  branch: <GitBranch className="w-4 h-4 text-amber-400" />,
  merge: <GitMerge className="w-4 h-4 text-emerald-400" />,
  delete: <Trash2 className="w-4 h-4 text-red-400" />,
};

// =============================================================================
// COMPONENT
// =============================================================================

export function UndoToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store state - use primitive selectors to avoid infinite loops
  const undo = useCanvasStore((s) => s.undo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const conversations = useCanvasStore((s) => s.conversations);
  const conversationCount = conversations.size;
  const edgeCount = useCanvasStore((s) => s.edges.length);
  
  // Track previous counts to detect changes
  const prevConversationCount = useRef(conversationCount);
  const prevEdgeCount = useRef(edgeCount);

  const showToast = useCallback((newToast: ToastState) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setToast(newToast);
    
    // Auto-hide after 5 seconds
    timeoutRef.current = setTimeout(() => {
      setToast(null);
    }, AUTO_HIDE_MS);
  }, []);

  // Detect branch/merge creation (simplified - checks count changes only)
  useEffect(() => {
    const currentCount = conversationCount;
    
    // Check if a new conversation was added
    if (currentCount > prevConversationCount.current) {
      // Find the newest conversation by createdAt timestamp
      const convArray = Array.from(conversations.values());
      const newest = convArray.reduce((latest, conv) => 
        (!latest || new Date(conv.metadata.createdAt) > new Date(latest.metadata.createdAt)) ? conv : latest
      , convArray[0]);
      
      if (newest) {
        if (newest.isMergeNode) {
          showToast({
            type: 'merge',
            message: `Merge node created from ${newest.parentCardIds?.length || 0} sources`,
            timestamp: new Date(),
            canUndo: canUndo(),
          });
        } else if (newest.parentCardIds?.length > 0) {
          showToast({
            type: 'branch',
            message: `Branch created from message ${(newest.branchPoint?.messageIndex ?? 0) + 1}`,
            timestamp: new Date(),
            canUndo: canUndo(),
          });
        }
      }
    }
    
    // Track deletion (fewer conversations)
    if (currentCount < prevConversationCount.current) {
      showToast({
        type: 'delete',
        message: 'Conversation deleted',
        timestamp: new Date(),
        canUndo: canUndo(),
      });
    }
    
    prevConversationCount.current = currentCount;
    prevEdgeCount.current = edgeCount;
  }, [conversationCount, edgeCount, canUndo, showToast, conversations]);

  const handleUndo = useCallback(() => {
    undo();
    setToast(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [undo]);

  const handleDismiss = useCallback(() => {
    setToast(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-4 right-4 z-50"
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl shadow-black/40">
            {/* Icon */}
            {ICONS[toast.type]}
            
            {/* Message */}
            <span className="text-sm text-zinc-200">
              {toast.message}
            </span>
            
            {/* Actions */}
            <div className="flex items-center gap-2 ml-2">
              {toast.canUndo && (
                <button
                  onClick={handleUndo}
                  className="flex items-center gap-1 px-2 py-1 text-sm font-medium text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Undo
                </button>
              )}
              
              <button
                onClick={handleDismiss}
                className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Progress bar for auto-hide */}
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: AUTO_HIDE_MS / 1000, ease: 'linear' }}
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-600 origin-left rounded-b-lg"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default UndoToast;
