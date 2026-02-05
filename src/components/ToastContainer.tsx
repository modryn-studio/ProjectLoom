'use client';

/**
 * ToastContainer - Renders toast notification stack
 * 
 * Displays toasts with animations, auto-dismiss progress bars, and actions.
 * Follows UndoToast visual pattern with semantic color variants.
 * 
 * @version 4.0.0
 */

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, Toast, ToastType } from '@/stores/toast-store';
import { zIndex } from '@/constants/zIndex';

// =============================================================================
// CONSTANTS
// =============================================================================

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: 'border-emerald-500/30',
  error: 'border-red-500/30',
  warning: 'border-amber-500/30',
  info: 'border-blue-500/30',
};

const PROGRESS_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

// =============================================================================
// SINGLE TOAST COMPONENT
// =============================================================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-dismiss
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      timeoutRef.current = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [toast.id, toast.duration, onDismiss]);
  
  const handleActionClick = useCallback(() => {
    // Clear auto-dismiss timeout to prevent redundant dismiss call
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    toast.action?.onClick();
    onDismiss(toast.id);
  }, [toast.action, toast.id, onDismiss]);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="relative"
    >
      <div 
        className={`flex items-center gap-3 px-4 py-3 bg-zinc-900 border ${BORDER_COLORS[toast.type]} rounded-lg shadow-xl shadow-black/40 min-w-70 max-w-100`}
      >
        {/* Icon */}
        {ICONS[toast.type]}
        
        {/* Message */}
        <span className="text-sm text-zinc-200 flex-1">
          {toast.message}
        </span>
        
        {/* Actions */}
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {toast.action && (
            <button
              onClick={handleActionClick}
              className="flex items-center gap-1 px-2 py-1 text-sm font-medium text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded transition-colors"
            >
              {toast.action.label}
            </button>
          )}
          
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Progress bar for auto-hide */}
      {toast.duration && toast.duration > 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
          className={`absolute bottom-0 left-0 right-0 h-0.5 ${PROGRESS_COLORS[toast.type]} origin-left rounded-b-lg`}
        />
      )}
    </motion.div>
  );
}

// =============================================================================
// TOAST CONTAINER
// =============================================================================

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);
  
  return (
    <div 
      className="fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none"
      style={{ zIndex: zIndex.overlay.notification }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ToastContainer;
