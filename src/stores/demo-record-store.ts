/**
 * Demo Recording Store
 *
 * A lightweight state machine for the `?demo=record` screen recording mode.
 * Reuses the same pendingMessage / isAutoTyping pattern as onboarding-store
 * so MessageInput can subscribe and auto-type without changes.
 *
 * Flow (4-card "difficult conversation" scenario):
 *   1. demo-idle           — waiting to start (brief delay after page load)
 *   2. demo-root-chat      — root card created, auto-type first prompt
 *   3. demo-wait-branch-a  — waiting for user to create branch A from root
 *   4. demo-branch-a-chat  — auto-type Branch A prompt
 *   5. demo-wait-branch-b  — waiting for user to create branch B from root
 *   6. demo-branch-b-chat  — auto-type Branch B prompt
 *   7. demo-wait-merge-1   — waiting for user to merge Branch A + B
 *   8. demo-merge-1-chat   — auto-type merge prompt → complete
 *   9. demo-complete       — done
 *
 * @version 2.0.0
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
  'demo-complete',
];

/** Scripted prompts that auto-type into the chat input during demo recording */
export const DEMO_PROMPTS: Record<string, string> = {
  'demo-root-chat':
    "I need to have a difficult conversation with my manager about being consistently passed over for promotion despite strong performance reviews. How do I approach this without damaging the relationship?",
  'demo-branch-a-chat':
    'Help me prepare the direct case — what specifically should I say, what evidence should I bring, and how do I open the conversation?',
  'demo-branch-b-chat':
    'How do I manage myself emotionally during this conversation? What if they get defensive or dismiss my concerns?',
  'demo-merge-1-chat':
    'Combine the preparation strategy with the emotional management advice into a single conversation plan I can actually follow tomorrow.',
};

export interface DemoRecordState {
  /** Whether demo recording mode is active */
  active: boolean;
  /** Current step */
  step: DemoRecordStep;
  /** ID of the root card */
  rootCardId: string | null;
  /** ID of branch A (direct case) */
  branchACardId: string | null;
  /** ID of branch B (emotional management) */
  branchBCardId: string | null;
  /** ID of merge card 1 (conversation plan) */
  merge1CardId: string | null;
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

    setPendingMessage: (msg) => set({ pendingMessage: msg }),
    setIsAutoTyping: (typing) => set({ isAutoTyping: typing }),
    clearPendingMessage: () => set({ pendingMessage: null, isAutoTyping: false }),
  }),
);
