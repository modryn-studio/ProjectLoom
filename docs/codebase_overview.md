2/22/2026

## ProjectLoom — Full Codebase Overview

**Architecture**: A BYOK (Bring Your Own Key) visual AI canvas built on **Next.js 16** (App Router) + **React 19** + **React Flow** + **Zustand** + **Vercel AI SDK v6**. Users create branching/merging conversation DAGs on an infinite canvas. Schema version 4.

---

### Configuration Layer
- **React Compiler** enabled, **Turbopack** bundler, **strict TypeScript**
- CSP headers allow only `api.anthropic.com` and `api.openai.com`
- Path alias `@/*` → `./src/*`, Vitest with jsdom (67 tests, 4 files)

### App Entry
- `page.tsx` — Landing page (`LandingPage` component → routes to `/canvas`)
- `canvas/page.tsx` — Client component wrapping `ReactFlowProvider` → `InfiniteCanvas` + overlay dialogs. First-time visitors launch onboarding via `launchOnboardingInDemoWorkspace()`.
- Theme flash prevention via inline `<script>` in layout.tsx. Full design token system in globals.css (486 lines).

### Landing Page (3 components)
- LandingPage.tsx — Hero split layout (headline left, animated canvas right), 3 feature cards (branch/navigate/merge), final CTA, newsletter signup, responsive mobile layout
- HeroCanvas.tsx — Cinematic looping animation: 5 cards appear in phases with SVG bezier connector lines. Horizontal (desktop) + vertical (mobile) coordinate systems. ScaledStage auto-fits container.
- LandingCard.tsx — Read-only card replicating ConversationCard's collapsed visual (280×160)

### API Routes (5 routes)
| Route | Runtime | Purpose |
|-------|---------|---------|
| chat/route.ts | Edge | Streaming chat via `streamText`. Vision, web search citations, canvas context injection, step-keyed onboarding mock responses |
| agent/route.ts | Node | Runs cleanup/branch/summarize agents with guardrails |
| generate-title/route.ts | Edge | 3-5 word auto titles via `generateText` |
| summarize/route.ts | Node | Structured conversation summaries |
| web-search/route.ts | Node | Tavily API integration |

All routes use `createRouteLogger()` with 5-char reqId, BYOK key extraction, and `provider-factory.ts` for model creation.

### Components (~35 components, ~15K lines total)
**Big four:**
- InfiniteCanvas.tsx — React Flow wrapper, edge rendering, connection validation, layout suggestions, context menu, copy-paste, onboarding card-creation detection
- MessageThread.tsx — Message display with `SimpleChatMarkdown`, inherited-context banners, branch action buttons, inline editing
- CanvasTreeSidebar.tsx — Workspace navigation, DAG tree display, drag resize
- ChatPanel.tsx — `useChat` hook, full-context KB injection (TF-IDF fallback for oversized KBs), streaming metadata ref for card-switching safety

**Key patterns**: Aggressive `memo`/`useMemo`/`useCallback`, framer-motion animations, portal-based overlays, CSS-var-based theming via design-tokens.ts.

**Onboarding system:**
- OnboardingGuide.tsx (v3) — 10-step interactive tour using a job-offer decision scenario. Steps auto-advance by watching canvas-store state. Uses `SpotlightOverlay` tooltips for all hints (including merge-hint with dynamic text based on selection count: 0/1/2 cards selected). `pendingMessage` store pattern drives auto-typing into MessageInput.
- onboarding-demo-workspace.ts — Shared launcher that creates an isolated "Demo (Onboarding)" workspace (tagged `onboarding-demo`) for both first-time and replay flows. Deletes prior demo workspaces by tag before creating fresh ones.
- MultiSelectFloatingBar.tsx — floating pill for multi-select actions; Merge button has `data-onboarding="merge-button"` for tooltip anchoring.
- MessageInput.tsx handles auto-typing via `useOnboardingStore.subscribe` effect that animates chars and auto-submits.
- SettingsPanel.tsx — "Replay Tour" button launches onboarding in demo workspace.

### Stores (7 Zustand stores)
- canvas-store.ts **(the heart)** — Nodes, edges, `conversations` Map, workspaces, undo/redo (full snapshots), cycle prevention (DFS), inherited context collection (recursive, max depth 10, dedup by msg ID, 10K token limit), structural metadata system messages, auto-title, debounced persistence (300ms), connection validation (L→R flow only, max 5 merge parents). Branch spacing: `BRANCH_OFFSET_X=380`, `BRANCH_DEFAULT_LANE_OFFSET_Y=180`, `BRANCH_LANE_STEP_Y=220`.
- onboarding-store.ts (v3) — 10-step scripted onboarding flow (`idle` → `auto-chat-0` → `branch-1-hint` → `auto-chat-1` → `branch-2-hint` → `auto-chat-2` → `reflect` → `merge-hint` → `auto-chat-3` → `complete`). Holds `pendingMessage`/`isAutoTyping` for controlled auto-typing, `rootCardId`/`branch1CardId`/`branch2CardId`/`mergeCardId` for step-tracking. `replayOnboarding()` restarts without clearing localStorage.
- usage-store.ts — Per-call usage records with cost calculation, date range filtering
- preferences-store.ts — Theme, branching defaults, UI prefs with schema migration
- search-store.ts — Pre-indexed search across conversation titles/messages
- toast-store.ts — Max 3 toasts, auto-dismiss
- canvas-tree-store.ts — Tree hierarchy cache from flat conversations

### Library Layer (17 files)
**Provider pipeline**: provider-factory.ts creates `@ai-sdk/anthropic`/`@ai-sdk/openai` instances + native web search tools. vercel-ai-integration.ts holds the 6-model catalog with pricing. model-configs.ts has per-model temperature/maxTokens.

**Agent system** (4 files): agent-runner.ts — shared execution engine with guardrails (step limits, timeout, cost budget, loop detection). Three agents: cleanup, branch, summarize — each defines tools, runner executes them.

**Persistence**: storage.ts — `VersionedStorage<T>` with schema migrations, checksums, backup/restore. knowledge-base-db.ts — IndexedDB for KB file content.

**Other**: api-key-manager.ts (singleton, base64 obfuscation), rag-utils.ts (TF-IDF fallback), language-utils.ts (franc-min detection, RTL, CJK font selection), design-tokens.ts (483L complete design system), search-orchestration.ts (pre-LLM web search heuristics), mock-responses.ts (intent-based + step-keyed scripted mock responses for onboarding, no API key required), onboarding-demo-workspace.ts (demo workspace isolation).

### Types (index.ts)
Core types: `Message`, `Conversation` (position, parentCardIds, branchPoint, inheritedContext, isMergeNode, mergeMetadata, model), `Workspace` (flat, with optional `tags` array), `EdgeConnection` with `EdgeRelationType`, `WorkspaceContext` (instructions + knowledgeBaseFiles), merge config (MAX_PARENTS: 5).

### Tests (4 test files, 67 tests)
Branch/merge + undo/redo integration, layout algorithm determinism, `VersionedStorage` persistence + migration, z-index layer hierarchy.

### Key Design Decisions
1. **BYOK** — keys sent per request, never stored server-side
2. **DAG not tree** — cards connect as directed acyclic graph with merge nodes (max 5 parents)
3. **Full-context KB injection** — sends entire KB in prompt up to ~100K tokens, TF-IDF only as oversized fallback
4. **Structural metadata** — AI receives a system message describing current card's position in the DAG
5. **Undo/redo** — full state snapshots, not command pattern
6. **Edge Runtime** for streaming routes, Node for agents/summarize
7. **CSS-var theming** — instant light/dark switch without re-render
8. **Onboarding isolation** — demo runs in a tagged temporary workspace so real user data is never mixed with walkthrough content