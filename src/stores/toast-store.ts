'use client';

/**
 * Toast Store - Global toast notification management
 * 
 * Provides a centralized toast system with queue management,
 * auto-dismiss, and action support. Extracted from UndoToast pattern.
 * 
 * @version 4.0.0
 */

import { create } from 'zustand';
import { nanoid } from 'nanoid';

// =============================================================================
// TYPES
// =============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
  duration?: number; // ms, 0 = no auto-dismiss
  createdAt: Date;
}

export interface ToastOptions {
  action?: ToastAction;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  
  // Actions
  addToast: (type: ToastType, message: string, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
  
  // Convenience methods
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 5000; // 5 seconds

// =============================================================================
// STORE
// =============================================================================

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  
  addToast: (type, message, options) => {
    const id = nanoid(8);
    const toast: Toast = {
      id,
      type,
      message,
      action: options?.action,
      duration: options?.duration ?? DEFAULT_DURATION,
      createdAt: new Date(),
    };
    
    set((state) => {
      // Limit queue size - remove oldest if at max
      const newToasts = [...state.toasts, toast];
      if (newToasts.length > MAX_TOASTS) {
        return { toasts: newToasts.slice(-MAX_TOASTS) };
      }
      return { toasts: newToasts };
    });
    
    return id;
  },
  
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  
  clearAll: () => {
    set({ toasts: [] });
  },
  
  // Convenience methods
  success: (message, options) => get().addToast('success', message, options),
  error: (message, options) => get().addToast('error', message, options),
  warning: (message, options) => get().addToast('warning', message, options),
  info: (message, options) => get().addToast('info', message, options),
}));

// =============================================================================
// HOOK FOR EASY ACCESS
// =============================================================================

/**
 * Hook to access toast methods
 * 
 * @example
 * const toast = useToast();
 * toast.success('Saved successfully!');
 * toast.error('Something went wrong', { duration: 10000 });
 * toast.warning('Are you sure?', { action: { label: 'Undo', onClick: handleUndo } });
 */
export function useToast() {
  const { success, error, warning, info, dismissToast, clearAll } = useToastStore();
  
  return {
    success,
    error,
    warning,
    info,
    dismiss: dismissToast,
    clearAll,
  };
}

export default useToastStore;
