# ProjectLoom Architecture Documentation

> **Version:** 1.0.0 (Phase 1 MVP)  
> **Last Updated:** February 2, 2026  
> **Status:** Phase 1 Implementation, Phase 2 Architecture Documented

## Overview

ProjectLoom is a visual canvas tool that transforms linear AI conversations into spatial, branching project trees. This document defines the complete architecture, including Phase 2 features documented for forward compatibility.

---

## Core Concept

**"Git for AI conversations"** - A node-based canvas system where:
- Each conversation = a visual node on an infinite canvas
- Conversations can branch to new canvases (like git branches)
- Context flows forward from parent to child (never backward)
- Spatial organization provides relationship visibility at a glance

---

## Data Architecture

### Canvas Object

```typescript
interface Canvas {
  id: string;
  parentCanvasId: string | null;
  contextSnapshot: ContextSnapshot | null;  // State at branch time
  conversations: Conversation[];
  branches: string[];  // IDs of child canvases
  tags: string[];
  createdFromConversationId: string | null;
  metadata: CanvasMetadata;
}

interface CanvasMetadata {
  title: string;
  createdAt: Date;
  updatedAt: Date;
  color?: string;
  version: number;  // Schema version for migrations
}
```

### Conversation Node

```typescript
interface Conversation {
  id: string;
  canvasId: string;
  position: Position;
  content: Message[];
  summary?: string;
  connections: string[];  // IDs of connected conversations
  metadata: ConversationMetadata;
}

interface Position {
  x: number;
  y: number;
}

interface ConversationMetadata {
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  tags: string[];
  isExpanded: boolean;
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

## Context Inheritance Architecture (Phase 2)

> **Implementation Status:** Documented for Phase 2, data structures designed for forward compatibility

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

### Context Snapshot Interface

```typescript
interface ContextSnapshot {
  /** Complete conversation history at branch time */
  messages: Message[];
  
  /** Metadata about the context state */
  metadata: ContextMetadata;
  
  /** When this snapshot was created */
  timestamp: Date;
  
  /** Parent canvas this was branched from */
  parentCanvasId: string;
  
  /** ID of conversation that triggered the branch */
  sourceConversationId: string;
}

interface ContextMetadata {
  /** Recorded decisions in the conversation */
  decisions: Decision[];
  
  /** Assumptions made during the conversation */
  assumptions: Assumption[];
  
  /** User-provided reason for creating this branch */
  branchReason: string;
  
  /** Total message count at branch time */
  messageCount: number;
  
  /** Estimated token count */
  tokenCount?: number;
}

interface Decision {
  id: string;
  description: string;
  madeAt: Date;
  messageId: string;  // Reference to the message where decision was made
}

interface Assumption {
  id: string;
  description: string;
  createdAt: Date;
  status: 'active' | 'invalidated' | 'confirmed';
}
```

### Branched Canvas Interface

```typescript
interface BranchedCanvas extends Canvas {
  /** Parent canvas ID (required for branched canvases) */
  parentCanvasId: string;
  
  /** Context inherited from parent */
  contextSnapshot: ContextSnapshot;
  
  /** How context was inherited */
  inheritanceMode: InheritanceMode;
  
  /** User can inspect and manage inherited context */
  inheritanceControls: ContextInheritanceControls;
}

type InheritanceMode = 'full' | 'summary' | 'custom';

interface ContextInheritanceControls {
  /** View the inherited context */
  inspect(): ContextSnapshot;
  
  /** Remove specific messages from inherited context */
  prune(messageIds: string[]): void;
  
  /** Select specific messages to keep */
  customize(selection: MessageSelection): void;
  
  /** Get summary of inherited context */
  getSummary(): string;
}

interface MessageSelection {
  includeIds: string[];
  excludeIds: string[];
}
```

### Visual Design for Context Inheritance

```
[Parent Canvas] 
    ↓ (pulsing flow animation)
[Branch Point - Inherited Context Badge: "127 messages"]
    ↓
[Child Canvas - Inherited panel collapsed by default]
```

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

## Edge Connections

### Connection Interface

```typescript
interface EdgeConnection {
  id: string;
  source: string;  // Conversation ID
  target: string;  // Conversation ID
  type: 'bezier';  // Simple curves in Phase 1
  animated?: boolean;
  style?: EdgeStyle;
}

interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
}
```

### Phase 2 Edge Enhancements

```typescript
// Directional edges with context flow indicators
interface DirectionalEdge extends EdgeConnection {
  type: 'directional';
  direction: 'forward' | 'branch';
  label?: string;
  showContextFlow?: boolean;  // Animated particles
}
```

---

## Phase Implementation Roadmap

### Phase 1: Single Canvas MVP (Current)
- ✅ Basic infinite canvas with React Flow
- ✅ Conversation cards with mock data
- ✅ Visual connections (simple Bezier curves)
- ✅ Local storage persistence with versioning
- ✅ Pan/zoom with virtualization
- ✅ Inline card expansion
- ✅ Essential keyboard shortcuts (Delete, Escape)
- ✅ Language detection and font mapping
- ✅ Dev performance overlay

### Phase 2: Branching System
- [ ] Right-click conversation → "Branch to new canvas"
- [ ] Context inheritance with clear rules
- [ ] "Inherited Context" inspection panel
- [ ] Branch reason tagging
- [ ] Visual inheritance flow indicators
- [ ] Canvas tree view (sidebar)
- [ ] Breadcrumb navigation
- [ ] AI provider integration (Claude, OpenAI, Local)

### Phase 3: Intelligence & Polish
- [ ] Suggest Layout (opt-in, not auto)
- [ ] Export/Import canvases
- [ ] Search across canvases
- [ ] Conversation summaries on hover
- [ ] Branch diff view
- [ ] Decision ancestry tracking
- [ ] Color coding by category/tag

---

## Design Principles

1. **Context flows forward, never backward** - Immutable snapshots at branch time
2. **Always inspectable** - Users must see what context they inherited
3. **Manual control wins** - No auto-repositioning, user decides layout
4. **Provider agnostic** - Abstract AI integration from day 1
5. **Dark-only identity** - Deep navy aesthetic is the brand
6. **Solo-first** - No collaboration until users demand it

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
│   ├── ErrorBoundary.tsx
│   └── DevPerformanceOverlay.tsx
├── hooks/
│   └── useKeyboardShortcuts.ts
├── stores/
│   └── canvas-store.ts
├── lib/
│   ├── design-tokens.ts
│   ├── language-utils.ts
│   ├── storage.ts
│   └── mock-data.ts
├── utils/
│   └── layoutGenerator.ts
├── constants/
│   └── zIndex.ts
├── types/
│   └── index.ts
└── __tests__/
    ├── storage.test.ts
    ├── layoutGenerator.test.ts
    └── zIndex.test.ts
```

---

## Success Metrics

### Phase 1 (Week 2)
- Can organize 5+ conversations spatially
- Smooth pan/zoom experience
- Visual appeal matches design system
- All tests passing

### Phase 2 (Week 4)
- Can branch from any conversation
- Context flows correctly between canvases
- Can navigate 3 levels deep in canvas tree

### Phase 3 (Week 6)
- 10 beta users can export/share their canvases
- Suggest layout working
- Search across conversations functional
