/**
 * Demo Recording Store
 *
 * A lightweight state machine for the `?demo=record` screen recording mode.
 * Reuses the same pendingMessage / isAutoTyping pattern as onboarding-store
 * so MessageInput can subscribe and auto-type without changes.
 *
 * Flow:
 *   1. demo-idle           — waiting to start (brief delay after page load)
 *   2. demo-root-chat      — root card created, auto-type first prompt
 *   3. demo-wait-branch-a  — waiting for user to create branch A from root
 *   4. demo-branch-a-chat  — auto-type Branch A prompt
 *   5. demo-wait-branch-b  — waiting for user to create branch B from root
 *   6. demo-branch-b-chat  — auto-type Branch B prompt
 *   7. demo-wait-merge-1   — waiting for user to merge Branch A + B
 *   8. demo-merge-1-chat   — auto-type merge prompt
 *   9. demo-wait-branch-c  — waiting for user to branch from merge card
 *  10. demo-branch-c-chat  — auto-type review prompt
 *  11. demo-wait-merge-2   — waiting for user to merge Merge1 + Branch C
 *  12. demo-merge-2-chat   — auto-type final merge prompt
 *  13. demo-complete       — done
 *
 * @version 1.0.0
 */

import { create } from 'zustand';

// =============================================================================
// TYPES
// =============================================================================

export type DemoRecordStep =
  | 'demo-idle'
  | 'demo-root-chat'
  | 'demo-wait-branch-a'
  | 'demo-branch-a-chat'
  | 'demo-wait-branch-b'
  | 'demo-branch-b-chat'
  | 'demo-wait-merge-1'
  | 'demo-merge-1-chat'
  | 'demo-wait-branch-c'
  | 'demo-branch-c-chat'
  | 'demo-wait-merge-2'
  | 'demo-merge-2-chat'
  | 'demo-complete';

const STEP_ORDER: DemoRecordStep[] = [
  'demo-idle',
  'demo-root-chat',
  'demo-wait-branch-a',
  'demo-branch-a-chat',
  'demo-wait-branch-b',
  'demo-branch-b-chat',
  'demo-wait-merge-1',
  'demo-merge-1-chat',
  'demo-wait-branch-c',
  'demo-branch-c-chat',
  'demo-wait-merge-2',
  'demo-merge-2-chat',
  'demo-complete',
];

/** Scripted prompts that auto-type into the chat input during demo recording */
export const DEMO_PROMPTS: Record<string, string> = {
  'demo-root-chat':
    "I'm a UI/UX designer with 4 years of agency experience. I'm seriously thinking about going freelance. Is this a good move, and where do I even start?",
  'demo-branch-a-chat':
    'How do I build a client pipeline before I quit my job?',
  'demo-branch-b-chat':
    'How much money do I need saved, and how should I price my work?',
  'demo-merge-1-chat':
    'Combine the client pipeline strategy and the financial advice into a concrete 90-day action plan for making this transition.',
  'demo-branch-c-chat':
    "Review this 90-day plan critically. What are the gaps, risks, and things I haven't thought about?",
  'demo-merge-2-chat':
    'Update the 90-day plan to address the gaps and risks identified in the review. Give me the complete, final version.',
};

export interface DemoRecordState {
  /** Whether demo recording mode is active */
  active: boolean;
  /** Current step */
  step: DemoRecordStep;
  /** ID of the root card */
  rootCardId: string | null;
  /** ID of branch A (pipeline) */
  branchACardId: string | null;
  /** ID of branch B (financial) */
  branchBCardId: string | null;
  /** ID of merge card 1 (90-day plan) */
  merge1CardId: string | null;
  /** ID of branch C (review) */
  branchCCardId: string | null;
  /** ID of merge card 2 (final plan) */
  merge2CardId: string | null;
  /** Pending message to auto-type (same shape as onboarding store) */
  pendingMessage: { cardId: string; text: string } | null;
  /** Whether auto-typing is in progress */
  isAutoTyping: boolean;
}

export interface DemoRecordActions {
  /** Activate demo recording mode */
  startDemoRecord: () => void;
  /** Advance to the next step */
  nextStep: () => void;
  /** Jump to a specific step */
  goToStep: (step: DemoRecordStep) => void;
  /** Mark demo recording as complete */
  completeDemoRecord: () => void;
  /** Store card IDs as they are created */
  setRootCardId: (id: string) => void;
  setBranchACardId: (id: string) => void;
  setBranchBCardId: (id: string) => void;
  setMerge1CardId: (id: string) => void;
  setBranchCCardId: (id: string) => void;
  setMerge2CardId: (id: string) => void;
  /** Pending message mechanics (mirrors onboarding store) */
  setPendingMessage: (msg: { cardId: string; text: string } | null) => void;
  setIsAutoTyping: (typing: boolean) => void;
  clearPendingMessage: () => void;
}

// =============================================================================
// STORE
// =============================================================================

export const useDemoRecordStore = create<DemoRecordState & DemoRecordActions>()(
  (set, get) => ({
    // State
    active: false,
    step: 'demo-idle',
    rootCardId: null,
    branchACardId: null,
    branchBCardId: null,
    merge1CardId: null,
    branchCCardId: null,
    merge2CardId: null,
    pendingMessage: null,
    isAutoTyping: false,

    // Actions
    startDemoRecord: () =>
      set({
        active: true,
        step: 'demo-idle',
        rootCardId: null,
        branchACardId: null,
        branchBCardId: null,
        merge1CardId: null,
        branchCCardId: null,
        merge2CardId: null,
        pendingMessage: null,
        isAutoTyping: false,
      }),

    nextStep: () => {
      const { step } = get();
      const idx = STEP_ORDER.indexOf(step);
      if (idx < STEP_ORDER.length - 1) {
        set({ step: STEP_ORDER[idx + 1] });
      }
    },

    goToStep: (step) => set({ step }),

    completeDemoRecord: () =>
      set({
        active: false,
        step: 'demo-complete',
        pendingMessage: null,
        isAutoTyping: false,
      }),

    setRootCardId: (id) => set({ rootCardId: id }),
    setBranchACardId: (id) => set({ branchACardId: id }),
    setBranchBCardId: (id) => set({ branchBCardId: id }),
    setMerge1CardId: (id) => set({ merge1CardId: id }),
    setBranchCCardId: (id) => set({ branchCCardId: id }),
    setMerge2CardId: (id) => set({ merge2CardId: id }),

    setPendingMessage: (msg) => set({ pendingMessage: msg }),
    setIsAutoTyping: (typing) => set({ isAutoTyping: typing }),
    clearPendingMessage: () => set({ pendingMessage: null, isAutoTyping: false }),
  }),
);
