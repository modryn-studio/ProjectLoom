# ProjectLoom Architecture Documentation

> **Version:** 4.0.0 (Card-Level Branching)  
> **Last Updated:** February 4, 2026  
> **Status:** v4 Card-Level Branching Implemented (see GitHub issue #5)  
> **Previous Architecture:** v1-v3 used canvas-level branching (deprecated)

## Overview

ProjectLoom is a visual canvas tool that transforms linear AI conversations into spatial, branching project trees with DAG (Directed Acyclic Graph) support.

**v4 Architecture Change:** Branching happens at the **card level** within a flat workspace, not at the canvas level. Cards can have multiple parents via merge nodes, forming a DAG structure.

---

## Core Concept

**"Git for AI conversations with merge support"** - A node-based canvas system where:
- Each conversation = a visual card on an infinite canvas
- Cards can branch from any message in a parent card
- Cards can merge multiple sources into a synthesis node (DAG structure)
- Context flows forward from parents to children (never backward)
- Spatial organization provides relationship visibility at a glance
- All cards live in a **flat workspace** (no canvas hierarchy)

---

## Data Architecture

### Workspace Object (v4 - Flat Structure)

**Key Change:** Workspaces are flat containers. Branching happens at the card level.

```typescript
interface Workspace {
  id: string;
  title: string;
  conversations: Conversation[];  // All cards in this workspace
  edges: EdgeConnection[];        // Visual connections
  tags: string[];
  metadata: WorkspaceMetadata;
}

interface WorkspaceMetadata {
  title: string;
  createdAt: Date;
  updatedAt: Date;
  color?: string;
  schemaVersion: number;  // Current: 4
}
```

### Conversation Card (v4 - With Branching Support)

**Key Change:** Cards track their parents and inherited context internally.

```typescript
interface Conversation {
  id: string;
  canvasId: string;  // Workspace ID
  position: Position;
  content: Message[];
  summary?: string;
  connections: string[];  // Reference edges (non-hierarchical)
  metadata: ConversationMetadata;
  
  // === v4 Card-Level Branching ===
  parentCardIds: string[];  // Supports multiple parents (for merge nodes)
  branchPoint?: BranchPoint;  // Where this branched from
  inheritedContext: Record<string, InheritedContextEntry>;  // Context per parent
  isMergeNode: boolean;  // Whether this is a synthesis merge node
  mergeMetadata?: MergeMetadata;  // Merge-specific data
}

interface BranchPoint {
  parentCardId: string;
  messageIndex: number;  // 0-indexed message where branch occurred
}

interface InheritedContextEntry {
  mode: InheritanceMode;  // 'full' | 'summary' | 'custom' | 'none'
  messages: Message[];
  timestamp: Date;
  totalParentMessages: number;
}

interface MergeMetadata {
  sourceCardIds: string[];  // IDs of cards being merged
  synthesisPrompt?: string;
  createdAt: Date;
}

interface Position {
  x: number;
  y: number;
}

interface ConversationMetadata {
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  tags: string[];
  isExpanded: boolean;
  language?: LanguageCode;
}
```

### Message Structure

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

interface MessageMetadata {
  model?: string;
  tokens?: number;
  language?: LanguageCode;
}

type LanguageCode = 'en' | 'ja' | 'es' | 'ar' | 'zh' | 'fr' | 'de' | 'ko' | 'ru' | 'pt' | string;
```

---

## Context Inheritance Architecture (v4 Implemented)

> **Implementation Status:** ✅ Implemented in v4 (Feb 2026) - see GitHub issue #5

### Core Rules

1. **Forward Flow Only**
   - Context flows FROM parent TO child
   - Children NEVER mutate parent context
   - Branches are immutable snapshots at creation time

2. **Context is Copied, Not Referenced**
   - Full message history is copied at branch time
   - Changes in child don't affect parent
   - Parent changes don't propagate to children

3. **Always Inspectable**
   - UI shows "Inherited Context" panel
   - Users can see exactly what came from parent
   - Visual indicator on canvas shows inheritance flow
   - Can collapse/expand inherited context

4. **User Control**
   - Default: Full context inheritance
   - Option: Summarized context (AI-generated)
   - Option: Custom selection of what to inherit
   - Can prune inherited context after branch creation

### Card-Level Context Storage (v4)

Each card stores its inherited context per parent:

```typescript
// Example: Card with 2 parents (merge node)
conversation.inheritedContext = {
  'parent-card-1': {
    mode: 'full',
    messages: [...],  // Full history from parent 1
    timestamp: new Date('2026-02-04'),
    totalParentMessages: 15
  },
  'parent-card-2': {
    mode: 'summary',
    messages: [...],  // Summarized from parent 2
    timestamp: new Date('2026-02-04'),
    totalParentMessages: 42
  }
};
```

### Merge Node Configuration

```typescript
const MERGE_NODE_CONFIG = {
  MAX_PARENTS: 5,           // Hard limit on parent count
  WARNING_THRESHOLD: 3,     // Show amber warning at 3+ parents
  BUNDLE_THRESHOLD: 4,      // Bundle edges visually at 4+ parents
};
```

### Visual Indicators (v4 Implemented)

```
[Parent Card] ─branch edge (amber)→ [Child Card with GitBranch icon]
              ↘
                merge edge (emerald)→ [Merge Node with ⚡ icon + count badge]
              ↗
[Parent Card 2] ─merge edge (emerald)→

Inherited Context Panel: Shows parent tree and inherited messages
```

**Visual Cues:**
- 🌿 **GitBranch icon** on branched cards (amber border)
- ⚡ **Zap icon** on merge nodes (green/amber/red based on parent count)
- **Amber edges** for branch relationships
- **Emerald edges** for merge relationships
- **Parent count badge** on merge nodes (color-coded by threshold)
- **Edge bundling** at 4+ parents (reduced opacity)

---

## AI Provider Abstraction (Phase 2)

> **Implementation Status:** Interface designed for Phase 2 implementation

### Provider-Agnostic Architecture

```typescript
interface AIProvider {
  /** Unique identifier for the provider */
  id: 'claude' | 'openai' | 'local' | string;
  
  /** Display name */
  name: string;
  
  /** Provider configuration */
  config: ProviderConfig;
  
  /** Send a message and get response */
  sendMessage(content: string, context: Context): Promise<AIResponse>;
  
  /** Stream a message response */
  streamMessage(content: string, context: Context): AsyncIterator<AIResponse>;
  
  /** Check if provider is available */
  isAvailable(): Promise<boolean>;
  
  /** Get available models for this provider */
  getModels(): Promise<ModelInfo[]>;
}

interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
}

interface Context {
  messages: Message[];
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
}

interface AIResponse {
  content: string;
  model: string;
  tokens: {
    input: number;
    output: number;
  };
  finishReason: 'stop' | 'length' | 'error';
}

interface ModelInfo {
  id: string;
  name: string;
  maxTokens: number;
  supportsStreaming: boolean;
}
```

### Provider Implementations (Phase 2)

```typescript
// Example implementations - not for Phase 1
class ClaudeProvider implements AIProvider {
  id = 'claude' as const;
  name = 'Claude';
  // ... implementation
}

class OpenAIProvider implements AIProvider {
  id = 'openai' as const;
  name = 'OpenAI';
  // ... implementation
}

class LocalLLMProvider implements AIProvider {
  id = 'local' as const;
  name = 'Local LLM';
  // ... implementation
}
```

---

## Storage Architecture

### Versioned Persistence

```typescript
interface StorageSchema {
  /** Schema version for migrations */
  version: number;
  
  /** All canvases in the project */
  canvases: Canvas[];
  
  /** Currently active canvas ID */
  activeCanvasId: string;
  
  /** User preferences */
  preferences: UserPreferences;
  
  /** Last saved timestamp */
  savedAt: Date;
}

interface UserPreferences {
  theme: 'dark';  // Dark-only in Phase 1
  defaultInheritanceMode: InheritanceMode;
  showMinimap: boolean;
  showDevOverlay: boolean;
}
```

### Migration System

```typescript
interface Migration {
  fromVersion: number;
  toVersion: number;
  migrate(data: unknown): unknown;
}

// Migrations are applied sequentially
const migrations: Migration[] = [
  // Future migrations will be added here
  // { fromVersion: 1, toVersion: 2, migrate: (data) => { ... } }
];
```

---

## Edge Connections (v4)

### Typed Relationships

**v4 introduces semantic edge types:**

```typescript
interface EdgeConnection {
  id: string;
  source: string;  // Source card ID
  target: string;  // Target card ID
  curveType: 'smoothstep' | 'bezier' | 'straight';  // Visual curve
  relationType: EdgeRelationType;  // Semantic relationship
  animated?: boolean;
  style?: EdgeStyle;
  label?: string;
}

type EdgeRelationType = 'branch' | 'merge' | 'reference';

interface EdgeStyle {
  stroke: string;      // Color based on relationType
  strokeWidth: number; // Thickness (merge = 3px, branch = 2px, ref = 1px)
  strokeDasharray?: string;  // Dashed for reference edges
}
```

### Edge Color Coding

- **Branch edges:** `#f59e0b` (amber) - Parent → child branching
- **Merge edges:** `#10b981` (emerald) - Source → synthesis merge node
- **Reference edges:** `#8b5cf6` (violet, dashed) - Non-hierarchical links

---

## Phase Implementation Roadmap

### ✅ Phase 1: Single Canvas MVP (Completed)
- ✅ Basic infinite canvas with React Flow
- ✅ Conversation cards with mock data
- ✅ Visual connections (simple Bezier curves)
- ✅ Local storage persistence with versioning
- ✅ Pan/zoom with virtualization
- ✅ Inline card expansion
- ✅ Essential keyboard shortcuts (Delete, Escape, Space, Ctrl+B, N)
- ✅ Language detection and font mapping
- ✅ Dev performance overlay
- ✅ Performance optimizations (debounced saves, O(n+m) handlers)

### ✅ v4: Card-Level Branching (Completed Feb 2026)
**Architecture:** See GitHub issue #5 for full spec

- ✅ Branch from any message in a card (keyboard/mouse workflow)
- ✅ Context inheritance with 4 modes (full/summary/custom/none)
- ✅ Inherited Context panel (shows parent tree + messages)
- ✅ Merge nodes (multi-parent DAG support, max 5 parents)
- ✅ Visual indicators (GitBranch/Zap icons, color-coded edges)
- ✅ Cycle prevention (canConnect validation)
- ✅ Edge bundling at 4+ parents
- ✅ Warning indicators at 3+ parents (amber/red colors)
- ✅ Canvas tree sidebar with DAG display
- ✅ Breadcrumb navigation
- ✅ Undo/redo with toast notifications
- ✅ Drag-to-merge workflow
- ✅ Branch dialog (keyboard workflow)
- ✅ Settings panel with branching preferences

### Phase 3: AI Integration & Intelligence
- [ ] AI provider integration (Claude, OpenAI, Local)
- [ ] Live conversation with AI within cards
- [ ] Auto-generate summaries
- [ ] Smart merge synthesis (AI combines multiple sources)

### Phase 4: Polish & Export
- [ ] Suggest Layout (opt-in, not auto)
- [ ] Export/Import workspaces (JSON format)
- [ ] Search across cards in workspace
- [ ] Card summaries on hover
- [ ] Branch comparison view
- [ ] Decision ancestry tracking
- [ ] Color coding by category/tag
- [ ] Collaborative features (if demanded)

---

## Design Principles

1. **Context flows forward, never backward** - Immutable context at branch time
2. **Always inspectable** - Users can see inherited context per parent
3. **Manual control wins** - No auto-repositioning, user decides layout
4. **DAG over tree** - Cards can have multiple parents via merge nodes
5. **Visual semantics** - Edge colors indicate relationship type (branch/merge/reference)
6. **Performance first** - 60 FPS target, debounced saves, O(n) operations
7. **Dark-only identity** - Deep navy aesthetic is the brand
8. **Solo-first** - No collaboration until users demand it

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── InfiniteCanvas.tsx
│   ├── ConversationCard.tsx
│   ├── CanvasTreeSidebar.tsx        # v4: DAG tree view
│   ├── CanvasBreadcrumb.tsx         # v4: Navigation
│   ├── InheritedContextPanel.tsx    # v4: Context inspection
│   ├── BranchDialog.tsx             # v4: Keyboard workflow
│   ├── InlineBranchPanel.tsx        # v4: Mouse workflow
│   ├── UndoToast.tsx                # v4: Undo notifications
│   ├── SettingsPanel.tsx            # v4: Preferences UI
│   ├── ErrorBoundary.tsx
│   └── DevPerformanceOverlay.tsx
├── hooks/
│   └── useKeyboardShortcuts.ts
├── stores/
│   ├── canvas-store.ts              # v4: With branching logic
│   └── preferences-store.ts         # v4: User settings
├── lib/
│   ├── design-tokens.ts
│   ├── language-utils.ts
│   ├── storage.ts                   # v4: Schema version 4
│   ├── context-utils.ts             # v4: Context selection
│   ├── mock-data.ts
│   └── logger.ts
├── utils/
│   ├── layoutGenerator.ts
│   └── formatters.ts
├── constants/
│   └── zIndex.ts
├── types/
│   └── index.ts                     # v4: Full type definitions
└── __tests__/
    ├── storage.test.ts
    ├── layoutGenerator.test.ts
    └── zIndex.test.ts
```

---

## Success Metrics

### \u2705 Phase 1 (Completed Week 1)
- Can organize 5+ conversations spatially
- Smooth pan/zoom experience
- Visual appeal matches design system
- All tests passing

### \u2705 v4 Card-Level Branching (Completed Week 2)
- Can branch from any message in any card
- Context flows correctly between cards
- Merge nodes support up to 5 parents
- Visual indicators for all relationship types
- Cycle prevention working
- 60 FPS maintained at current scale

### Phase 3 (Week 4 Target)
- AI integration with 2+ providers
- Live conversation within cards
- Auto-summarization working

### Phase 4 (Week 6 Target)
- 10 beta users can export/share workspaces
- Suggest layout working
- Search across cards functional

---

## References

- **GitHub Issue #5:** v4 Card-Level Branching Spec (comprehensive architecture document)
- **PERFORMANCE_OPTIMIZATIONS.md:** Performance tuning applied (Feb 4, 2026)
- **phase_2.md:** Original Phase 2 planning (superseded by v4)
- **future-features.md:** Phase 3+ roadmap
