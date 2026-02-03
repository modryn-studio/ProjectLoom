# Phase 2 (Week 3-4)

**Success Criteria: "Branching with AI feels like magic"**

## 1. Context Inheritance Architecture

**Status: Full implementation**

### Complete Data Structure

```typescript
// Full implementation
interface Canvas {
  id: string
  parentCanvasId: string | null
  contextSnapshot: ContextSnapshot  // Add this
  inheritanceMode: 'full' | 'summary' | 'custom'
  // ... rest
}

interface ContextSnapshot {
  messages: Message[]
  metadata: BranchMetadata
  timestamp: Date
}
```

### Action Item

Document the full `ContextSnapshot` interface in a `docs/architecture.md` file now, but don't implement until Phase 2.

---

## 1a. Context Inheritance Mode UI ✅

**Recommendation: Branch-time selection with smart defaults**

### Implementation Strategy

```typescript
// User preferences (stored once)
interface UserPreferences {
  defaultInheritanceMode: 'full' | 'summary' | 'custom'
  alwaysAskOnBranch: boolean  // Power user option
}

// Branch creation flow
interface BranchCreationDialog {
  branchReason: string  // Required
  inheritanceMode: 'full' | 'summary' | 'custom'  // Pre-filled from preference
  customSelection?: MessageSelection  // Only if mode = 'custom'
}
```

### UI Flow

```typescript
// Step 1: User right-clicks conversation → "Branch to new canvas"
// Step 2: Dialog appears with:

const BranchDialog = () => (
  <Dialog>
    <Input 
      label="Branch reason" 
      placeholder="Exploring WebSocket implementation..."
      required 
    />
    
    <Select 
      label="Context to inherit"
      defaultValue={userPrefs.defaultInheritanceMode}
    >
      <option value="full">
        Full context ({messageCount} messages)
      </option>
      <option value="summary">
        AI summary (~{estimatedSummaryTokens} tokens)
      </option>
      <option value="custom">
        Let me choose specific messages
      </option>
    </Select>
    
    {/* Only show if mode = 'custom' */}
    {mode === 'custom' && <MessageSelector messages={context.messages} />}
    
    <Checkbox>
      Remember this choice as my default
    </Checkbox>
    
    <Button>Create branch</Button>
  </Dialog>
)
```

### Why This Works

1. **Sensible default** — First-time users get "full" (safest, most transparent)
2. **Learn by doing** — Users discover summary/custom options when branching
3. **Power user path** — Can set "always ask" to false and use default every time
4. **Visual feedback** — Shows token counts so users understand trade-offs

### Settings Panel

```typescript
// Settings > Branching
const BranchingSettings = () => (
  <SettingsSection title="Branching">
    <Select label="Default context inheritance">
      <option value="full">Full context</option>
      <option value="summary">AI summary</option>
      <option value="custom">Always ask me</option>
    </Select>
    
    <Checkbox 
      label="Always show branch dialog (even with default set)"
      checked={prefs.alwaysAskOnBranch}
    />
    
    <InfoBox>
      Full context: All messages inherited (most tokens)
      Summary: AI-generated summary (fewer tokens, may lose details)
      Custom: Choose specific messages to inherit
    </InfoBox>
  </SettingsSection>
)
```

**Action Item:** Implement branch dialog first, add settings panel in Phase 2 polish.

---

## 1c. Branch Dialog Placement ✅

**Recommendation: Centered modal with visual connection to source**

### Why Centered Modal Wins

```typescript
// ✅ DO THIS (Centered modal)
Pros:
- Guaranteed visibility (not cut off by viewport edges)
- User's full attention on important decision
- Consistent position (muscle memory)
- Easier to implement (no complex positioning logic)
- Mobile-friendly (same UX on all screen sizes)

// ❌ DON'T (Positioned near card)
Cons:
- Can be cut off at canvas edges
- Requires complex viewport boundary detection
- Inconsistent position breaks flow
- Hard to use when zoomed out
- Mobile: tiny cards, nowhere to position
```

### Implementation with Visual Connection

```typescript
// components/BranchDialog.tsx
interface BranchDialogProps {
  sourceConversationId: string
  sourceCardPosition: { x: number, y: number }  // For visual effect
  onBranch: (data: BranchData) => void
  onCancel: () => void
}

export function BranchDialog({ 
  sourceConversationId, 
  sourceCardPosition,
  onBranch, 
  onCancel 
}: BranchDialogProps) {
  const [branchReason, setBranchReason] = useState('')
  const [inheritanceMode, setInheritanceMode] = useState<InheritanceMode>('full')
  const sourceCard = useCanvasStore(s => 
    s.conversations.find(c => c.id === sourceConversationId)
  )
  
  return (
    <AnimatePresence>
      {/* Backdrop with blur */}
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      />
      
      {/* Centered modal */}
      <motion.div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="w-[500px] bg-navy-800 border border-violet-500/20 rounded-lg shadow-2xl">
          {/* Header with source context */}
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">
              Create Branch
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Branching from: "{sourceCard?.content[0]?.content.slice(0, 50)}..."
            </p>
          </div>
          
          {/* Form content */}
          <div className="p-6 space-y-6">
            {/* Branch reason */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Branch reason <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={branchReason}
                onChange={(e) => setBranchReason(e.target.value)}
                placeholder="e.g., Exploring WebSocket implementation..."
                className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-md text-white placeholder-white/40 focus:border-violet-500 focus:outline-none"
                autoFocus
              />
            </div>
            
            {/* Inheritance mode */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Context to inherit
              </label>
              <select
                value={inheritanceMode}
                onChange={(e) => setInheritanceMode(e.target.value as InheritanceMode)}
                className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-md text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="full">
                  Full context ({sourceCard?.content.length || 0} messages)
                </option>
                <option value="summary">
                  First 10 messages (summary mode)
                </option>
                <option value="custom">
                  Let me choose specific messages
                </option>
              </select>
              
              {/* Info box */}
              <div className="mt-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-md">
                <p className="text-xs text-white/70">
                  {inheritanceMode === 'full' && 'All messages will be inherited. Best for maintaining full context.'}
                  {inheritanceMode === 'summary' && 'Only recent messages inherited. Faster, less token usage.'}
                  {inheritanceMode === 'custom' && 'Choose which messages to bring with you.'}
                </p>
              </div>
            </div>
            
            {/* Custom message selector (only if mode = custom) */}
            {inheritanceMode === 'custom' && (
              <MessageSelector 
                messages={sourceCard?.content || []}
                onSelectionChange={(selected) => {/* handle */}}
              />
            )}
          </div>
          
          {/* Footer actions */}
          <div className="p-6 border-t border-white/10 flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-white/70 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!branchReason.trim()) {
                  // Show error
                  return
                }
                onBranch({
                  sourceConversationId,
                  branchReason,
                  inheritanceMode,
                })
              }}
              disabled={!branchReason.trim()}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:bg-violet-500/50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            >
              Create Branch
            </button>
          </div>
        </div>
      </motion.div>
      
      {/* Optional: Animated connection line from source card to modal */}
      <AnimatedConnectionLine
        from={sourceCardPosition}
        to={{ x: window.innerWidth / 2, y: window.innerHeight / 2 }}
      />
    </AnimatePresence>
  )
}
```

### Visual Connection Enhancement (Optional Polish)

```typescript
// Optional: Show where the branch is coming from
function AnimatedConnectionLine({ from, to }: { from: Point, to: Point }) {
  return (
    <svg className="fixed inset-0 pointer-events-none z-40">
      <motion.path
        d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${from.y} ${to.x} ${to.y}`}
        stroke="#667eea"
        strokeWidth="2"
        fill="none"
        strokeDasharray="5,5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.3 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      />
    </svg>
  )
}
```

### Trigger Flow

```typescript
// In ConversationCard.tsx
function ConversationCard({ data, id }: CardProps) {
  const openBranchDialog = useCanvasStore(s => s.openBranchDialog)
  
  // Right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // Show context menu with "Branch" option
    showContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Branch to new canvas',
          icon: <GitBranchIcon />,
          onClick: () => openBranchDialog(id)
        },
        // ... other menu items
      ]
    })
  }
  
  return (
    <div onContextMenu={handleContextMenu}>
      {/* Card content */}
    </div>
  )
}
```

### Store Integration

```typescript
// stores/canvas-store.ts
interface CanvasStoreState {
  // ... existing state
  branchDialogOpen: boolean
  branchSourceId: string | null
  branchSourcePosition: { x: number, y: number } | null
}

interface CanvasStoreActions {
  openBranchDialog: (conversationId: string) => void
  closeBranchDialog: () => void
  createBranch: (data: BranchData) => void
}

const useCanvasStore = create<CanvasStoreState & CanvasStoreActions>((set, get) => ({
  branchDialogOpen: false,
  branchSourceId: null,
  branchSourcePosition: null,
  
  openBranchDialog: (conversationId) => {
    const conversation = get().conversations.find(c => c.id === conversationId)
    if (!conversation) return
    
    set({
      branchDialogOpen: true,
      branchSourceId: conversationId,
      branchSourcePosition: conversation.position
    })
  },
  
  closeBranchDialog: () => {
    set({
      branchDialogOpen: false,
      branchSourceId: null,
      branchSourcePosition: null
    })
  },
  
  createBranch: (data) => {
    // Branch creation logic (next section)
    get().closeBranchDialog()
  }
}))
```

**Action Item:** Build centered modal with backdrop blur and smooth animations.

---

## 1d. Summary Mode Implementation ✅

**Recommendation: Simple truncation for Phase 2, but with smart selection**

### Why Simple Truncation Wins for Phase 2

```typescript
// Comparison
AI Summarization:
❌ Adds API call latency (2-5 seconds)
❌ Costs tokens on every branch
❌ Can lose important context in summary
❌ Non-deterministic (different results each time)
❌ Requires error handling for API failures
✅ Potentially better semantic compression

Simple Truncation:
✅ Instant (no API call)
✅ Zero cost
✅ Deterministic and predictable
✅ User sees exactly what they're getting
✅ Can preview before branching
❌ Might cut off mid-context
```

### Smart Truncation Strategy

Instead of dumb "first N messages", use **smart boundary detection**:

```typescript
// lib/context-truncation.ts

interface TruncationStrategy {
  type: 'recent' | 'important' | 'boundary'
  maxMessages: number
}

/**
 * Smart truncation that preserves conversation boundaries
 */
export function truncateContext(
  messages: Message[],
  strategy: TruncationStrategy
): Message[] {
  switch (strategy.type) {
    case 'recent':
      return truncateRecent(messages, strategy.maxMessages)
    
    case 'important':
      return truncateImportant(messages, strategy.maxMessages)
    
    case 'boundary':
      return truncateBoundary(messages, strategy.maxMessages)
    
    default:
      return messages
  }
}

/**
 * Simple: Take last N messages
 */
function truncateRecent(messages: Message[], maxMessages: number): Message[] {
  return messages.slice(-maxMessages)
}

/**
 * Smart: Detect conversation boundaries and truncate at natural breaks
 */
function truncateBoundary(messages: Message[], maxMessages: number): Message[] {
  if (messages.length <= maxMessages) return messages
  
  // Find conversation boundaries (user messages followed by assistant responses)
  const boundaries: number[] = [0]
  
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1]
    const curr = messages[i]
    
    // Boundary = user message after assistant message
    if (prev.role === 'assistant' && curr.role === 'user') {
      boundaries.push(i)
    }
  }
  
  // Find closest boundary to our target
  const targetIndex = messages.length - maxMessages
  const closestBoundary = boundaries.reduce((prev, curr) => 
    Math.abs(curr - targetIndex) < Math.abs(prev - targetIndex) ? curr : prev
  )
  
  // Return from boundary onwards (ensures we start with user message)
  return messages.slice(closestBoundary)
}

/**
 * Important: Preserve first message (context) + recent messages
 */
function truncateImportant(messages: Message[], maxMessages: number): Message[] {
  if (messages.length <= maxMessages) return messages
  
  // Always keep first message (often contains important context)
  const first = messages[0]
  
  // Take most recent messages
  const recent = messages.slice(-(maxMessages - 1))
  
  // Check if first message is already in recent
  if (recent[0]?.id === first.id) {
    return recent
  }
  
  return [first, ...recent]
}

/**
 * Calculate token estimate for truncated context
 */
export function estimateTokens(messages: Message[]): number {
  // Rough estimate: 1 token ≈ 4 characters
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
  return Math.ceil(totalChars / 4)
}

/**
 * Get truncation preview for UI
 */
export function getTruncationPreview(
  messages: Message[],
  strategy: TruncationStrategy
): {
  truncated: Message[]
  removed: number
  tokensSaved: number
} {
  const truncated = truncateContext(messages, strategy)
  const removed = messages.length - truncated.length
  
  const originalTokens = estimateTokens(messages)
  const truncatedTokens = estimateTokens(truncated)
  const tokensSaved = originalTokens - truncatedTokens
  
  return { truncated, removed, tokensSaved }
}
```

### UI Implementation

```typescript
// In BranchDialog.tsx
function InheritanceModeSelector({ messages }: Props) {
  const [mode, setMode] = useState<InheritanceMode>('full')
  const [preview, setPreview] = useState<TruncationPreview | null>(null)
  
  // Update preview when mode changes
  useEffect(() => {
    if (mode === 'summary') {
      const result = getTruncationPreview(messages, {
        type: 'boundary',  // Smart truncation
        maxMessages: 10
      })
      setPreview(result)
    } else {
      setPreview(null)
    }
  }, [mode, messages])
  
  return (
    <div className="space-y-3">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as InheritanceMode)}
        className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-md"
      >
        <option value="full">
          Full context ({messages.length} messages, ~{estimateTokens(messages)} tokens)
        </option>
        <option value="summary">
          Recent context (smart truncation)
        </option>
        <option value="custom">
          Custom selection
        </option>
      </select>
      
      {/* Preview panel for summary mode */}
      {mode === 'summary' && preview && (
        <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-md space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/70">Preview:</span>
            <span className="text-violet-400">
              {preview.truncated.length} messages kept, {preview.removed} removed
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/70">Token savings:</span>
            <span className="text-green-400">
              ~{preview.tokensSaved} tokens saved
            </span>
          </div>
          
          {/* Show what gets kept */}
          <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
            <p className="text-xs text-white/50 mb-2">Messages that will be inherited:</p>
            {preview.truncated.slice(0, 3).map((msg, i) => (
              <div key={i} className="text-xs text-white/60 truncate">
                <span className="text-violet-400">{msg.role}:</span> {msg.content.slice(0, 60)}...
              </div>
            ))}
            {preview.truncated.length > 3 && (
              <p className="text-xs text-white/40">
                + {preview.truncated.length - 3} more messages
              </p>
            )}
          </div>
          
          {preview.removed > 0 && (
            <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
              ⚠️ {preview.removed} older messages will not be inherited
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

### Configuration

```typescript
// lib/config.ts
export const TRUNCATION_CONFIG = {
  summary: {
    strategy: 'boundary' as const,  // Smart truncation
    maxMessages: 10,
    showPreview: true
  },
  
  // Future: Different strategies for different use cases
  strategies: {
    recent: { maxMessages: 10 },
    important: { maxMessages: 15 },  // Keeps first + recent
    boundary: { maxMessages: 10 }   // Truncates at conversation boundaries
  }
}
```

### Creating Branch with Truncation

```typescript
// stores/canvas-store.ts
createBranch: (data: BranchData) => {
  const { sourceConversationId, branchReason, inheritanceMode } = data
  const sourceConversation = get().conversations.find(c => c.id === sourceConversationId)
  if (!sourceConversation) return
  
  // Prepare context based on inheritance mode
  let contextSnapshot: ContextSnapshot
  
  switch (inheritanceMode) {
    case 'full':
      contextSnapshot = {
        messages: sourceConversation.content,
        metadata: {
          branchReason,
          sourceConversationId,
          inheritanceMode: 'full',
          timestamp: new Date()
        }
      }
      break
    
    case 'summary':
      const truncated = truncateContext(sourceConversation.content, {
        type: 'boundary',
        maxMessages: 10
      })
      contextSnapshot = {
        messages: truncated,
        metadata: {
          branchReason,
          sourceConversationId,
          inheritanceMode: 'summary',
          originalMessageCount: sourceConversation.content.length,
          truncatedMessageCount: truncated.length,
          timestamp: new Date()
        }
      }
      break
    
    case 'custom':
      // Use custom selected messages
      contextSnapshot = {
        messages: data.customMessages || [],
        metadata: {
          branchReason,
          sourceConversationId,
          inheritanceMode: 'custom',
          timestamp: new Date()
        }
      }
      break
  }
  
  // Create new canvas with inherited context
  const newCanvas: Canvas = {
    id: generateId(),
    parentCanvasId: get().currentCanvasId,
    contextSnapshot,
    conversations: [],
    metadata: {
      title: branchReason,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: STORAGE_VERSION
    }
  }
  
  set(state => ({
    canvases: [...state.canvases, newCanvas],
    currentCanvasId: newCanvas.id
  }))
  
  // Save to storage
  get().saveToStorage()
}
```

### Phase 3: AI Summarization Enhancement

When you get to Phase 3, you can add AI summarization as an **optional enhancement**:

```typescript
// Future Phase 3
interface TruncationStrategy {
  type: 'recent' | 'important' | 'boundary' | 'ai-summary'  // Add this
  maxMessages?: number
  summaryLength?: 'short' | 'medium' | 'long'
}

async function aiSummarizeContext(messages: Message[]): Promise<Message[]> {
  const summary = await claude.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    messages: [{
      role: 'user',
      content: `Summarize this conversation in 3-5 key exchanges:\n\n${formatMessages(messages)}`
    }]
  })
  
  return [{
    id: generateId(),
    role: 'system',
    content: `[AI Summary of ${messages.length} messages]\n\n${summary.content}`,
    timestamp: new Date()
  }]
}
```

---

## 1e. Custom Inheritance Mode UI ✅

**Recommendation: Message checkboxes for Phase 2 (KISS principle)**

### Why Checkboxes Win for Phase 2

```typescript
// Phase 2: Manual Selection (Checkboxes)
Pros:
✅ Direct manipulation - see exactly what you're getting
✅ Zero learning curve - everyone understands checkboxes
✅ Predictable - no surprise edge cases with rules
✅ Simple implementation - ~100 lines of code
✅ Easy to debug - state is just array of IDs
✅ Works for all use cases (code, text, images, etc.)

// Phase 3: Rules-Based (Future)
Pros:
✅ Faster for power users
✅ Reusable patterns
✅ Handles large conversations better
Cons:
❌ Requires rule engine implementation
❌ Edge cases (what counts as "code block"?)
❌ User education needed
❌ More complex state management
```

### Phase 2 Implementation: Message Selector

```typescript
// components/MessageSelector.tsx
import { useState, useMemo } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { Message } from '@/types'

interface MessageSelectorProps {
  messages: Message[]
  initialSelection?: Set<string>  // Pre-selected message IDs
  onSelectionChange: (selectedIds: Set<string>) => void
}

export function MessageSelector({ 
  messages, 
  initialSelection = new Set(),
  onSelectionChange 
}: MessageSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelection)
  
  // Statistics
  const stats = useMemo(() => ({
    total: messages.length,
    selected: selectedIds.size,
    estimatedTokens: messages
      .filter(m => selectedIds.has(m.id))
      .reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0)
  }), [messages, selectedIds])
  
  // Toggle individual message
  const toggleMessage = (messageId: string) => {
    const newSelection = new Set(selectedIds)
    if (newSelection.has(messageId)) {
      newSelection.delete(messageId)
    } else {
      newSelection.add(messageId)
    }
    setSelectedIds(newSelection)
    onSelectionChange(newSelection)
  }
  
  // Bulk actions
  const selectAll = () => {
    const allIds = new Set(messages.map(m => m.id))
    setSelectedIds(allIds)
    onSelectionChange(allIds)
  }
  
  const selectNone = () => {
    const empty = new Set<string>()
    setSelectedIds(empty)
    onSelectionChange(empty)
  }
  
  const selectRecent = (count: number) => {
    const recentIds = new Set(messages.slice(-count).map(m => m.id))
    setSelectedIds(recentIds)
    onSelectionChange(recentIds)
  }
  
  return (
    <div className="space-y-3">
      {/* Header with stats */}
      <div className="flex items-center justify-between p-3 bg-violet-500/10 border border-violet-500/20 rounded-md">
        <div className="text-sm text-white/70">
          <span className="font-medium text-violet-400">
            {stats.selected}
          </span> of {stats.total} messages selected
          <span className="text-white/50 ml-2">
            (~{stats.estimatedTokens} tokens)
          </span>
        </div>
        
        {/* Quick actions */}
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-xs px-2 py-1 text-violet-400 hover:text-violet-300 transition-colors"
          >
            All
          </button>
          <button
            onClick={() => selectRecent(10)}
            className="text-xs px-2 py-1 text-violet-400 hover:text-violet-300 transition-colors"
          >
            Last 10
          </button>
          <button
            onClick={selectNone}
            className="text-xs px-2 py-1 text-white/50 hover:text-white/70 transition-colors"
          >
            None
          </button>
        </div>
      </div>
      
      {/* Message list with checkboxes */}
      <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
        {messages.map((message, index) => (
          <MessageCheckboxItem
            key={message.id}
            message={message}
            index={index}
            isSelected={selectedIds.has(message.id)}
            onToggle={() => toggleMessage(message.id)}
          />
        ))}
      </div>
      
      {/* Warning if selection is empty */}
      {stats.selected === 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
          <p className="text-xs text-amber-400">
            ⚠️ No messages selected. The new canvas will have no inherited context.
          </p>
        </div>
      )}
    </div>
  )
}

// Individual message checkbox item
function MessageCheckboxItem({ 
  message, 
  index, 
  isSelected, 
  onToggle 
}: {
  message: Message
  index: number
  isSelected: boolean
  onToggle: () => void
}) {
  const previewLength = 100
  const preview = message.content.length > previewLength
    ? message.content.slice(0, previewLength) + '...'
    : message.content
  
  // Detect message type for icon
  const hasCode = message.content.includes('```')
  const isLong = message.content.length > 500
  
  return (
    <label
      className={`
        flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors
        ${isSelected 
          ? 'bg-violet-500/10 border-violet-500/30' 
          : 'bg-navy-900/50 border-white/5 hover:border-white/10'
        }
      `}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onChange={onToggle}
        className="mt-0.5 flex-shrink-0"
      />
      
      {/* Message content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`
            text-xs font-medium
            ${message.role === 'user' ? 'text-blue-400' : 'text-violet-400'}
          `}>
            {message.role === 'user' ? 'User' : 'Assistant'}
          </span>
          
          <span className="text-xs text-white/30">
            Message {index + 1}
          </span>
          
          {/* Indicators */}
          {hasCode && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              code
            </span>
          )}
          {isLong && (
            <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              {Math.ceil(message.content.length / 4)} tokens
            </span>
          )}
        </div>
        
        {/* Preview */}
        <p className="text-sm text-white/60 whitespace-pre-wrap break-words">
          {preview}
        </p>
        
        {/* Timestamp */}
        <p className="text-xs text-white/30 mt-1">
          {formatTimestamp(message.timestamp)}
        </p>
      </div>
    </label>
  )
}

// Helper
function formatTimestamp(date: Date): string {
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day'
  )
}
```

### Integration in Branch Dialog

```typescript
// In BranchDialog.tsx
function BranchDialog({ sourceConversationId, onBranch, onCancel }: Props) {
  const [branchReason, setBranchReason] = useState('')
  const [inheritanceMode, setInheritanceMode] = useState<InheritanceMode>('full')
  const [customSelection, setCustomSelection] = useState<Set<string>>(new Set())
  
  const sourceConversation = useCanvasStore(s => 
    s.conversations.find(c => c.id === sourceConversationId)
  )
  
  const handleBranch = () => {
    if (!branchReason.trim()) return
    
    // Prepare custom messages if mode = custom
    const customMessages = inheritanceMode === 'custom'
      ? sourceConversation?.content.filter(m => customSelection.has(m.id))
      : undefined
    
    onBranch({
      sourceConversationId,
      branchReason,
      inheritanceMode,
      customMessages,  // Pass selected messages
    })
  }
  
  return (
    <Dialog>
      {/* ... header, branch reason input ... */}
      
      {/* Inheritance mode selector */}
      <select
        value={inheritanceMode}
        onChange={(e) => {
          setInheritanceMode(e.target.value as InheritanceMode)
          // Pre-select all messages when switching to custom mode
          if (e.target.value === 'custom' && sourceConversation) {
            setCustomSelection(new Set(sourceConversation.content.map(m => m.id)))
          }
        }}
      >
        <option value="full">Full context</option>
        <option value="summary">Recent context (10 messages)</option>
        <option value="custom">Custom selection</option>
      </select>
      
      {/* Show message selector for custom mode */}
      {inheritanceMode === 'custom' && sourceConversation && (
        <div className="mt-4">
          <MessageSelector
            messages={sourceConversation.content}
            initialSelection={customSelection}
            onSelectionChange={setCustomSelection}
          />
        </div>
      )}
      
      {/* ... footer buttons ... */}
      <button
        onClick={handleBranch}
        disabled={!branchReason.trim() || (inheritanceMode === 'custom' && customSelection.size === 0)}
      >
        Create Branch
      </button>
    </Dialog>
  )
}
```

### Smart Defaults for Custom Mode

```typescript
// When user switches to custom mode, intelligently pre-select messages
function getSmartInitialSelection(messages: Message[]): Set<string> {
  const selected = new Set<string>()
  
  // Strategy: Select first message + last 10 messages
  if (messages.length > 0) {
    // Always include first message (often contains important context)
    selected.add(messages[0].id)
    
    // Include last 10 messages
    const recentCount = Math.min(10, messages.length)
    messages.slice(-recentCount).forEach(m => selected.add(m.id))
  }
  
  return selected
}

// Usage in dialog
const [customSelection, setCustomSelection] = useState<Set<string>>(() => 
  getSmartInitialSelection(sourceConversation?.content || [])
)
```

### Keyboard Shortcuts for Power Users

```typescript
// In MessageSelector.tsx
function MessageSelector({ messages, ... }: Props) {
  // ... existing state
  
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
      }
      
      // Cmd/Ctrl + Shift + A: Deselect all
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault()
        selectNone()
      }
      
      // Cmd/Ctrl + I: Invert selection
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        const allIds = new Set(messages.map(m => m.id))
        const inverted = new Set(
          [...allIds].filter(id => !selectedIds.has(id))
        )
        setSelectedIds(inverted)
        onSelectionChange(inverted)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [messages, selectedIds])
  
  return (
    <div>
      {/* Add keyboard shortcut hints */}
      <div className="text-xs text-white/40 mb-2">
        Shortcuts: ⌘A (all) • ⌘⇧A (none) • ⌘I (invert)
      </div>
      
      {/* ... rest of component ... */}
    </div>
  )
}
```

### Validation & Edge Cases

```typescript
// In store's createBranch action
createBranch: (data: BranchData) => {
  const { inheritanceMode, customMessages } = data
  
  // Validate custom mode
  if (inheritanceMode === 'custom') {
    if (!customMessages || customMessages.length === 0) {
      toast.error('Please select at least one message to inherit')
      return
    }
    
    // Warn if selection seems incomplete
    if (customMessages.length < 3) {
      const confirmed = window.confirm(
        `Only ${customMessages.length} messages selected. This might not provide enough context. Continue anyway?`
      )
      if (!confirmed) return
    }
  }
  
  // ... rest of branch creation logic
}
```

---

### Phase 3: Rules-Based Selection (Future)

When you get to Phase 3 and users are demanding faster workflows, add **rule-based selection** as an enhancement:

#### Phase 3 Concept (Don't Implement Now)

```typescript
// Future: Phase 3 enhancement
interface SelectionRule {
  id: string
  name: string
  description: string
  predicate: (message: Message) => boolean
}

const PRESET_RULES: SelectionRule[] = [
  {
    id: 'code-only',
    name: 'Code blocks only',
    description: 'Messages containing code blocks (```)',
    predicate: (m) => m.content.includes('```')
  },
  {
    id: 'user-messages',
    name: 'User messages only',
    description: 'Only my questions/prompts',
    predicate: (m) => m.role === 'user'
  },
  {
    id: 'long-messages',
    name: 'Long messages (>500 chars)',
    description: 'Detailed responses only',
    predicate: (m) => m.content.length > 500
  },
  {
    id: 'recent-10',
    name: 'Last 10 messages',
    description: 'Most recent conversation',
    predicate: (m, index, arr) => index >= arr.length - 10
  }
]

// Custom rule builder
interface CustomRule {
  field: 'role' | 'content' | 'length' | 'timestamp'
  operator: 'contains' | 'equals' | 'greater' | 'less'
  value: string | number
}

// Future UI
function RuleBasedSelector() {
  const [selectedRules, setSelectedRules] = useState<string[]>([])
  
  return (
    <div>
      <h4>Quick select by rules:</h4>
      {PRESET_RULES.map(rule => (
        <Checkbox
          key={rule.id}
          label={rule.name}
          description={rule.description}
          checked={selectedRules.includes(rule.id)}
          onChange={(checked) => {
            // Apply rule immediately
            const messages = applyRule(rule)
            onSelectionChange(messages)
          }}
        />
      ))}
    </div>
  )
}
```

---

### Implementation Priority

#### Week 2, Day 2-3: Custom Message Selector

```typescript
// Day 2: Build MessageSelector component
1. ✅ Basic checkbox list
2. ✅ Select all/none buttons
3. ✅ Message preview with role indicators
4. ✅ Selection statistics

// Day 3: Polish & integration
5. ✅ Smart initial selection (first + last 10)
6. ✅ Keyboard shortcuts
7. ✅ Validation & warnings
8. ✅ Integration in BranchDialog
```

### Testing Checklist

```typescript
// Edge cases to test
const TEST_CASES = [
  'Empty conversation (0 messages)',
  'Single message conversation',
  'Large conversation (100+ messages)',
  'Custom mode with 0 selected (should block)',
  'Custom mode with 1 selected (should warn)',
  'Select all → deselect all → select recent',
  'Keyboard shortcuts (Cmd+A, Cmd+Shift+A, Cmd+I)',
  'Switching between modes preserves custom selection',
  'Token estimate accuracy'
]
```

**Action Item:** Implement checkbox-based MessageSelector for Phase 2. Track user feedback on common selection patterns to inform Phase 3 rule design.

---

## 1b. Canvas Tree Storage ✅

**Recommendation: Flat array with `parentCanvasId` (Git model)**

### Data Structure

```typescript
// ✅ DO THIS (Flat array - Git model)
interface CanvasStore {
  canvases: Canvas[]  // Flat array
  currentCanvasId: string
  rootCanvasIds: string[]  // Canvases with parentCanvasId = null
}

interface Canvas {
  id: string
  parentCanvasId: string | null  // null = root canvas
  contextSnapshot: ContextSnapshot | null  // null if root
  conversations: Conversation[]
  metadata: CanvasMetadata
}

// ❌ DON'T DO THIS (Nested structure)
interface Canvas {
  id: string
  children: Canvas[]  // Expensive to traverse, hard to update
}
```

### Why Flat Array Wins

| Aspect | Flat Array | Nested Structure |
|--------|-----------|------------------|
| **Finding canvas** | O(1) with Map lookup | O(n) tree traversal |
| **Adding child** | Push to array + set parentId | Deep mutation |
| **Moving canvas** | Update one field | Restructure tree |
| **Serialization** | JSON.stringify works | Circular ref issues |
| **Undo/redo** | Simple state snapshots | Complex tree diffs |

### Implementation

```typescript
// canvas-store.ts
interface CanvasStoreState {
  canvases: Canvas[]
  currentCanvasId: string
}

// Helper functions
const getCanvas = (id: string, canvases: Canvas[]) => 
  canvases.find(c => c.id === id)

const getChildren = (parentId: string, canvases: Canvas[]) =>
  canvases.filter(c => c.parentCanvasId === parentId)

const getAncestors = (canvasId: string, canvases: Canvas[]): Canvas[] => {
  const canvas = getCanvas(canvasId, canvases)
  if (!canvas || !canvas.parentCanvasId) return []
  
  const parent = getCanvas(canvas.parentCanvasId, canvases)
  return parent ? [parent, ...getAncestors(parent.id, canvases)] : []
}

const getRootCanvas = (canvasId: string, canvases: Canvas[]): Canvas => {
  const ancestors = getAncestors(canvasId, canvases)
  return ancestors.length > 0 ? ancestors[ancestors.length - 1] : getCanvas(canvasId, canvases)!
}
```

### Tree View Rendering

```typescript
// components/CanvasTreeView.tsx
function CanvasTreeView({ canvases, currentCanvasId }: Props) {
  const rootCanvases = canvases.filter(c => c.parentCanvasId === null)
  
  return (
    <div className="canvas-tree">
      {rootCanvases.map(root => (
        <CanvasTreeNode 
          key={root.id}
          canvas={root}
          canvases={canvases}  // Pass flat array down
          currentCanvasId={currentCanvasId}
          depth={0}
        />
      ))}
    </div>
  )
}

function CanvasTreeNode({ canvas, canvases, currentCanvasId, depth }: NodeProps) {
  const children = canvases.filter(c => c.parentCanvasId === canvas.id)
  const isActive = canvas.id === currentCanvasId
  
  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div className={isActive ? 'active' : ''}>
        {canvas.metadata.title}
        {children.length > 0 && <span>({children.length})</span>}
      </div>
      
      {/* Recursive rendering */}
      {children.map(child => (
        <CanvasTreeNode
          key={child.id}
          canvas={child}
          canvases={canvases}  // Same flat array
          currentCanvasId={currentCanvasId}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}
```

### Storage Schema

```typescript
// localStorage structure
{
  "projectloom_canvases": [
    {
      "id": "canvas-1",
      "parentCanvasId": null,  // Root
      "title": "Main Project",
      "conversations": [...]
    },
    {
      "id": "canvas-2",
      "parentCanvasId": "canvas-1",  // Child of canvas-1
      "title": "WebSocket Exploration",
      "contextSnapshot": { ... },
      "conversations": [...]
    },
    {
      "id": "canvas-3",
      "parentCanvasId": "canvas-1",  // Sibling of canvas-2
      "title": "Polling Implementation",
      "contextSnapshot": { ... },
      "conversations": [...]
    }
  ],
  "projectloom_current_canvas_id": "canvas-2"
}
```

**Action Item:** Add `canvases: Canvas[]` to store, update storage layer to handle multiple canvases.

---

## 2. AI Provider Implementation

**Status: Real AI integration**

### Real Provider Implementations

```typescript
// Real implementations
class ClaudeProvider implements AIProvider {
  async sendMessage(content: string, context: Context) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5-20250929', messages: [...context, { role: 'user', content }] })
    })
    return await response.json()
  }
}

class OpenAIProvider implements AIProvider { /* similar */ }
```

---

## 2a. API Key Management ✅

**Recommendation: Hybrid approach — localStorage for dev, env vars for production**

### Phase 2 Implementation

```typescript
// lib/api-keys.ts
interface APIKeyConfig {
  provider: 'claude' | 'openai' | 'ollama'
  key?: string
  endpoint?: string  // For Ollama/custom endpoints
}

// Security warning component
const APIKeyWarning = () => (
  <Alert variant="warning">
    <AlertTitle>Security Notice</AlertTitle>
    <p>API keys in localStorage can be accessed by browser extensions and XSS attacks.</p>
    <p><strong>For production use</strong>, set keys in environment variables:</p>
    <pre>
      NEXT_PUBLIC_CLAUDE_API_KEY=sk-ant-...
      NEXT_PUBLIC_OPENAI_API_KEY=sk-...
    </pre>
  </Alert>
)

// Key management logic
class APIKeyManager {
  private readonly STORAGE_KEY = 'projectloom_api_keys'
  
  // Check environment first, fall back to localStorage
  getKey(provider: 'claude' | 'openai'): string | null {
    // 1. Check environment variables (production)
    const envKey = this.getEnvKey(provider)
    if (envKey) return envKey
    
    // 2. Check localStorage (dev/testing)
    const storedKeys = this.getStoredKeys()
    return storedKeys[provider] || null
  }
  
  private getEnvKey(provider: string): string | null {
    switch (provider) {
      case 'claude':
        return process.env.NEXT_PUBLIC_CLAUDE_API_KEY || null
      case 'openai':
        return process.env.NEXT_PUBLIC_OPENAI_API_KEY || null
      default:
        return null
    }
  }
  
  private getStoredKeys(): Record<string, string> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }
  
  // Save to localStorage with encryption (basic obfuscation)
  saveKey(provider: string, key: string) {
    const keys = this.getStoredKeys()
    keys[provider] = this.obfuscate(key)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(keys))
  }
  
  // Basic obfuscation (NOT real encryption, just prevents casual viewing)
  private obfuscate(key: string): string {
    return btoa(key)  // Base64 encode
  }
  
  private deobfuscate(encoded: string): string {
    return atob(encoded)  // Base64 decode
  }
  
  // Clear all keys
  clearKeys() {
    localStorage.removeItem(this.STORAGE_KEY)
  }
  
  // Check if user has any keys configured
  hasKeys(): boolean {
    return this.getKey('claude') !== null || this.getKey('openai') !== null
  }
}

export const apiKeyManager = new APIKeyManager()
```

### Settings UI

```typescript
// components/SettingsPanel.tsx
function APIKeySettings() {
  const [claudeKey, setClaudeKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [showKeys, setShowKeys] = useState(false)
  
  // Load on mount
  useEffect(() => {
    setClaudeKey(apiKeyManager.getKey('claude') || '')
    setOpenaiKey(apiKeyManager.getKey('openai') || '')
  }, [])
  
  const handleSave = () => {
    if (claudeKey) apiKeyManager.saveKey('claude', claudeKey)
    if (openaiKey) apiKeyManager.saveKey('openai', openaiKey)
    toast.success('API keys saved')
  }
  
  return (
    <SettingsSection title="AI Provider Keys">
      <APIKeyWarning />
      
      <div className="space-y-4 mt-4">
        <div>
          <label>Claude API Key</label>
          <Input
            type={showKeys ? 'text' : 'password'}
            value={claudeKey}
            onChange={(e) => setClaudeKey(e.target.value)}
            placeholder="sk-ant-..."
          />
          {process.env.NEXT_PUBLIC_CLAUDE_API_KEY && (
            <p className="text-sm text-green-500">
              ✓ Using environment variable (secure)
            </p>
          )}
        </div>
        
        <div>
          <label>OpenAI API Key</label>
          <Input
            type={showKeys ? 'text' : 'password'}
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>
        
        <Checkbox 
          checked={showKeys}
          onChange={(e) => setShowKeys(e.target.checked)}
        >
          Show keys
        </Checkbox>
        
        <Button onClick={handleSave}>Save API Keys</Button>
        <Button variant="ghost" onClick={() => apiKeyManager.clearKeys()}>
          Clear all keys
        </Button>
      </div>
    </SettingsSection>
  )
}
```

### Provider Implementation

```typescript
// lib/providers/claude-provider.ts
import Anthropic from '@anthropic-ai/sdk'
import { apiKeyManager } from '../api-keys'

export class ClaudeProvider implements AIProvider {
  private client: Anthropic | null = null
  
  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = apiKeyManager.getKey('claude')
      if (!apiKey) {
        throw new Error('Claude API key not configured. Set NEXT_PUBLIC_CLAUDE_API_KEY or add key in Settings.')
      }
      this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    }
    return this.client
  }
  
  async sendMessage(content: string, context: Message[]): Promise<Message> {
    const client = this.getClient()
    
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        ...context.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content }
      ]
    })
    
    return {
      id: response.id,
      role: 'assistant',
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      timestamp: new Date()
    }
  }
}
```

### Security Best Practices

```typescript
// .env.example (commit this)
NEXT_PUBLIC_CLAUDE_API_KEY=your_key_here
NEXT_PUBLIC_OPENAI_API_KEY=your_key_here

// .env.local (DO NOT commit)
NEXT_PUBLIC_CLAUDE_API_KEY=sk-ant-actual-key
NEXT_PUBLIC_OPENAI_API_KEY=sk-actual-key

// .gitignore (ensure this exists)
.env.local
.env*.local
```

### Future: Server-Side Proxy (Phase 3+)

```typescript
// For production, move to API routes
// app/api/ai/route.ts
export async function POST(request: Request) {
  const { provider, messages } = await request.json()
  
  // Keys stored server-side only
  const apiKey = process.env.CLAUDE_API_KEY  // No NEXT_PUBLIC prefix
  
  // Rate limiting, usage tracking, etc.
  return Response.json({ ... })
}
```

**Action Item:** 
1. Implement `APIKeyManager` with env var priority
2. Add warning banner in settings
3. Document in README: "For dev: use localStorage, for prod: use env vars"

---

## 3. Visual Polish Priority

**Status: Advanced effects**

### Phase 2 Focus - Delight Moments

```css
✅ Particle trails on drag
✅ Branch split animation
✅ Context flow visualization
✅ Minimap with depth blur
✅ Sound effects (optional)
```

### Code Example - Branch Split Animation

```typescript
// Phase 2 - Delight moments
// Example: Branch split animation
const branchAnimation = {
  initial: { scale: 1, opacity: 1 },
  split: { 
    scale: [1, 1.1, 0.95, 1],
    opacity: [1, 0.8, 1],
    transition: { duration: 0.6, ease: 'easeOut' }
  }
}
```

### Rationale

- Phase 2: Add delight once core UX is validated
- Advanced effects are expensive to get right - only worth it if Phase 1 works

---

## 7. Card Color Coding - Semantic Colors

**Status: Add semantic color coding when tags/categories exist**

### Phase 2 Implementation

```typescript
// Phase 2: When tags/categories exist
export const CATEGORY_COLORS = {
  planning: {
    border: '#3b82f6',     // Blue
    accent: '#60a5fa',
    bg: 'rgba(59, 130, 246, 0.05)'
  },
  implementation: {
    border: '#10b981',     // Green
    accent: '#34d399',
    bg: 'rgba(16, 185, 129, 0.05)'
  },
  debugging: {
    border: '#ef4444',     // Red
    accent: '#f87171',
    bg: 'rgba(239, 68, 68, 0.05)'
  },
  research: {
    border: '#8b5cf6',     // Purple
    accent: '#a78bfa',
    bg: 'rgba(139, 92, 246, 0.05)'
  },
  documentation: {
    border: '#fbbf24',     // Amber (our accent)
    accent: '#fcd34d',
    bg: 'rgba(251, 191, 36, 0.05)'
  }
}

// Phase 2: Card with category
function ConversationCard({ data, isExpanded }: Props) {
  const category = data.category || 'default'
  const colors = CATEGORY_COLORS[category] || DEFAULT_COLORS
  
  return (
    <div 
      className="card"
      style={{
        borderColor: colors.border,
        background: isExpanded ? colors.bg : '#1a1f35'
      }}
    >
      {/* Card content */}
    </div>
  )
}
```

### Rationale

- Phase 1 uses single color scheme for consistency
- Phase 2 adds semantic colors when tagging system exists
- Colors indicate conversation category/purpose

---

## 4. Edge Styling

**Status: Directional with inheritance indicators**

### Implementation - Context Flow Visualization

```typescript
// Directional with inheritance indicators
<Edge
  id={edgeId}
  source={parentId}
  target={childId}
  markerEnd={{
    type: MarkerType.ArrowClosed,
    color: '#667eea',
    width: 20,
    height: 20
  }}
  animated={isActiveInheritance} // Particles flowing parent → child
  style={{
    stroke: '#667eea',
    strokeWidth: contextDepth * 2, // Thicker = more context
    opacity: isInheritingContext ? 0.8 : 0.4
  }}
  label={`${inheritedMessages} messages`}
/>
```

### Visual Concept

```
Phase 1:  [Node A] ~~~ [Node B]

Phase 2:  [Parent] ----→ [Child]
                    ↓
          (127 messages inherited)
```

---

## 5. Card Interaction Modes

**Status: Add full-screen mode**

### Phase 2 Enhancement

- Double-click → Full-screen overlay
- Full-screen state: `{ width: '80vw', height: '80vh' }`

---

---

## 6. Card Metadata - Tags

**Status: Add tags to card metadata**

### Phase 2 Enhancement - Tags

```typescript
// Phase 2 enhancement
<div className="card-footer">
  <time className="card-timestamp">
    {formatRelativeTime(data.createdAt)}
  </time>
  
  {/* Tags (Phase 2) */}
  {data.tags && data.tags.length > 0 && (
    <div className="card-tags">
      {data.tags.slice(0, 2).map(tag => (
        <span key={tag} className="tag">
          {tag}
        </span>
      ))}
      {data.tags.length > 2 && (
        <span className="tag-more">+{data.tags.length - 2}</span>
      )}
    </div>
  )}
</div>
```

### Rationale

- Phase 1 has timestamp + message count
- Phase 2 adds tagging system for organization
- Show up to 2 tags on collapsed cards

---

## 7. Card Color Coding - Semantic Colors

**Status: Add semantic color coding when tags/categories exist**

### Phase 2 Implementation

```typescript
// Phase 2: When tags/categories exist
export const CATEGORY_COLORS = {
  planning: {
    border: '#3b82f6',     // Blue
    accent: '#60a5fa',
    bg: 'rgba(59, 130, 246, 0.05)'
  },
  implementation: {
    border: '#10b981',     // Green
    accent: '#34d399',
    bg: 'rgba(16, 185, 129, 0.05)'
  },
  debugging: {
    border: '#ef4444',     // Red
    accent: '#f87171',
    bg: 'rgba(239, 68, 68, 0.05)'
  },
  research: {
    border: '#8b5cf6',     // Purple
    accent: '#a78bfa',
    bg: 'rgba(139, 92, 246, 0.05)'
  },
  documentation: {
    border: '#fbbf24',     // Amber (our accent)
    accent: '#fcd34d',
    bg: 'rgba(251, 191, 36, 0.05)'
  }
}

// Phase 2: Card with category
function ConversationCard({ data, isExpanded }: Props) {
  const category = data.category || 'default'
  const colors = CATEGORY_COLORS[category] || DEFAULT_COLORS
  
  return (
    <div 
      className="card"
      style={{
        borderColor: colors.border,
        background: isExpanded ? colors.bg : '#1a1f35'
      }}
    >
      {/* Card content */}
    </div>
  )
}
```

### Rationale

- Phase 1 uses single color scheme for consistency
- Phase 2 adds semantic colors when tagging system exists
- Colors indicate conversation category/purpose

---

## 8. Deployment - Database Integration

**Status: Add database (platform-agnostic)**

### Phase 2 - Database Support

```typescript
// Can use Supabase (works on any host)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Works on: Vercel, Netlify, Railway, self-hosted, etc.
```

### Rationale

- Phase 1 uses localStorage (browser-only)
- Phase 2 adds persistent database for multi-device sync
- Keep platform-agnostic (Supabase works anywhere)

---

## Summary

| Feature | Phase 2 Status |
|---------|----------------|
| **Context Inheritance** | Full implementation |
| **AI Providers** | Real Claude/OpenAI |
| **Visual Polish** | Advanced effects |
| **Edge Styling** | Directional arrows + context indicators |
| **Card Interaction** | + Full-screen mode |
| **Deployment** | Add Supabase database |
