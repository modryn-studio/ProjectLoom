# GitHub Copilot Instructions for ProjectLoom

## API Route Logging Pattern

Every new Next.js API route (`src/app/api/**/route.ts`) MUST include structured
logging following this pattern. This enables live monitoring via `dev.log` during
development and testing.

### Required boilerplate for every POST/GET handler:

```typescript
export async function POST(req: Request): Promise<Response> {
  const reqId = Math.random().toString(36).slice(2, 7).toUpperCase();
  const reqStart = Date.now();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[route-name] ▶ START [${reqId}] ${new Date().toISOString()}`);
  try {
    // ... handler body ...

    console.log(`[route-name] [${reqId}] ✅ Done in ${Date.now() - reqStart}ms`, {
      // key result fields
    });
    return Response.json(result);
  } catch (error) {
    console.error(`[route-name] [${reqId}] ❌ Error after ${Date.now() - reqStart}ms:`, error);
    // ... error response ...
  }
}
```

### Rules:
- Use a 5-char uppercase `reqId` on every request so correlated log lines are easy to grep
- Use `─`.repeat(60) separator between requests for visual scanning
- Log key request fields (model, messageCount, user message preview, etc.) at entry
- Log token usage + elapsed time at completion
- Always log errors with elapsed time
- Prefix every log line with `[route-name] [reqId]`

## Dev Server

Always start with: `npm run dev -- --port 3000 2>&1 | Tee-Object -FilePath dev.log`

This is already configured as the default VS Code build task. `dev.log` is gitignored.

## Provider Pattern

All AI calls go through `src/lib/provider-factory.ts`:
- `createModel(modelId, keys)` — returns a model instance
- `getWebSearchTools(modelId, keys, options)` — returns web search ToolSet
- `detectProvider(modelId)` — returns `'anthropic' | 'openai'`
- BYOK: keys come from request body as `{ anthropicKey?, openaiKey? }`

## Tech Stack

- Next.js 16 (App Router, Edge Runtime for API routes)
- Vercel AI SDK v6 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/react`)
- React Flow for canvas
- Zustand for state (`src/stores/canvas-store.ts`)
- TypeScript strict mode
