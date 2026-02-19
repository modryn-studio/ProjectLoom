# New Project Setup Guide

Everything needed to setup dev tooling. 

---

## Checklist

- [ ] Create `.github/copilot-instructions.md` (content below — update tech stack section)
- [ ] Create `src/lib/route-logger.ts` (content below — copy as-is)
- [ ] Create `.vscode/tasks.json` (content below)
- [ ] Add `dev.log` to `.gitignore`

---

## File: `.github/copilot-instructions.md`

Update the **Tech Stack** and **Provider Pattern** sections for your project. Keep everything else as-is.

```markdown
# GitHub Copilot Instructions

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

## Tech Stack

← UPDATE THIS SECTION FOR EACH PROJECT →
```

---

## File: `src/lib/route-logger.ts`

Copy as-is. No changes needed.

```typescript
export interface RouteLogContext {
  reqId: string;
  reqStart: number;
}

export interface RouteLogger {
  /** Call at the top of the handler — prints separator + START line, returns context */
  begin(): RouteLogContext;
  /** Log an info line under the current request */
  info(reqId: string, message: string, data?: Record<string, unknown>): void;
  /** Log a warning line */
  warn(reqId: string, message: string, data?: Record<string, unknown>): void;
  /** Wrap a completed response — prints ✅ timing line and returns the response */
  end(ctx: RouteLogContext, response: Response, data?: Record<string, unknown>): Response;
  /** Log an error with elapsed time */
  err(ctx: RouteLogContext, error: unknown): void;
}

export function createRouteLogger(routeName: string): RouteLogger {
  const tag = `[${routeName}]`;

  return {
    begin() {
      const reqId = Math.random().toString(36).slice(2, 7).toUpperCase();
      const reqStart = Date.now();
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`${tag} ▶ START [${reqId}] ${new Date().toISOString()}`);
      return { reqId, reqStart };
    },

    info(reqId, message, data) {
      if (data && Object.keys(data).length > 0) {
        console.log(`${tag} [${reqId}] ${message}`, data);
      } else {
        console.log(`${tag} [${reqId}] ${message}`);
      }
    },

    warn(reqId, message, data) {
      if (data && Object.keys(data).length > 0) {
        console.warn(`${tag} [${reqId}] ⚠️  ${message}`, data);
      } else {
        console.warn(`${tag} [${reqId}] ⚠️  ${message}`);
      }
    },

    end({ reqId, reqStart }, response, data) {
      const elapsed = Date.now() - reqStart;
      const logData = { ...data, elapsedMs: elapsed, status: response.status };
      console.log(`${tag} [${reqId}] ✅ Done`, logData);
      return response;
    },

    err({ reqId, reqStart }, error) {
      const elapsed = Date.now() - reqStart;
      console.error(`${tag} [${reqId}] ❌ Error after ${elapsed}ms:`, error);
    },
  };
}
```

### Usage in a route:

```typescript
import { createRouteLogger } from '@/lib/route-logger';
const log = createRouteLogger('my-route');

export async function POST(req: Request): Promise<Response> {
  const ctx = log.begin();
  try {
    log.info(ctx.reqId, 'Request received', { model, messageCount });
    // ... handler body ...
    return log.end(ctx, Response.json(result), { outputTokens });
  } catch (error) {
    log.err(ctx, error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

## File: `.vscode/tasks.json`

`Ctrl+Shift+B` starts the server and tees all output to `dev.log`.

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
    },
    {
      "label": "Run lint",
      "type": "shell",
      "command": "npm run lint",
      "isBackground": false,
      "group": "build"
    }
  ]
}
```

---

## GitHub Issues CLI Pattern

Use `gh` to track known gaps and bugs without relying on memory. Always include `--repo owner/repo`.

```powershell
# Create issue
gh issue create --repo owner/repo --title "Title" --body "Body"

# Short comment
gh issue comment X --repo owner/repo --body "text"

# Long comment (ALWAYS use file for multi-line)
@"
Multi-line content
goes here
"@ | Set-Content temp.md
gh issue comment X --repo owner/repo --body-file temp.md
Remove-Item temp.md
```

> `echo > temp.md` on PowerShell creates a blank file — use the here-string pattern above instead.

---

## How It Works

During a testing session, start the server with `Ctrl+Shift+B`, then tell Copilot **"check logs"** at any point. Copilot reads `dev.log` and flags errors, slow requests, unexpected responses, or anything unusual — without you having to paste terminal output.

- `copilot-instructions.md` in `.github/` is auto-loaded by VS Code — Copilot applies the logging pattern to every new route it creates, without being asked
- `route-logger.ts` provides `begin / info / warn / end / err` so there's no boilerplate to copy per route
- The `reqId` + `─` separator pattern makes multi-concurrent-request logs grep-friendly and visually scannable
