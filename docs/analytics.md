# Analytics Setup

## Stack

- **GA4** — custom events via `gtag()`, loaded in `layout.tsx` via `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Vercel Analytics free tier only tracks pageviews — custom events require Pro. GA4 is free and more powerful for funnel analysis anyway.

## The Abstraction

`src/lib/analytics.ts` — one file, two responsibilities:

1. `track(eventName, props)` — fires to GA4, SSR-safe
2. Named helper methods (e.g. `analytics.branchCreated('drag')`) — typed, discoverable, no magic strings scattered around the codebase

```ts
import { analytics } from '@/lib/analytics';
analytics.canvasLoaded({ is_first_visit: true, has_api_key: false });
```

## Events Instrumented

| Event | Properties | Where |
|---|---|---|
| `canvas_loaded` | `is_first_visit`, `has_api_key` | `canvas/page.tsx` on store init |
| `onboarding_step_reached` | `step` | `OnboardingGuide.tsx` on every step transition |
| `onboarding_completed` | `choice: clear\|keep` | `OnboardingGuide.tsx` — completion buttons |
| `onboarding_abandoned` | `last_step` | `OnboardingGuide.tsx` — X button |
| `api_key_saved` | `provider: anthropic\|openai\|both`, `was_trial_exhausted` | `APIKeySetupModal.tsx` |
| `first_real_message` | `has_api_key`, `model` | `ChatPanel.tsx` — fired once via localStorage flag |
| `trial_message_sent` | `message_number` | `ChatPanel.tsx` — each trial-funded message |
| `trial_exhausted` | — | `ChatPanel.tsx` — on TRIAL_EXHAUSTED error |
| `branch_created` | `method: context_menu\|drag\|keyboard` | `ConversationCard.tsx`, `InfiniteCanvas.tsx` |
| `merge_completed` | `card_count` | `MultiSelectFloatingBar.tsx` |

## The Funnel to Build in GA4

Go to **Explore → Funnel exploration** and add these steps in order:

```
canvas_loaded (is_first_visit = true)
  → onboarding_completed
    → first_real_message
      → trial_exhausted
        → api_key_saved
```

This gives you conversion rate at every step. The gap between `trial_exhausted` and `api_key_saved` is your biggest lever.

## "First Real Message" Pattern

Uses a localStorage flag (`projectloom:first-message-fired`) to fire exactly once per device/browser. Works without a user account. Simple and reliable for anonymous users.

## Lessons for Future Projects

- **Add analytics on day 1**, even if you don't look at the data for weeks. The event history is what's valuable.
- **Vercel Analytics free tier** only tracks pageviews. Don't bother with their `track()` API unless you're on Pro — GA4 is free and has better funnel tooling.
- **Build the abstraction layer immediately** (`analytics.ts`). Calling `gtag()` directly across 10 files is a maintenance nightmare.
- **The funnel is the product** — instrument the exact journey you want users to take, not just generic events.
- **Trial-to-BYOK conversion** is the single most important metric for a freemium BYOK product. `trial_exhausted → api_key_saved` tells you everything.
- For per-user API usage in the OpenAI/Anthropic console: pass `user: hashedUserId` in every API call body. The trial cookie `sessionId` is a stable anonymous ID that works without accounts.
