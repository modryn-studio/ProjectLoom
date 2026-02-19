# New Project Setup Guide

Quick checklist to replicate the dev tooling established in ProjectLoom.

---

## 1. Copy Core Files

| File | Destination | Notes |
|------|-------------|-------|
| `.github/copilot-instructions.md` | `.github/copilot-instructions.md` | Update tech stack section for the new project |
| `src/lib/route-logger.ts` | `src/lib/route-logger.ts` | No changes needed — reusable as-is |

---

## 2. Configure the Dev Server Task

In `.vscode/tasks.json`, set the default build task to tee output to `dev.log`:

```jsonc
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run dev server",
      "type": "shell",
      "command": "npm run dev -- --port 3000 2>&1 | Tee-Object -FilePath dev.log",
      "isBackground": true,
      "group": { "kind": "build", "isDefault": true },
      "presentation": { "reveal": "always", "panel": "dedicated" }
    }
  ]
}
```

Start it with `Ctrl+Shift+B`. Copilot can then read `dev.log` anytime you say "check logs".

---

## 3. Gitignore `dev.log`

```
dev.log
```

---

## 4. API Route Logging

Every new route gets this boilerplate — Copilot will apply it automatically because of `copilot-instructions.md`:

```typescript
import { createRouteLogger } from '@/lib/route-logger';
const log = createRouteLogger('route-name');

export async function POST(req: Request): Promise<Response> {
  const ctx = log.begin();
  try {
    // handler body
    log.info(ctx.reqId, 'Request received', { /* key fields */ });
    return log.end(ctx, Response.json(result), { /* result fields */ });
  } catch (error) {
    log.err(ctx, error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

Or use the raw boilerplate (no import needed):

```typescript
const reqId = Math.random().toString(36).slice(2, 7).toUpperCase();
const reqStart = Date.now();
console.log(`\n${'─'.repeat(60)}`);
console.log(`[route-name] ▶ START [${reqId}] ${new Date().toISOString()}`);
```

---

## 5. Update `copilot-instructions.md` for the New Project

Edit the following sections after copying:

- **Tech Stack** — swap in the actual framework, state library, etc.
- **Provider Pattern** — update or remove if not using Vercel AI SDK / BYOK pattern
- Keep the **API Route Logging** and **Dev Server** sections unchanged

---

## Why This Works

- `copilot-instructions.md` in `.github/` is auto-loaded by VS Code — Copilot applies the logging pattern to every new route without being asked
- `dev.log` gives Copilot read access to live server output during testing
- `route-logger.ts` eliminates copy-paste boilerplate across routes
- The reqId + `─` separator pattern makes multi-request logs grep-friendly and visually scannable
