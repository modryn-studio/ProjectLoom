/**
 * Analytics
 *
 * Thin wrapper around GA4 (via gtag). SSR-safe — all calls are no-ops on the server.
 *
 * Usage:
 *   import { analytics } from '@/lib/analytics';
 *   analytics.canvasLoaded({ is_first_visit: true, has_api_key: false });
 */

// =============================================================================
// GA4 HELPER
// =============================================================================

// gtag is injected by the <Script> in layout.tsx — declare it so TS is happy.
declare global {
  function gtag(...args: unknown[]): void;
}

function ga(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params ?? {});
}

// =============================================================================
// CORE TRACK FUNCTION
// =============================================================================

/**
 * Fire an analytics event to GA4 + Vercel Analytics simultaneously.
 * Properties must be JSON-serialisable primitives (string | number | boolean).
 */
export function track(
  eventName: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return;

  // GA4
  ga(eventName, props);
}

// =============================================================================
// TYPED EVENT HELPERS
// =============================================================================

export const analytics = {
  // ── Canvas ──────────────────────────────────────────────────────────────────

  canvasLoaded(props: { is_first_visit: boolean; has_api_key: boolean }) {
    track('canvas_loaded', props);
  },

  // ── Onboarding ──────────────────────────────────────────────────────────────

  onboardingStarted() {
    track('onboarding_started');
  },

  onboardingStepReached(step: string) {
    track('onboarding_step_reached', { step });
  },

  onboardingCompleted(choice: 'clear' | 'keep') {
    track('onboarding_completed', { choice });
  },

  onboardingAbandoned(last_step: string) {
    track('onboarding_abandoned', { last_step });
  },

  // ── API Keys ─────────────────────────────────────────────────────────────────

  apiKeySaved(props: {
    provider: 'anthropic' | 'openai' | 'both';
    was_trial_exhausted: boolean;
  }) {
    track('api_key_saved', props);
  },

  // ── Messages ─────────────────────────────────────────────────────────────────

  /** First real (non-onboarding) message sent */
  firstRealMessage(props: { has_api_key: boolean; model: string }) {
    track('first_real_message', props);
  },

  /** A trial-funded message was sent */
  trialMessageSent(message_number: number) {
    track('trial_message_sent', { message_number });
  },

  /** User hit the 20-message trial wall */
  trialExhausted() {
    track('trial_exhausted');
  },

  // ── Canvas Actions ────────────────────────────────────────────────────────────

  branchCreated(method: 'context_menu' | 'drag' | 'keyboard') {
    track('branch_created', { method });
  },

  mergeCompleted(card_count: number) {
    track('merge_completed', { card_count });
  },
};
