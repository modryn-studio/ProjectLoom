Should pricing be centralized by reusing the existing cost logic (likely in the Vercel integration) or added as a new standalone utility as described in the issue?

Centralize in the existing Vercel integration file (`src/lib/vercel-ai-integration.ts`).

**Reasons:**

1. **Single source of truth** - Pricing already lives alongside model definitions there
2. **Consistency** - Usage tracking should reference the same pricing that powers model selection UI
3. **Maintainability** - Update pricing in one place when rates change
4. **Logical grouping** - Model metadata + pricing belong together

**Recommended structure:**

```typescript
// src/lib/vercel-ai-integration.ts

export const MODEL_PRICING = {
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-4-20250514': { input: 0.25, output: 1.25 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
} as const;

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
  if (!pricing) return 0;
  
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}
```

Then import in usage store: `import { calculateCost } from '@/lib/vercel-ai-integration'`

---

If token usage is unavailable for a response, how should it be recorded?

**Don't record it at all.** Skip the usage record entirely.

**Reasoning:**

1. **Accuracy over completeness** - Recording $0.00 or estimated values pollutes data
2. **API errors shouldn't count** - If tokens are missing, the request likely failed
3. **Honest tracking** - Better to have gaps than inaccurate data

**Implementation:**

```typescript
// In ChatPanel.tsx
const inputTokens = parseInt(response.headers.get('X-Usage-Input-Tokens') || '0');
const outputTokens = parseInt(response.headers.get('X-Usage-Output-Tokens') || '0');

// Only record if we have real token data
if (inputTokens > 0 || outputTokens > 0) {
  addUsage({
    provider: selectedModel.startsWith('claude') ? 'anthropic' : 'openai',
    model: selectedModel,
    inputTokens,
    outputTokens,
    conversationId: activeConversation,
  });
}
```

**Edge case:** If Vercel AI SDK consistently returns token data for successful requests, missing tokens = failed request = don't charge user = don't record.

---

Should “Clear All History” require a confirmation dialog?

**Yes, add confirmation.**

**Reasoning:**

1. **Irreversible action** - Can't undo, data is gone forever
2. **User mistake prevention** - Button placed near other controls, easy misclick
3. **Data value** - Historical spending data has long-term value (taxes, budgeting, reporting)

**Implementation:**

```typescript
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline" size="sm">
      Clear All History
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Clear all usage history?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete all spending records. This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={clearHistory}>
        Clear History
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Use shadcn/ui `AlertDialog` component (already in design system).

---

If we can’t wire all routes at once, should we ship chat-only usage tracking first?

**Yes, ship chat-only first.**

**Phased rollout:**

**Phase 1 (MVP):**
- ChatPanel only
- Ships faster, gets user feedback sooner
- Covers 80% of API usage (chat is primary feature)

**Phase 2 (Follow-up):**
- Agent workflows (`/api/agent/route.ts`)
- Summary generation (`/api/summarize/route.ts`)

**Benefits:**
- Iterative development (New World methodology)
- Early validation of UI/UX
- Can adjust based on real usage patterns
- Unblocks users who primarily care about chat costs

**Note in UI:**
Add small disclaimer: *"Currently tracking chat usage only. Agent workflows coming soon."*

Remove once all routes wired.

---

For streaming chat responses, if exact token usage isn’t available, should we estimate tokens (approx) so costs still show up?

**No, don't estimate.** Wait for actual token usage from response headers.

**Reasoning:**

1. **Vercel AI SDK provides exact tokens** - Available in `usage` object after streaming completes
2. **Estimates = inaccurate data** - Would need complex token counting logic, still wrong
3. **Headers work for streaming** - Response headers accessible before/during stream

**Correct implementation:**

```typescript
// Vercel AI SDK streaming already provides usage
const response = await fetch('/api/chat', { ... });

// Headers contain exact token counts even for streaming
const inputTokens = parseInt(response.headers.get('X-Usage-Input-Tokens') || '0');
const outputTokens = parseInt(response.headers.get('X-Usage-Output-Tokens') || '0');

if (inputTokens > 0 || outputTokens > 0) {
  addUsage({ ... }); // Use real data
}
```

The API route already has access to exact usage via `result.usage` - just pass it through headers. No estimation needed.

---

Would you accept switching chat from streaming to non-streaming (to get exact usage), or must streaming stay?

**Streaming must stay.** Non-negotiable for UX.

**Why:**
- Streaming = perceived performance, feels instant
- Non-streaming = 5-10 sec blank screen waiting for full response
- Users expect real-time token-by-token output (industry standard)

**Good news:** You don't need to choose. Vercel AI SDK provides exact token usage **even with streaming** via the `usage` object. Just pass it through response headers as planned.

```typescript
// API route - streaming still works
return result.toDataStreamResponse({
  headers: {
    'X-Usage-Input-Tokens': String(usage.promptTokens),
    'X-Usage-Output-Tokens': String(usage.completionTokens),
  },
});
```

Keep streaming, get accurate tokens. No trade-off needed.