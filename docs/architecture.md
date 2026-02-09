# ProjectLoom Architecture

> **For AI agents helping with code.**  
> **Last Updated:** February 2026

## What Is This?

ProjectLoom is a Next.js app that visualizes AI conversations as a spatial canvas with branching and merging. Think "Git for AI chats" with a DAG (Directed Acyclic Graph) structure.

**Core Concept:**
- Conversations = visual cards on infinite canvas (React Flow)
- Cards can branch from any message in parent cards
- Cards can merge multiple parent contexts (max 5 parents)
- Context flows forward only (parent → child, never backward)
- All state managed by Zustand, persisted to localStorage

## Key Data Structures

### Workspace (Flat Container)
```typescript
interface Workspace {
  id: string;
  title: string;
  conversations: Conversation[];  // All cards
  edges: EdgeConnection[];        // Visual connections
  metadata: WorkspaceMetadata;
}
```

### Conversation (Card with Branching)
```typescript
interface Conversation {
  id: string;
  canvasId: string;
  position: { x: number; y: number };
  content: Message[];
  
  // Branching & Merging
  parentCardIds: string[];  // Multiple parents supported (DAG)
  branchPoint?: { parentCardId: string; messageIndex: number };
  inheritedContext: Record<string, InheritedContextEntry>;  // Per-parent
  isMergeNode: boolean;
  
  // AI Model
  model?: string;  // 'claude-sonnet-4-20250514', 'gpt-4o', etc.
}

interface InheritedContextEntry {
  mode: 'full' | 'summary' | 'custom' | 'none';
  messages: Message[];
  timestamp: Date;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: { model?: string; tokens?: number };
}
```

## AI Integration

**Architecture:** BYOK (Bring Your Own Key) using Vercel AI SDK

**Flow:**
1. User stores API keys in localStorage (or env vars for prod)
2. Keys passed per-request to `/api/chat` endpoint
3. Vercel AI SDK abstracts provider (Anthropic, OpenAI)
4. Streaming SSE response using `streamText()`
5. `useChat` hook handles real-time updates

**API Routes:**
- `/api/chat` - Streaming AI responses
- `/api/summarize` - Context summarization
- `/api/agent` - Agent tool calling workflows
- `/api/embeddings` - RAG/semantic search (future)

**Supported Models:**
- **Anthropic:** Claude Opus 4, Sonnet 4, Haiku 4 (all support vision)
- **OpenAI:** GPT-4o, GPT-4o Mini (both support vision)

**Vision Support:** Image attachments via base64 data URLs (max 3 images, 5MB each, PNG/JPEG/WebP/GIF)

## Store Architecture

**Zustand stores:**
- `canvas-store.ts` - Workspaces, conversations, edges, nodes (main state)
- `preferences-store.ts` - UI preferences (panel widths, settings)
- `toast-store.ts` - Global toast notification queue
- `search-store.ts` - Canvas search state

**Persistence:** Debounced localStorage writes (300ms), schema version 4

## Component Structure

**Layout:**
```
src/
├── app/
│   ├── page.tsx                    # Main entry
│   ├── layout.tsx                  # Root layout
│   └── api/
│       ├── chat/route.ts           # Streaming AI endpoint
│       ├── summarize/route.ts      # Summary generation
│       ├── agent/route.ts          # Agent workflows
│       └── embeddings/route.ts     # RAG embeddings
│
├── components/
│   ├── InfiniteCanvas.tsx          # ReactFlow wrapper
│   ├── ConversationCard.tsx        # Card UI
│   ├── CanvasTreeSidebar.tsx       # Left sidebar (workspace tree)
│   ├── ChatPanel.tsx               # Right panel (active conversation)
│   ├── CanvasBreadcrumb.tsx        # Top navigation bar
│   ├── InheritedContextPanel.tsx   # Shows parent context
│   ├── BranchDialog.tsx            # Branching UI
│   ├── MergeNodeCreator.tsx        # Multi-parent merge dialog
│   ├── SidePanel.tsx               # Shared panel wrapper
│   └── AgentDialog.tsx             # Agent confirmation UI
│
├── stores/
│   ├── canvas-store.ts             # Main state
│   ├── preferences-store.ts        # Settings
│   ├── toast-store.ts              # Notifications
│   └── search-store.ts             # Search
│
├── lib/
│   ├── design-tokens.ts            # Colors, spacing, animations
│   ├── vercel-ai-integration.ts    # Model definitions
│   ├── api-key-manager.ts          # Key storage
│   ├── storage.ts                  # Persistence layer
│   ├── context-utils.ts            # Context selection logic
│   ├── rag-utils.ts                # RAG/embeddings
│   └── agents/
│       ├── branch-agent.ts         # Branch generation
│       ├── cleanup-agent.ts        # Workspace cleanup
│       └── summarize-agent.ts      # Summarization
│
└── types/
    └── index.ts                    # Global types
```

## Key Features

**Branching & Merging:**
- Branch from any message in any card
- 4 inheritance modes: full, summary, custom, none
- Multi-parent merge nodes (max 5 parents)
- Cycle prevention (DAG validation)
- Visual indicators: 🌿 branch, ⚡ merge, color-coded edges

**UI Patterns:**
- Three-panel layout: left sidebar, center canvas, right chat  
- Resizable panels with shared SidePanel component
- Keyboard-first design (N for new card, Ctrl+B to branch, Escape to dismiss)
- Toast notifications for warnings/undo actions
- Canvas search (Ctrl+F) and auto-layout (Ctrl+L)

**Design System:**
- Dark-only theme (`#0a0e27` navy background)
- Color semantics: amber=branch, emerald=merge, violet=reference
- Framer Motion animations with shared spring presets
- Language-aware fonts (CJK, Arabic, Hebrew RTL support)

## Important Rules for AI Agents

1. **Never mutate parent context** - Context is copied at branch time, never referenced
2. **Respect cycle prevention** - Block connections that would create cycles in DAG
3. **Enforce merge limits** - Max 5 parents per merge node (warn at 3, error at 5)
4. **Debounce storage writes** - 300ms delay to avoid thrashing localStorage
5. **Type safety** - All stores use Zustand with TypeScript, no `any` types

## Stack

- **Framework:** Next.js 15 (App Router)
- **State:** Zustand (canvas-store, preferences-store, toast-store, search-store)
- **Canvas:** React Flow (infinite canvas, nodes, edges, minimap)
- **AI:** Vercel AI SDK (`ai` package with `@ai-sdk/anthropic`, `@ai-sdk/openai`)
- **Animation:** Framer Motion
- **Storage:** localStorage (debounced writes, schema version 4)
- **Tests:** Vitest

## Common Tasks for AI Agents

**Adding a new model:**
1. Add to `AVAILABLE_MODELS` in `src/lib/vercel-ai-integration.ts`
2. Update `detectProvider()` if new provider
3. Test in ModelSelector dropdown

**Adding a keyboard shortcut:**
1. Add handler in `src/hooks/useKeyboardShortcuts.ts`
2. Register with ReactFlow hook
3. Update KeyboardShortcutsPanel component display

**Creating a new panel:**
1. Wrap in `SidePanel` component for consistent animation
2. Add toggle action to canvas-store or preferences-store
3. Use `animation.spring.panel` from design-tokens

**Debugging performance:**
- Check DevPerformanceOverlay (shows FPS, store updates)
- Look for unnecessary re-renders (use React DevTools Profiler)
- Verify debounced saves are working (300ms delay)
- Check ReactFlow edge/node counts (minimize unnecessary renders)

---

**For more detailed historical context, see commit history. This doc prioritizes current implementation over aspirational features.**
