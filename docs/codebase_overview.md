2/19/2026

## ProjectLoom — Full Codebase Overview

**Architecture**: A BYOK (Bring Your Own Key) visual AI canvas built on **Next.js 16** (App Router) + **React 19** + **React Flow** + **Zustand** + **Vercel AI SDK v6**. Users create branching/merging conversation DAGs on an infinite canvas. Schema version 4.

---

### Configuration Layer
- **React Compiler** enabled, **Turbopack** bundler, **strict TypeScript**
- CSP headers allow only `api.anthropic.com` and `api.openai.com`
- Path alias `@/*` → `./src/*`, Vitest with jsdom

### App Entry (page.tsx)
Client component that wraps `ReactFlowProvider` → `InfiniteCanvas` + overlay dialogs. Theme flash prevention via inline `<script>` in layout.tsx. Full design token system in globals.css (486 lines).

### API Routes (5 routes)
| Route | Runtime | Purpose |
|-------|---------|---------|
| chat/route.ts (536L) | Edge | Streaming chat via `streamText`. Vision, web search citations, canvas context injection |
| agent/route.ts (168L) | Node | Runs cleanup/branch/summarize agents with guardrails |
| generate-title/route.ts (152L) | Edge | 3-5 word auto titles via `generateText` |
| summarize/route.ts (247L) | Node | Structured conversation summaries |
| web-search/route.ts (157L) | Node | Tavily API integration |

All routes use `createRouteLogger()` with 5-char reqId, BYOK key extraction, and `provider-factory.ts` for model creation.

### Components (31 components, ~13K lines total)
**Big four:**
- InfiniteCanvas.tsx (1364L) — React Flow wrapper, edge rendering, connection validation, layout suggestions, context menu, copy-paste
- MessageThread.tsx (1372L) — Message display with `SimpleChatMarkdown`, inherited-context banners, branch action buttons, inline editing
- CanvasTreeSidebar.tsx (1207L) — Workspace navigation, DAG tree display, drag resize
- ChatPanel.tsx (1071L) — `useChat` hook, full-context KB injection (TF-IDF fallback for oversized KBs), streaming metadata ref for card-switching safety

**Key patterns**: Aggressive `memo`/`useMemo`/`useCallback`, framer-motion animations, portal-based overlays, CSS-var-based theming via design-tokens.ts.

### Stores (6 Zustand stores)
- canvas-store.ts **(2770L — the heart)** — Nodes, edges, `conversations` Map, workspaces, undo/redo (full snapshots), cycle prevention (DFS), inherited context collection (recursive, max depth 10, dedup by msg ID, 10K token limit), structural metadata system messages, auto-title, debounced persistence (300ms), connection validation (L→R flow only, max 5 merge parents)
- usage-store.ts (274L) — Per-call usage records with cost calculation, date range filtering
- preferences-store.ts (257L) — Theme, branching defaults, UI prefs with schema migration
- search-store.ts (241L) — Pre-indexed search across conversation titles/messages
- toast-store.ts (134L) — Max 3 toasts, auto-dismiss
- canvas-tree-store.ts (87L) — Tree hierarchy cache from flat conversations

### Library Layer (16 files)
**Provider pipeline**: provider-factory.ts creates `@ai-sdk/anthropic`/`@ai-sdk/openai` instances + native web search tools. vercel-ai-integration.ts holds the 6-model catalog with pricing. model-configs.ts has per-model temperature/maxTokens.

**Agent system** (4 files): agent-runner.ts (281L) — shared execution engine with guardrails (step limits, timeout, cost budget, loop detection). Three agents: cleanup, branch, summarize — each defines tools, runner executes them.

**Persistence**: storage.ts (470L) — `VersionedStorage<T>` with schema migrations, checksums, backup/restore. knowledge-base-db.ts — IndexedDB for KB file content.

**Other**: api-key-manager.ts (singleton, base64 obfuscation), rag-utils.ts (TF-IDF fallback), language-utils.ts (franc-min detection, RTL, CJK font selection), design-tokens.ts (483L complete design system), search-orchestration.ts (pre-LLM web search heuristics).

### Types (index.ts — 670L)
Core types: `Message`, `Conversation` (position, parentCardIds, branchPoint, inheritedContext, isMergeNode, mergeMetadata, model), `Workspace` (flat), `EdgeConnection` with `EdgeRelationType`, `WorkspaceContext` (instructions + knowledgeBaseFiles), merge config (MAX_PARENTS: 5).

### Tests (4 test files)
Branch/merge + undo/redo integration, layout algorithm determinism, `VersionedStorage` persistence + migration, z-index layer hierarchy.

### Key Design Decisions
1. **BYOK** — keys sent per request, never stored server-side
2. **DAG not tree** — cards connect as directed acyclic graph with merge nodes (max 5 parents)
3. **Full-context KB injection** — sends entire KB in prompt up to ~100K tokens, TF-IDF only as oversized fallback
4. **Structural metadata** — AI receives a system message describing current card's position in the DAG
5. **Undo/redo** — full state snapshots, not command pattern
6. **Edge Runtime** for streaming routes, Node for agents/summarize
7. **CSS-var theming** — instant light/dark switch without re-render