import type { OnboardingStep } from '@/stores/onboarding-store';

export interface OnboardingGuardState {
  active: boolean;
  step: OnboardingStep;
  rootCardId: string | null;
  branch1CardId: string | null;
  branch2CardId: string | null;
}

export function canCreateConversation(state: OnboardingGuardState): boolean {
  return !state.active || state.step === 'idle';
}

export function canMutateWorkspaces(state: OnboardingGuardState): boolean {
  return !state.active;
}

export function canDeleteConversations(state: OnboardingGuardState): boolean {
  return !state.active;
}

export function canUserCloseChatPanel(state: OnboardingGuardState): boolean {
  return !state.active;
}

export function canBranchFromCard(state: OnboardingGuardState, sourceCardId: string): boolean {
  if (!state.active) return true;

  if (state.step === 'branch-1-hint') {
    return sourceCardId === state.rootCardId && !state.branch1CardId;
  }

  if (state.step === 'branch-2-hint') {
    return sourceCardId === state.rootCardId && !state.branch2CardId;
  }

  return false;
}

export function canMergeSelectedCards(state: OnboardingGuardState, selectedIds: string[]): boolean {
  if (!state.active) return true;
  if (state.step !== 'merge-hint') return false;
  if (!state.branch1CardId || !state.branch2CardId) return false;
  if (selectedIds.length !== 2) return false;

  const selectedSet = new Set(selectedIds);
  return selectedSet.has(state.branch1CardId) && selectedSet.has(state.branch2CardId);
}
