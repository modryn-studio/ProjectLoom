/**
 * Branch Suggestion Store
 *
 * Ephemeral UI state for AI-detected decision forks. Suggestions are transient —
 * they are not persisted to localStorage or the Conversation model. They appear
 * inline in the MessageThread and disappear when accepted or dismissed.
 *
 * @version 1.0.0
 */

import { create } from 'zustand';

// =============================================================================
// TYPES
// =============================================================================

export interface BranchSuggestion {
  title: string;
  seedPrompt: string;
}

export interface PendingSuggestion {
  /** The conversation card this suggestion belongs to */
  conversationId: string;
  /** The message index of the AI response that triggered the suggestion */
  messageIndex: number;
  /** The detected branches */
  branches: BranchSuggestion[];
}

interface BranchSuggestionState {
  /** Active suggestion per conversation (only one at a time per card) */
  suggestions: Map<string, PendingSuggestion>;

  /** Set a suggestion for a conversation — replaces any previous suggestion */
  setSuggestion: (suggestion: PendingSuggestion) => void;

  /** Clear the suggestion for a conversation (accepted or dismissed) */
  clearSuggestion: (conversationId: string) => void;

  /** Clear all suggestions (e.g. workspace switch) */
  clearAll: () => void;
}

// =============================================================================
// STORE
// =============================================================================

export const useBranchSuggestionStore = create<BranchSuggestionState>()(
  (set) => ({
    suggestions: new Map(),

    setSuggestion: (suggestion) =>
      set((state) => {
        const next = new Map(state.suggestions);
        next.set(suggestion.conversationId, suggestion);
        return { suggestions: next };
      }),

    clearSuggestion: (conversationId) =>
      set((state) => {
        const next = new Map(state.suggestions);
        next.delete(conversationId);
        return { suggestions: next };
      }),

    clearAll: () => set({ suggestions: new Map() }),
  }),
);
