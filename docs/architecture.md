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

## Three-Panel Layout Architecture (Implemented Feb 2026)

> **Implementation Status:** ✅ Completed - see GitHub issue #6

### Layout Overview

ProjectLoom uses a three-panel layout pattern inspired by VSCode:

```
┌────────────────────────────────────────────────────────────┐
│  [≡] Workspaces    ProjectLoom - Main Workspace      [⚙]  │
├──────────┬─────────────────────────────────┬───────────────┤
│          │                                 │               │
│  LEFT    │        CANVAS (MAIN)           │  RIGHT CHAT   │
│  SIDEBAR │                                 │   PANEL       │
│          │   ┌──────┐    ┌──────┐         │               │
│  Cards   │   │Card 1│───▶│Card 2│         │  💬 Active    │
│  Tree    │   └──────┘    └──────┘         │  Conversation │
│  View    │        │                        │               │
│          │   ┌────▼──┐   ┌──────┐         │  [Messages]   │
│  • Root  │   │Card 3 │   │Card 4│         │  [Scrollable] │
│   • DB   │   └───────┘   └──────┘         │  [Thread]     │
│   • API  │                                 │               │
│          │   [+ New Card]                  │  [Type here...]│
│  [+ New] │                                 │               │
└──────────┴─────────────────────────────────┴───────────────┘
    20%              50-60%                      20-30%
```

### Chat Panel State Management

```typescript
interface ChatPanelState {
  // UI State (session-only)
  chatPanelOpen: boolean;  // Panel visibility
  activeConversationId: string | null;  // Currently open conversation
  
  // Draft persistence (session-only, per conversation)
  draftMessages: Map<string, string>;  // conversationId → draft text
}

interface ChatPanelActions {
  openChatPanel: (conversationId: string) => void;
  closeChatPanel: () => void;
  setDraftMessage: (conversationId: string, content: string) => void;
  getDraftMessage: (conversationId: string) => string;
  sendMessage: (content: string) => Promise<void>;
}

interface ChatPanelPreferences {
  // Persisted to localStorage
  chatPanelWidth: number;  // 400-800px, default 480
}
```

### User Interaction Flow

**Opening Chat Panel:**
1. User clicks conversation card on canvas
2. `openChatPanel(conversationId)` called
3. Panel slides in from right with animation.spring.snappy
4. Message thread loads for that conversation
5. Card on canvas shows thick amber border (2px)
6. Drafts restored if available for that conversation

**Switching Conversations:**
1. User clicks different card while panel open
2. Current draft auto-saved to draftMessages Map
3. Panel immediately switches to new conversation
4. New draft loaded from Map (or empty)
5. No confirmation dialog (fast switching)

**Sending Messages:**
1. User types in MessageInput (auto-resizes 80-200px)
2. Press Ctrl+Enter or click send button
3. `sendMessage(content)` adds user message to conversation
4. Draft cleared from Map for that conversation
5. TODO Phase 3: Trigger AI response

### Component Architecture

```typescript
// ChatPanel.tsx - Main container
export function ChatPanel() {
  // Resizable (400-800px) with identical logic to CanvasTreeSidebar
  // Persists width to preferences.ui.chatPanelWidth
  // Contains: ChatPanelHeader, MessageThread, MessageInput
}

// ChatPanelHeader.tsx - Title and actions
export function ChatPanelHeader() {
  // Shows: conversation title, merge/branch indicators, message count
  // Actions: branch button, close button
}

// MessageThread.tsx - Scrollable messages
export function MessageThread() {
  // Renders messages with language-aware styling
  // Auto-scrolls on new messages
  // Branch icons on hover for message-level branching
}

// MessageInput.tsx - Message composition
export function MessageInput() {
  // Auto-resizing textarea (80-200px)
  // Draft persistence on every keystroke
  // Ctrl+Enter to send, Enter for newline
}
```

### Keyboard Shortcuts

| Shortcut | Action | Notes |
|----------|--------|-------|
| **N** | New conversation | Creates at center or click position |
| **Enter** / **Space** | Open chat panel | For selected card |
| **Escape** | Close chat panel → Deselect | Two-stage cascade |
| **Delete** | Delete selected | Single or multi-select (with confirmation) |
| **Ctrl+B** | Branch from card | Opens branch dialog |
| **Ctrl+Enter** | Send message | Only in chat input |
| **Ctrl+Z** / **Ctrl+Shift+Z** | Undo / Redo | 50-action history |
| **+** / **-** | Zoom in/out | ReactFlow API with 200ms animation |
| **Ctrl+0** | Fit view | All cards with padding |
| **Ctrl+1** | Reset zoom | 100% scale |
| **Ctrl+A** | Select all cards | Multi-select all visible |
| **Ctrl+F** | Canvas search | Real-time results with navigation |
| **Ctrl+L** | Auto-layout | Tree algorithm with toast feedback |
| **?** | Shortcuts panel | Categorized help overlay |

### Design Decisions

1. **Session-only drafts:** Draft messages stored in memory Map, not persisted to localStorage
2. **Immediate switching:** No confirmation when switching conversations, drafts auto-saved
3. **Identical resize logic:** Copy-paste from CanvasTreeSidebar for consistency
4. **Width persistence:** Panel width saved to preferences, but open/closed state is session-only
5. **animation.spring.snappy:** Fast response for user-triggered panel open/close (stiffness: 600)

---

## Toast Notification System (v4.1)

### Architecture

```typescript
// toast-store.ts - Global notification queue
interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

interface Toast {
  id: string;  // Generated via nanoid
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;  // Default: 5000ms
  action?: ToastAction;
}

interface ToastAction {
  label: string;
  onClick: () => void;
}
```

### Configuration

```typescript
const TOAST_CONFIG = {
  MAX_TOASTS: 3,           // Stack limit
  DEFAULT_DURATION: 5000,  // 5 seconds
  Z_INDEX: 370,            // overlay.notification layer
};
```

### Usage Patterns

**Merge warnings (canvas-store.ts):**
```typescript
// At 3 parents
useToastStore.getState().addToast({
  type: 'warning',
  message: 'Adding source 3/5. Complex merges may reduce AI response quality.',
});

// At 5 parents
useToastStore.getState().addToast({
  type: 'error',
  message: 'Merge node limit reached (5 sources).',
  action: {
    label: 'Learn More',
    onClick: () => openHierarchicalMergeDialog(),
  },
});
```

**Undo notifications:**
```typescript
addToast({
  type: 'info',
  message: 'Card deleted',
  action: { label: 'Undo', onClick: () => undo() },
});
```

### Visual Design

- Stacked vertically from bottom-right
- Animated entry/exit with Framer Motion
- Progress bar showing auto-dismiss countdown
- Color-coded by type (success=emerald, error=red, warning=amber, info=violet)
- Action button in amber for clickable toasts

---

## Search System (v4.1)

### Architecture

```typescript
// search-store.ts - Search state management
interface SearchStore {
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  activeIndex: number;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  nextResult: () => void;
  prevResult: () => void;
  jumpToResult: (index: number) => void;
}

interface SearchResult {
  cardId: string;
  cardTitle: string;
  matchType: 'title' | 'message' | 'branchReason';
  snippet: string;           // Context around match
  messageIndex?: number;     // For message matches
  highlightedSnippet: string;  // With 【markers】
}
```

### Search Algorithm

```typescript
// Searches across all conversations
function searchConversations(
  query: string,
  conversations: Map<string, Conversation>
): SearchResult[] {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for (const [id, conv] of conversations) {
    // 1. Search title
    if (conv.metadata.title.toLowerCase().includes(lowerQuery)) {
      results.push({ matchType: 'title', ... });
    }

    // 2. Search messages
    conv.content.forEach((msg, idx) => {
      if (msg.content.toLowerCase().includes(lowerQuery)) {
        results.push({ matchType: 'message', messageIndex: idx, ... });
      }
    });

    // 3. Search branch reason
    if (conv.branchPoint?.reason?.toLowerCase().includes(lowerQuery)) {
      results.push({ matchType: 'branchReason', ... });
    }
  }

  return results;
}
```

### UI Behavior (CanvasSearch.tsx)

- **Trigger:** Ctrl+F opens floating panel at top-center
- **Real-time:** Results update on every keystroke (debounced 150ms)
- **Navigation:** Arrow keys (↑/↓) cycle through results
- **Jump:** Enter key pans canvas to selected result using `setCenter()`
- **Visual:** Highlighted snippets with 【match】 markers
- **Close:** Escape or click outside

---

## Layout Utilities (v4.1)

### Architecture

```typescript
// layout-utils.ts - Auto-layout algorithms

interface LayoutAlgorithm {
  name: string;
  arrange: (nodes: Node[], edges: Edge[]) => Map<string, Position>;
}
```

### Overlap Detection

```typescript
function detectOverlaps(
  nodes: Node[],
  threshold: number = 50
): Set<string> {
  // Returns Set of node IDs that overlap with others
  // Threshold: minimum overlap in pixels to count
}
```

### Tree Layout (Primary)

```typescript
function treeLayout(
  nodes: Node[],
  edges: Edge[]
): Map<string, Position> {
  // 1. Build parent-child hierarchy from edges
  // 2. Identify root nodes (no incoming edges)
  // 3. Recursively position children:
  //    - Horizontal spacing: 400px
  //    - Vertical spacing: 300px
  //    - Left-to-right, top-to-bottom arrangement
  // 4. Return Map<nodeId, {x, y}>
}
```

**Used by Ctrl+L shortcut** - Respects card hierarchy, minimizes overlaps.

### Grid Layout (Fallback)

```typescript
function gridLayout(
  nodes: Node[],
  columns: number = 4
): Map<string, Position> {
  // Simple grid: columns × rows
  // 400px horizontal spacing, 300px vertical
}
```

### Spread Layout (Alternative)

```typescript
function spreadLayout(
  nodes: Node[],
  overlaps: Set<string>
): Map<string, Position> {
  // Physics-based: push overlapping cards apart
  // Iterative force simulation
}
```

### Integration (InfiniteCanvas.tsx)

```typescript
const onSuggestLayout = useCallback(() => {
  const overlaps = detectOverlaps(nodes);

  if (overlaps.size === 0) {
    toast.info('Cards are already well organized!');
    return;
  }

  const newPositions = treeLayout(nodes, edges);
  applyLayout(newPositions);  // Updates canvas-store
  toast.success(`Organized ${overlaps.size} cards`);
}, [nodes, edges]);
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
- ✅ Three-panel layout (left sidebar, center canvas, right chat panel)
- ✅ Resizable chat panel with draft persistence
- ✅ Essential keyboard shortcuts (Delete, Escape, Space/Enter, Ctrl+B, Ctrl+Enter, N)
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

### ✅ v4.1: High-Value Phase 3 Features (Completed Feb 2026)
**Enhancements:** See IMPLEMENTATION_STATUS.md for detailed feature breakdown

- ✅ Global toast notification system (queue, auto-dismiss, actions)
- ✅ Merge warnings (toast at 3+, error at 5 with "Learn More")
- ✅ Hierarchical merge dialog (educational guide with visual examples)
- ✅ Canvas stats in breadcrumb ("X cards | Y merges")
- ✅ View control shortcuts (+/-, Ctrl+0, Ctrl+1, Ctrl+A)
- ✅ Keyboard shortcuts panel (? key, categorized display)
- ✅ Multi-select system (Shift+click, drag box, bulk operations)
- ✅ Canvas search (Ctrl+F, real-time results, keyboard navigation)
- ✅ Auto-layout suggestions (Ctrl+L, tree algorithm with overlap detection)

### Phase 3: AI Integration & Intelligence
- [ ] AI provider integration (Claude, OpenAI, Local)
- [ ] Live conversation with AI within cards
- [ ] Auto-generate summaries
- [ ] Smart merge synthesis (AI combines multiple sources)

### Phase 4: Polish & Export
- [x] Auto-layout suggestions (Ctrl+L) - **Completed in v4.1**
- [x] Search across cards in workspace (Ctrl+F) - **Completed in v4.1**
- [ ] Export/Import workspaces (JSON format)
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
│   ├── CanvasBreadcrumb.tsx         # v4: Navigation + stats
│   ├── InheritedContextPanel.tsx    # v4: Context inspection
│   ├── BranchDialog.tsx             # v4: Keyboard workflow
│   ├── InlineBranchPanel.tsx        # v4: Mouse workflow
│   ├── ChatPanel.tsx                # Three-panel: Right chat panel
│   ├── ChatPanelHeader.tsx          # Three-panel: Chat header
│   ├── MessageThread.tsx            # Three-panel: Message display
│   ├── MessageInput.tsx             # Three-panel: Message input
│   ├── UndoToast.tsx                # v4: Undo notifications
│   ├── SettingsPanel.tsx            # v4: Preferences UI
│   ├── ToastContainer.tsx           # v4.1: Toast notification stack
│   ├── HierarchicalMergeDialog.tsx  # v4.1: Educational merge guide
│   ├── KeyboardShortcutsPanel.tsx   # v4.1: Help panel (? key)
│   ├── CanvasSearch.tsx             # v4.1: Search overlay (Ctrl+F)
│   ├── ErrorBoundary.tsx
│   └── DevPerformanceOverlay.tsx
├── hooks/
│   └── useKeyboardShortcuts.ts      # v4.1: Extended shortcuts
├── stores/
│   ├── canvas-store.ts              # v4: With branching + chat panel
│   ├── preferences-store.ts         # v4: User settings + chat width
│   ├── toast-store.ts               # v4.1: Global toast queue
│   └── search-store.ts              # v4.1: Canvas search state
├── lib/
│   ├── design-tokens.ts
│   ├── language-utils.ts
│   ├── storage.ts                   # v4: Schema version 4
│   ├── context-utils.ts             # v4: Context selection
│   ├── layout-utils.ts              # v4.1: Auto-layout algorithms
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
