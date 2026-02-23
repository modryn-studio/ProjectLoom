/**
 * Trial Store
 *
 * Client-side state for platform-funded trial access.
 * The authoritative usage count lives in the server cookie — this store
 * mirrors it for UI display (progress bar, exhaustion state).
 *
 * This is a Zustand store with `persist` for cross-tab consistency,
 * but the server cookie is the real enforcement mechanism.
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// TYPES
// =============================================================================

export interface TrialState {
  /** Number of trial messages used (synced from server cookie via response headers) */
  messagesUsed: number;
  /** Maximum free messages allowed (from NEXT_PUBLIC_TRIAL_REQUEST_CAP) */
  cap: number;
  /** Whether the user has explicitly dismissed trial (added BYOK key) */
  dismissed: boolean;
}

export interface TrialActions {
  /** Sync usage count from server response */
  syncFromServer: (messagesUsed: number) => void;
  /** Mark trial as dismissed (user added their own API key) */
  dismiss: () => void;
  /** Reset trial state (for testing/dev) */
  reset: () => void;
}

export type TrialStore = TrialState & TrialActions;

// =============================================================================
// DEFAULTS
// =============================================================================

// NEXT_PUBLIC_* vars are inlined at build time by Next.js — no runtime check needed
const DEFAULT_CAP = parseInt(process.env.NEXT_PUBLIC_TRIAL_REQUEST_CAP ?? '20', 10);

// =============================================================================
// STORE
// =============================================================================

export const useTrialStore = create<TrialStore>()(
  persist(
    (set) => ({
      // State
      messagesUsed: 0,
      cap: isNaN(DEFAULT_CAP) ? 20 : DEFAULT_CAP,
      dismissed: false,

      // Actions
      syncFromServer: (messagesUsed: number) =>
        set({ messagesUsed }),

      dismiss: () =>
        set({ dismissed: true }),

      reset: () =>
        set({ messagesUsed: 0, dismissed: false }),
    }),
    {
      name: 'projectloom:trial',
    },
  ),
);

// =============================================================================
// SELECTORS
// =============================================================================

/** True when: trial mode is enabled, user has no BYOK keys, and cap not exhausted */
export function selectIsTrialActive(state: TrialStore): boolean {
  return !state.dismissed && state.messagesUsed < state.cap;
}

/** True when the user has exhausted all free messages */
export function selectIsTrialExhausted(state: TrialStore): boolean {
  return !state.dismissed && state.messagesUsed >= state.cap;
}

/** Remaining free messages */
export function selectTrialRemaining(state: TrialStore): number {
  return Math.max(0, state.cap - state.messagesUsed);
}
