/**
 * Onboarding Store (v3)
 *
 * Manages the scripted interactive onboarding flow. The user creates their
 * first card, then watches a scripted conversation unfold while performing
 * branch and merge actions to learn the tool.
 *
 * Steps:
 *   1. intro          — pain statement overlay: "Every time you wanted to explore a different angle..."
 *   2. idle            — waiting for user to create their first card
 *   3. auto-chat-0     — root card: auto-type + send "I got a job offer…"
 *   4. branch-1-hint   — spotlight root card: "Right-click → Branch from here"
 *   5. auto-chat-1     — branch 1: auto-type + send "What questions should I ask…"
 *   6. branch-2-hint   — spotlight root card again for second branch
 *   7. auto-chat-2     — branch 2: auto-type + send "What would I give up…"
 *   8. reflect         — canvas-only overlay: "You forked your thinking"
 *   9. merge-hint      — spotlight: "Shift-click both, then Merge"
 *   10. auto-chat-3    — merge card: auto-type + send "Help me make the call"
 *   11. complete       — two-button overlay: Clear / Keep
 *
 * @version 3.0.0
 */

import { create } from 'zustand';

// =============================================================================
// TYPES
// =============================================================================

export type OnboardingStep =
  | 'intro'
  | 'idle'
  | 'auto-chat-0'
  | 'branch-1-hint'
  | 'auto-chat-1'
  | 'branch-2-hint'
  | 'auto-chat-2'
  | 'reflect'
  | 'merge-hint'
  | 'auto-chat-3'
  | 'complete';

const STEP_ORDER: OnboardingStep[] = [
  'intro',
  'idle',
  'auto-chat-0',
  'branch-1-hint',
  'auto-chat-1',
  'branch-2-hint',
  'auto-chat-2',
  'reflect',
  'merge-hint',
  'auto-chat-3',
  'complete',
];

/** Scripted prompts that auto-type into the chat input during onboarding */
export const ONBOARDING_PROMPTS: Record<string, string> = {
  'auto-chat-0': 'I got a job offer. It pays 40% more but means leaving a team I love. Help me think through this.',
  'auto-chat-1': 'What questions should I be asking about this offer before deciding?',
  'auto-chat-2': 'What would I actually be giving up if I leave my current role?',
  'auto-chat-3': "I've explored both sides. Help me make the actual call.",
};

export interface OnboardingState {
  /** Whether the guided onboarding is currently active */
  active: boolean;
  /** Current step in the onboarding flow */
  step: OnboardingStep;
  /** ID of the first card created during onboarding */
  rootCardId: string | null;
  /** ID of the first branch card */
  branch1CardId: string | null;
  /** ID of the second branch card */
  branch2CardId: string | null;
  /** ID of the merge card */
  mergeCardId: string | null;
  /** Pending message to auto-type into the chat input */
  pendingMessage: { cardId: string; text: string } | null;
  /** Whether auto-typing is currently in progress (blocks user input) */
  isAutoTyping: boolean;
}

export interface OnboardingActions {
  /** Start the onboarding flow (transitions from idle to auto-chat-0) */
  startOnboarding: () => void;
  /** Advance to the next step */
  nextStep: () => void;
  /** Jump to a specific step */
  goToStep: (step: OnboardingStep) => void;
  /** Mark onboarding as complete and persist */
  completeOnboarding: () => void;
  /** Dismiss / skip onboarding */
  dismissOnboarding: () => void;
  /** Store the root card ID and begin auto-chat-0 */
  setRootCardId: (id: string) => void;
  /** Store branch 1 card ID */
  setBranch1CardId: (id: string) => void;
  /** Store branch 2 card ID */
  setBranch2CardId: (id: string) => void;
  /** Store merge card ID */
  setMergeCardId: (id: string) => void;
  /** Set pending message for auto-typing */
  setPendingMessage: (msg: { cardId: string; text: string } | null) => void;
  /** Set auto-typing state */
  setIsAutoTyping: (typing: boolean) => void;
  /** Clear pending message */
  clearPendingMessage: () => void;
  /** Restart the onboarding flow from the beginning */
  replayOnboarding: () => void;
}

// =============================================================================
// STORE
// =============================================================================

const ONBOARDING_SEEN_KEY = 'projectloom:onboarding-v2';

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  (set, get) => ({
    // State
    active: false,
    step: 'idle',
    rootCardId: null,
    branch1CardId: null,
    branch2CardId: null,
    mergeCardId: null,
    pendingMessage: null,
    isAutoTyping: false,

    // Actions
    startOnboarding: () => set({
      active: true,
      step: 'intro',
      rootCardId: null,
      branch1CardId: null,
      branch2CardId: null,
      mergeCardId: null,
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

    completeOnboarding: () => {
      set({
        active: false,
        step: 'complete',
        pendingMessage: null,
        isAutoTyping: false,
      });
      try {
        localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
      } catch { /* SSR / storage full — ignore */ }
    },

    dismissOnboarding: () => {
      get().completeOnboarding();
    },

    setRootCardId: (id) => set({ rootCardId: id }),
    setBranch1CardId: (id) => set({ branch1CardId: id }),
    setBranch2CardId: (id) => set({ branch2CardId: id }),
    setMergeCardId: (id) => set({ mergeCardId: id }),

    setPendingMessage: (msg) => set({ pendingMessage: msg }),
    setIsAutoTyping: (typing) => set({ isAutoTyping: typing }),
    clearPendingMessage: () => set({ pendingMessage: null, isAutoTyping: false }),

    replayOnboarding: () => {
      get().startOnboarding();
    },
  }),
);

/** Check if onboarding has been completed before */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}
