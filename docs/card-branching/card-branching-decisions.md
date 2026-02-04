# Card-Level Branching: Architecture Decisions

## **1. Maximum Parent Limit for Merge Nodes**

### **Recommendation: Soft limit of 5 with UI degradation pattern**

**Why 5, not 7:**
- **Cognitive load research:** Miller's Law suggests 5±2 items is optimal for working memory
- **Visual comprehension:** 5 edges converging is still visually parsable, 7+ becomes spaghetti
- **Token economics:** 5 sources × ~20 messages each = ~100 messages (manageable), 7+ risks hitting context limits

**Implementation:**

```typescript
const MAX_MERGE_PARENTS = 5
const SOFT_WARNING_AT = 3

function handleMergeConnection(sourceId: string, targetMergeNode: Conversation) {
  const currentParentCount = targetMergeNode.parentCardIds.length
  
  if (currentParentCount >= MAX_MERGE_PARENTS) {
    showToast({
      type: 'warning',
      message: `Merge node limit reached (${MAX_MERGE_PARENTS} sources). Consider creating a new merge node.`,
      action: {
        label: 'Create new merge',
        onClick: () => createNewMergeNode([sourceId])
      }
    })
    return false
  }
  
  if (currentParentCount >= SOFT_WARNING_AT) {
    showToast({
      type: 'info',
      message: `Adding source ${currentParentCount + 1}/${MAX_MERGE_PARENTS}. Complex merges may reduce AI response quality.`
    })
  }
  
  return true
}
```

**UI Degradation Pattern:**

```typescript
// Visual feedback based on parent count
function getMergeNodeStyle(parentCount: number) {
  if (parentCount <= 3) {
    return {
      border: '2px solid #10b981', // Green - healthy
      indicator: '⚡',
      message: `${parentCount} sources`
    }
  } else if (parentCount <= 5) {
    return {
      border: '2px solid #f59e0b', // Amber - warning
      indicator: '⚠️',
      message: `${parentCount} sources (complex)`
    }
  } else {
    return {
      border: '2px solid #ef4444', // Red - at limit
      indicator: '🚫',
      message: `${parentCount} sources (maximum)`
    }
  }
}
```

**Edge Bundling at 4+ parents:**

```typescript
function renderMergeEdges(mergeNode: Conversation) {
  if (mergeNode.parentCardIds.length >= 4) {
    // Bundle edges into single thick line with label
    return (
      <BundledEdge
        sources={mergeNode.parentCardIds}
        target={mergeNode.id}
        label={`${mergeNode.parentCardIds.length} sources`}
        style={{
          strokeWidth: 4,
          stroke: '#10b981'
        }}
      />
    )
  }
  
  // Render individual edges for 3 or fewer
  return mergeNode.parentCardIds.map(parentId => (
    <Edge key={parentId} source={parentId} target={mergeNode.id} />
  ))
}
```

**Alternative: Suggest hierarchical merging**

```typescript
if (currentParentCount >= 5) {
  showDialog({
    title: 'Too many sources',
    message: 'Consider creating intermediate merge nodes to organize your synthesis.',
    suggestion: `
      Instead of: [A] [B] [C] [D] [E] [F] → [Final]
      Try: [A] [B] [C] → [Group 1]
           [D] [E] [F] → [Group 2]
           [Group 1] [Group 2] → [Final]
    `
  })
}
```

---

## **2. Backwards Compatibility with Canvas View**

### **Recommendation: Yes - Canvases become "workspaces" without hierarchy**

**Why keep canvas-level organization:**
- **User preference diversity:** Some users think spatially (cards), others think in projects (canvases)
- **Scale management:** Single canvas with 100+ cards becomes overwhelming
- **Mental context switching:** Separate canvases = separate projects/initiatives
- **Low implementation cost:** Canvases already exist, just remove parent-child relationships

**New Mental Model:**

```
OLD (Canvas Hierarchy):
Canvas 1: Main Project
  ├─ Canvas 2: GraphQL Exploration (child)
  └─ Canvas 3: Database Alternative (child)

NEW (Flat Workspaces):
Workspaces (independent):
  ├─ Main Project (cards inside)
  ├─ GraphQL Exploration (cards inside)
  └─ Database Alternative (cards inside)
```

**Implementation:**

```typescript
interface Canvas {
  id: string
  title: string
  conversations: Conversation[]  // Cards with branching
  metadata: {
    createdAt: Date
    updatedAt: Date
    version: number
  }
  
  // REMOVED: parentCanvasId, branches
  // Each canvas is independent workspace
}

// User can have multiple workspaces
interface UserWorkspace {
  canvases: Canvas[]  // Flat array
  activeCanvasId: string
}
```

**UI: Workspace Switcher (not tree)**

```typescript
// components/WorkspaceSwitcher.tsx

function WorkspaceSwitcher() {
  const { canvases, activeCanvasId, switchCanvas } = useCanvasStore()
  
  return (
    <div className="workspace-switcher">
      <h3>Workspaces</h3>
      {canvases.map(canvas => (
        <button
          key={canvas.id}
          onClick={() => switchCanvas(canvas.id)}
          className={activeCanvasId === canvas.id ? 'active' : ''}
        >
          📁 {canvas.title}
          <span className="card-count">
            {canvas.conversations.length} cards
          </span>
        </button>
      ))}
      
      <button onClick={createNewWorkspace}>
        + New Workspace
      </button>
    </div>
  )
}
```

**When to use multiple workspaces vs. cards:**

| Scenario | Solution |
|----------|----------|
| Exploring REST vs GraphQL | **Card branching** (same context, alternative paths) |
| Separate client projects | **Multiple workspaces** (different contexts) |
| Different product features | **Card branching** or **workspaces** (user choice) |
| Archive old explorations | **New workspace** called "Archive" |

**Migration strategy:**

```typescript
// Convert canvas hierarchy to flat workspaces
function migrateToFlatWorkspaces(oldData: OldSchema): Canvas[] {
  const allCanvases = oldData.projectloom_canvases
  
  return allCanvases.map(canvas => ({
    id: canvas.id,
    title: canvas.metadata?.title || 'Untitled Workspace',
    conversations: flattenCanvasHierarchy(canvas),  // Merge child canvases into cards
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 2
    }
  }))
}
```

---

## **Updated Recommendations Summary**

### **Issue #1: Merge Node Parent Limit**
✅ **Hard limit: 5 parents maximum**
✅ **Soft warning: 3 parents** (UI turns amber)
✅ **Edge bundling: 4+ parents** (visual simplification)
✅ **Suggestion: Hierarchical merging** when limit reached

**Code change needed:**
```typescript
const MERGE_NODE_CONFIG = {
  MAX_PARENTS: 5,
  WARNING_THRESHOLD: 3,
  BUNDLE_THRESHOLD: 4
}
```

### **Issue #2: Canvas Organization**
✅ **Keep canvases as flat workspaces** (no hierarchy)
✅ **Workspace switcher UI** (replaces canvas tree)
✅ **User choice:** Single workspace with many cards OR multiple workspaces
✅ **Migration:** Flatten canvas hierarchy into independent workspaces

**Code change needed:**
```typescript
interface UserWorkspace {
  canvases: Canvas[]  // Flat array, no parent-child
  activeCanvasId: string
  metadata: {
    lastActiveCanvasId: string
    workspaceOrder: string[]  // User can reorder
  }
}
```

---

## **Additional Considerations**

### **When users hit 5-parent limit:**

**Option A: Suggest hierarchical merging**
```
"You're merging 5+ sources. Consider organizing them:
  Group related cards → intermediate merge → final synthesis"
```

**Option B: Allow 6th+ parent with degraded experience**
```
"Warning: 6+ sources may reduce AI quality due to token limits.
 Context will be auto-summarized."
```

**Recommendation:** Option A (teach better patterns) over Option B (allow degradation)

### **Workspace use cases:**

**Good workspace separation:**
- Different client projects
- Personal vs. work explorations
- Active projects vs. archive

**Bad workspace separation:**
- Different approaches to same problem (use card branching)
- Related features (keep on same canvas)
- Temporary experiments (use cards, delete later)

---

## **3. Storage Schema Version**

### **Recommendation: YES - Fresh start with v4, clear localStorage**

**Why this is the right move:**

✅ **No users yet** - Zero risk of data loss
✅ **Clean architecture** - No technical debt from day 1
✅ **Faster development** - Skip migration logic entirely
✅ **Testing clarity** - No legacy edge cases to handle

**Implementation:**

```typescript
// lib/storage.ts

const CURRENT_SCHEMA_VERSION = 4

export async function loadCanvas(): Promise<Canvas | null> {
  const data = localStorage.getItem('projectloom_canvases')
  
  if (!data) {
    // First-time user, return null to trigger onboarding
    return null
  }
  
  const parsed = JSON.parse(data)
  
  // Hard reset for v4 schema
  if (!parsed.projectloom_version || parsed.projectloom_version < 4) {
    console.log('🔄 ProjectLoom updated to v4 - resetting storage for new architecture')
    
    // Clear everything
    localStorage.removeItem('projectloom_canvases')
    localStorage.removeItem('projectloom_backup')
    localStorage.removeItem('projectloom_current_canvas_id')
    
    // Show one-time migration message
    showMigrationNotice()
    
    return null  // Fresh start
  }
  
  return parsed.projectloom_canvases[0]
}

function showMigrationNotice() {
  // One-time banner
  const dismissed = localStorage.getItem('projectloom_v4_notice_dismissed')
  if (dismissed) return
  
  showToast({
    type: 'info',
    duration: 10000,
    message: 'ProjectLoom has been upgraded with card-level branching! Your workspace has been reset for the new architecture.',
    action: {
      label: 'Got it',
      onClick: () => {
        localStorage.setItem('projectloom_v4_notice_dismissed', 'true')
      }
    }
  })
}
```

**Storage Schema v4:**

```typescript
// types/index.ts

const SCHEMA_VERSION = 4

interface StorageSchema {
  projectloom_version: 4  // Explicit version
  projectloom_canvases: Canvas[]  // Flat array of workspaces
  projectloom_active_canvas_id: string
  projectloom_last_updated: string  // ISO timestamp
}

interface Canvas {
  id: string
  title: string
  conversations: Conversation[]
  metadata: {
    createdAt: Date
    updatedAt: Date
    schemaVersion: 4  // Also store in canvas
  }
}

interface Conversation {
  id: string
  canvasId: string
  position: { x: number, y: number }
  messages: Message[]
  
  // Card-level branching (v4 addition)
  parentCardIds: string[]
  branchPoint?: {
    parentCardId: string
    messageIndex: number
  }
  
  // Context inheritance (v4 addition)
  inheritedContext: {
    [parentCardId: string]: InheritedContext
  }
  
  // Merge node (v4 addition)
  isMergeNode: boolean
  mergeMetadata?: {
    sourceCardIds: string[]
    synthesisPrompt?: string
    createdAt: Date
  }
  
  metadata: {
    createdAt: Date
    updatedAt: Date
    title: string
    isExpanded: boolean
  }
}
```

**Dev experience improvement:**

```typescript
// Add to package.json scripts
{
  "scripts": {
    "dev": "next dev",
    "dev:clean": "npm run storage:clear && next dev",
    "storage:clear": "node scripts/clear-storage.js"
  }
}

// scripts/clear-storage.js
console.log('🧹 Clearing localStorage for fresh start...')
// Can't access localStorage in Node, so this would be a
// browser console snippet documented in README
```

**README documentation:**

```markdown
## Development Reset

If you need to reset storage during development:

**Browser Console:**
```javascript
localStorage.clear()
location.reload()
```

**Or use the UI:**
Settings → Advanced → Clear All Data
```

---

## **4. BranchDialog.tsx Deprecation**

### **Recommendation: Hybrid approach - Inline for mouse, Dialog for keyboard**

**Why both patterns:**

✅ **Mouse users (80%)**: Inline panel feels immediate, low-friction
✅ **Keyboard users (20%)**: Dialog gives focus, discoverability via shortcuts
✅ **Accessibility**: Dialog pattern is more screen-reader friendly
✅ **Power users**: Keyboard shortcuts enable flow state

**Implementation:**

```typescript
// components/ConversationCard.tsx

function ConversationCard({ data, isExpanded }: Props) {
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null)
  const [showInlinePanel, setShowInlinePanel] = useState(false)
  const [pendingBranch, setPendingBranch] = useState<{
    messageIndex: number
    cardId: string
  } | null>(null)
  
  // Mouse interaction - inline panel
  const handleBranchClick = (messageIndex: number) => {
    setPendingBranch({ messageIndex, cardId: data.id })
    setShowInlinePanel(true)
  }
  
  // Keyboard shortcut - dialog
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd + B to branch from current message
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        
        // Find currently focused/selected message index
        const selectedIndex = getSelectedMessageIndex()
        
        // Open dialog for keyboard-driven branching
        openBranchDialog({
          parentCardId: data.id,
          messageIndex: selectedIndex
        })
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [data.id])
  
  return (
    <div className="conversation-card">
      {isExpanded && data.messages.map((message, index) => (
        <div
          key={message.id}
          className="message"
          onMouseEnter={() => setHoveredMessageIndex(index)}
          onMouseLeave={() => setHoveredMessageIndex(null)}
        >
          <div className="message-content">{message.content}</div>
          
          {/* Mouse: Branch icon */}
          {hoveredMessageIndex === index && (
            <button
              className="branch-button"
              onClick={() => handleBranchClick(index)}
              title="Branch from here (or Ctrl+B)"
            >
              <GitBranch className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      
      {/* Mouse: Inline panel */}
      {showInlinePanel && pendingBranch && (
        <InlineContextPanel
          parentCardId={pendingBranch.cardId}
          messageIndex={pendingBranch.messageIndex}
          onClose={() => setShowInlinePanel(false)}
          onComplete={() => setShowInlinePanel(false)}
        />
      )}
    </div>
  )
}
```

**InlineContextPanel (Mouse workflow):**

```typescript
// components/InlineContextPanel.tsx

function InlineContextPanel({ 
  parentCardId, 
  messageIndex, 
  onClose, 
  onComplete 
}: Props) {
  const { branchFromMessage } = useCanvasStore()
  const [mode, setMode] = useState<'full' | 'summary' | 'custom'>('full')
  
  const handleApply = async () => {
    await branchFromMessage({
      parentCardId,
      messageIndex,
      inheritanceMode: mode
    })
    onComplete()
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-context-panel"
    >
      <div className="panel-header">
        <Paperclip className="w-4 h-4" />
        <span>Branch from message {messageIndex + 1}</span>
        <button onClick={onClose}>×</button>
      </div>
      
      <div className="panel-content">
        <label>
          <input
            type="radio"
            checked={mode === 'full'}
            onChange={() => setMode('full')}
          />
          <span>Full Context (12 messages)</span>
        </label>
        
        <label>
          <input
            type="radio"
            checked={mode === 'summary'}
            onChange={() => setMode('summary')}
          />
          <span>Smart Summary (AI-generated)</span>
        </label>
        
        <label>
          <input
            type="radio"
            checked={mode === 'custom'}
            onChange={() => setMode('custom')}
          />
          <span>Custom Selection</span>
        </label>
      </div>
      
      <div className="panel-actions">
        <button onClick={handleApply} className="primary">
          Create Branch
        </button>
        <button onClick={onClose} className="secondary">
          Cancel
        </button>
      </div>
    </motion.div>
  )
}
```

**BranchDialog (Keyboard workflow):**

```typescript
// components/BranchDialog.tsx

function BranchDialog({ 
  parentCardId, 
  messageIndex, 
  isOpen, 
  onClose 
}: Props) {
  const { branchFromMessage } = useCanvasStore()
  const [mode, setMode] = useState<'full' | 'summary' | 'custom'>('full')
  const [reason, setReason] = useState('')  // Additional field for keyboard users
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    await branchFromMessage({
      parentCardId,
      messageIndex,
      inheritanceMode: mode,
      branchReason: reason  // Store reason for keyboard-created branches
    })
    
    onClose()
  }
  
  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && e.metaKey) handleSubmit(e as any)
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])
  
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Branch Conversation</DialogTitle>
      
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <label>Branching from message {messageIndex + 1}</label>
          
          <RadioGroup value={mode} onChange={setMode}>
            <Radio value="full">Full Context (12 messages)</Radio>
            <Radio value="summary">Smart Summary</Radio>
            <Radio value="custom">Custom Selection</Radio>
          </RadioGroup>
        </div>
        
        <div className="form-section">
          <label>Branch Reason (optional)</label>
          <input
            type="text"
            placeholder="e.g., Exploring GraphQL alternative"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus  // Focus for keyboard users
          />
        </div>
        
        <div className="form-actions">
          <button type="submit" className="primary">
            Create Branch (⌘+Enter)
          </button>
          <button type="button" onClick={onClose} className="secondary">
            Cancel (Esc)
          </button>
        </div>
      </form>
    </Dialog>
  )
}
```

**Keyboard shortcuts documentation:**

```typescript
// components/KeyboardShortcutsHelp.tsx

const SHORTCUTS = [
  {
    category: 'Branching',
    shortcuts: [
      { keys: ['Ctrl/Cmd', 'B'], action: 'Branch from selected message' },
      { keys: ['Ctrl/Cmd', 'Enter'], action: 'Confirm branch (in dialog)' },
      { keys: ['Esc'], action: 'Cancel branch' }
    ]
  },
  {
    category: 'Navigation',
    shortcuts: [
      { keys: ['Tab'], action: 'Next card' },
      { keys: ['Shift', 'Tab'], action: 'Previous card' },
      { keys: ['Space'], action: 'Expand/collapse card' }
    ]
  },
  {
    category: 'Canvas',
    shortcuts: [
      { keys: ['Ctrl/Cmd', 'Z'], action: 'Undo' },
      { keys: ['Ctrl/Cmd', 'Shift', 'Z'], action: 'Redo' },
      { keys: ['Delete'], action: 'Delete selected card' }
    ]
  }
]

function KeyboardShortcutsHelp() {
  return (
    <Dialog trigger={<button>⌘ Shortcuts</button>}>
      <DialogTitle>Keyboard Shortcuts</DialogTitle>
      
      {SHORTCUTS.map(category => (
        <div key={category.category}>
          <h3>{category.category}</h3>
          {category.shortcuts.map(shortcut => (
            <div key={shortcut.action} className="shortcut-row">
              <div className="keys">
                {shortcut.keys.map(key => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </div>
              <span>{shortcut.action}</span>
            </div>
          ))}
        </div>
      ))}
    </Dialog>
  )
}
```

---

## **Decision Summary**

### **1. Storage Schema: v4 Fresh Start** ✅

**Changes:**
- Bump schema version to `4`
- Clear localStorage on first load if version < 4
- Show one-time migration notice
- Document dev reset in README

**Code:**
```typescript
const CURRENT_SCHEMA_VERSION = 4

if (parsed.projectloom_version < 4) {
  localStorage.clear()
  showMigrationNotice()
  return null
}
```

### **2. BranchDialog: Hybrid Approach** ✅

**Mouse users (primary):**
- Hover message → branch icon appears
- Click icon → inline panel shows
- Select context mode → instant branch

**Keyboard users (power users):**
- Select message → Ctrl/Cmd+B
- Dialog opens with focus
- Add optional branch reason
- Cmd+Enter to confirm

**Benefits:**
- 🎯 Best UX for each interaction mode
- ⌨️ Power user efficiency
- ♿ Better accessibility
- 📚 Discoverability through shortcuts help

---

## **5. Mock Data Update for v4 Schema**

### **Recommendation: YES - Create realistic v4 mock data with branching narrative**

**Why this matters:**
✅ **Testing completeness** - Validates all new features (branch, merge, inheritance)
✅ **Visual development** - See actual branching patterns while building UI
✅ **Demo quality** - Shows real value prop to users immediately
✅ **Edge case coverage** - Tests multi-parent, context inheritance, etc.

**Implementation:**

```typescript
// lib/mock-data-v4.ts

import { nanoid } from 'nanoid'
import type { Canvas, Conversation, Message } from '@/types'

/**
 * Mock data story: Building a REST API, exploring GraphQL alternative,
 * then merging insights into final implementation plan
 */
export const MOCK_CANVAS_V4: Canvas = {
  id: 'canvas-main',
  title: 'API Design Project',
  conversations: [
    // ROOT CARD 1: Initial planning conversation
    {
      id: 'card-1',
      canvasId: 'canvas-main',
      position: { x: 100, y: 100 },
      messages: [
        {
          id: nanoid(),
          role: 'user',
          content: 'I need to design an API for a task management app. Should I use REST or GraphQL?',
          timestamp: new Date('2026-02-01T10:00:00Z'),
        },
        {
          id: nanoid(),
          role: 'assistant',
          content: 'Great question! Both have merits. REST is simpler and more widely understood, while GraphQL offers more flexibility. Let me help you explore both options. What are your main requirements?',
          timestamp: new Date('2026-02-01T10:01:00Z'),
        },
        {
          id: nanoid(),
          role: 'user',
          content: 'We need to support mobile and web clients, real-time updates for task changes, and the ability to fetch related data efficiently.',
          timestamp: new Date('2026-02-01T10:05:00Z'),
        },
        {
          id: nanoid(),
          role: 'assistant',
          content: 'Those requirements suggest GraphQL might be beneficial due to its flexible querying and real-time subscriptions. However, REST with WebSockets could work too. Let\'s explore the REST approach first.',
          timestamp: new Date('2026-02-01T10:07:00Z'),
        },
      ],
      parentCardIds: [],
      inheritedContext: {},
      isMergeNode: false,
      metadata: {
        createdAt: new Date('2026-02-01T10:00:00Z'),
        updatedAt: new Date('2026-02-01T10:07:00Z'),
        title: 'API Design Discussion',
        isExpanded: false,
      },
    },

    // BRANCHED CARD: REST approach (branched from card-1 at message 3)
    {
      id: 'card-2',
      canvasId: 'canvas-main',
      position: { x: 450, y: 100 },
      messages: [
        {
          id: nanoid(),
          role: 'user',
          content: 'Let\'s design the REST endpoints. What would the structure look like?',
          timestamp: new Date('2026-02-01T10:10:00Z'),
        },
        {
          id: nanoid(),
          role: 'assistant',
          content: 'Here\'s a RESTful design:\n\nGET /api/tasks - List all tasks\nGET /api/tasks/:id - Get task details\nPOST /api/tasks - Create task\nPUT /api/tasks/:id - Update task\nDELETE /api/tasks/:id - Delete task\n\nFor related data:\nGET /api/tasks/:id/comments - Get task comments\nGET /api/tasks/:id/assignees - Get assignees',
          timestamp: new Date('2026-02-01T10:12:00Z'),
        },
        {
          id: nanoid(),
          role: 'user',
          content: 'How would we handle real-time updates with REST?',
          timestamp: new Date('2026-02-01T10:15:00Z'),
        },
        {
          id: nanoid(),
          role: 'assistant',
          content: 'For real-time with REST, you\'d use WebSockets alongside your REST API. When a task changes, broadcast events to connected clients. Clients subscribe to specific task IDs or project channels.',
          timestamp: new Date('2026-02-01T10:17:00Z'),
        },
      ],
      parentCardIds: ['card-1'],
      branchPoint: {
        parentCardId: 'card-1',
        messageIndex: 3, // Branched from 4th message (0-indexed)
      },
      inheritedContext: {
        'card-1': {
          mode: 'full',
          messages: [
            // First 4 messages from card-1 inherited
            {
              id: nanoid(),
              role: 'user',
              content: 'I need to design an API for a task management app. Should I use REST or GraphQL?',
              timestamp: new Date('2026-02-01T10:00:00Z'),
            },
            {
              id: nanoid(),
              role: 'assistant',
              content: 'Great question! Both have merits. REST is simpler and more widely understood, while GraphQL offers more flexibility. Let me help you explore both options. What are your main requirements?',
              timestamp: new Date('2026-02-01T10:01:00Z'),
            },
            {
              id: nanoid(),
              role: 'user',
              content: 'We need to support mobile and web clients, real-time updates for task changes, and the ability to fetch related data efficiently.',
              timestamp: new Date('2026-02-01T10:05:00Z'),
            },
            {
              id: nanoid(),
              role: 'assistant',
              content: 'Those requirements suggest GraphQL might be beneficial due to its flexible querying and real-time subscriptions. However, REST with WebSockets could work too. Let\'s explore the REST approach first.',
              timestamp: new Date('2026-02-01T10:07:00Z'),
            },
          ],
          timestamp: new Date('2026-02-01T10:10:00Z'),
          totalParentMessages: 4,
        },
      },
      isMergeNode: false,
      metadata: {
        createdAt: new Date('2026-02-01T10:10:00Z'),
        updatedAt: new Date('2026-02-01T10:17:00Z'),
        title: 'REST API Design',
        isExpanded: false,
      },
    },

    // BRANCHED CARD: GraphQL alternative (also branched from card-1 at message 3)
    {
      id: 'card-3',
      canvasId: 'canvas-main',
      position: { x: 450, y: 350 },
      messages: [
        {
          id: nanoid(),
          role: 'user',
          content: 'Actually, let me explore the GraphQL approach instead. What would the schema look like?',
          timestamp: new Date('2026-02-01T11:00:00Z'),
        },
        {
          id: nanoid(),
          role: 'assistant',
          content: 'Here\'s a GraphQL schema:\n\ntype Task {\n  id: ID!\n  title: String!\n  description: String\n  status: TaskStatus!\n  assignees: [User!]!\n  comments: [Comment!]!\n  createdAt: DateTime!\n}\n\ntype Query {\n  tasks(projectId: ID!): [Task!]!\n  task(id: ID!): Task\n}\n\ntype Mutation {\n  createTask(input: CreateTaskInput!): Task!\n  updateTask(id: ID!, input: UpdateTaskInput!): Task!\n}\n\ntype Subscription {\n  taskUpdated(projectId: ID!): Task!\n}',
          timestamp: new Date('2026-02-01T11:03:00Z'),
        },
        {
          id: nanoid(),
          role: 'user',
          content: 'How does this handle the real-time requirement better than REST?',
          timestamp: new Date('2026-02-01T11:05:00Z'),
        },
        {
          id: nanoid(),
          role: 'assistant',
          content: 'GraphQL subscriptions are built-in! Clients subscribe to taskUpdated and receive real-time updates automatically. No separate WebSocket infrastructure needed - it\'s part of the GraphQL spec.',
          timestamp: new Date('2026-02-01T11:07:00Z'),
        },
      ],
      parentCardIds: ['card-1'],
      branchPoint: {
        parentCardId: 'card-1',
        messageIndex: 3, // Same branch point as card-2
      },
      inheritedContext: {
        'card-1': {
          mode: 'summary',
          messages: [], // Summary mode doesn't include full messages
          summary: 'Discussion about API design for a task management app. Requirements: support mobile/web clients, real-time updates, and efficient related data fetching. Exploring both REST and GraphQL approaches.',
          timestamp: new Date('2026-02-01T11:00:00Z'),
          totalParentMessages: 4,
        },
      },
      isMergeNode: false,
      metadata: {
        createdAt: new Date('2026-02-01T11:00:00Z'),
        updatedAt: new Date('2026-02-01T11:07:00Z'),
        title: 'GraphQL Alternative',
        isExpanded: false,
      },
    },

    // ROOT CARD 2: Database discussion (unrelated to branching)
    {
      id: 'card-4',
      canvasId: 'canvas-main',
      position: { x: 100, y: 350 },
      messages: [
        {
          id: nanoid(),
          role: 'user',
          content: 'For the database, should we use PostgreSQL or MongoDB?',
          timestamp: new Date('2026-02-01T14:00:00Z'),
        },
        {
          id: nanoid(),
          role: 'assistant',
          content: 'PostgreSQL would be a solid choice for a task management app. It provides ACID guarantees, great support for relationships between tasks/users/projects, and excellent query performance. MongoDB could work but tasks naturally have relationships that fit relational models well.',
          timestamp: new Date('2026-02-01T14:02:00Z'),
        },
        {
          id: nanoid(),
          role: 'user',
          content: 'What about for GraphQL specifically?',
          timestamp: new Date('2026-02-01T14:05:00Z'),
        },
        {
          id: nanoid(),
          role: 'assistant',
          content: 'PostgreSQL works great with GraphQL! Libraries like PostGraphile can auto-generate GraphQL schemas from your Postgres database. You get the best of both worlds: relational integrity and flexible GraphQL queries.',
          timestamp: new Date('2026-02-01T14:07:00Z'),
        },
      ],
      parentCardIds: [],
      inheritedContext: {},
      isMergeNode: false,
      metadata: {
        createdAt: new Date('2026-02-01T14:00:00Z'),
        updatedAt: new Date('2026-02-01T14:07:00Z'),
        title: 'Database Choice',
        isExpanded: false,
      },
    },

    // MERGE NODE: Final implementation plan (merges card-2, card-3, card-4)
    {
      id: 'card-5',
      canvasId: 'canvas-main',
      position: { x: 800, y: 225 },
      messages: [
        {
          id: nanoid(),
          role: 'user',
          content: 'Based on all our discussions, create a final implementation plan combining the best approaches.',
          timestamp: new Date('2026-02-01T15:00:00Z'),
        },
        {
          id: nanoid(),
          role: 'assistant',
          content: 'Final Implementation Plan:\n\n**Architecture:** GraphQL API with PostgreSQL\n\n**Why GraphQL:**\n- Built-in subscriptions for real-time updates\n- Flexible querying reduces over-fetching\n- Strong typing with schema\n\n**Why PostgreSQL:**\n- ACID guarantees for data integrity\n- Excellent relationship modeling\n- PostGraphile for auto-generated schema\n\n**Tech Stack:**\n- Backend: Node.js + Apollo Server\n- Database: PostgreSQL 14+\n- ORM: Prisma (works great with GraphQL)\n- Real-time: GraphQL subscriptions over WebSockets\n\n**API Structure:**\n- GraphQL schema with Task, User, Project types\n- Queries for fetching data\n- Mutations for modifications\n- Subscriptions for real-time updates\n\n**Next Steps:**\n1. Set up PostgreSQL database\n2. Define Prisma schema\n3. Generate GraphQL types\n4. Implement resolvers\n5. Add subscription handlers',
          timestamp: new Date('2026-02-01T15:05:00Z'),
        },
      ],
      parentCardIds: ['card-2', 'card-3', 'card-4'], // Merge from 3 sources
      inheritedContext: {
        'card-2': {
          mode: 'full',
          messages: [
            // Abbreviated for mock data - would include all messages from card-2
            {
              id: nanoid(),
              role: 'user',
              content: 'Let\'s design the REST endpoints. What would the structure look like?',
              timestamp: new Date('2026-02-01T10:10:00Z'),
            },
          ],
          timestamp: new Date('2026-02-01T15:00:00Z'),
          totalParentMessages: 4,
        },
        'card-3': {
          mode: 'full',
          messages: [
            {
              id: nanoid(),
              role: 'user',
              content: 'Actually, let me explore the GraphQL approach instead. What would the schema look like?',
              timestamp: new Date('2026-02-01T11:00:00Z'),
            },
          ],
          timestamp: new Date('2026-02-01T15:00:00Z'),
          totalParentMessages: 4,
        },
        'card-4': {
          mode: 'summary',
          messages: [],
          summary: 'Database discussion comparing PostgreSQL and MongoDB. Decided on PostgreSQL for ACID guarantees, relationship support, and GraphQL compatibility via PostGraphile.',
          timestamp: new Date('2026-02-01T15:00:00Z'),
          totalParentMessages: 4,
        },
      },
      isMergeNode: true,
      mergeMetadata: {
        sourceCardIds: ['card-2', 'card-3', 'card-4'],
        synthesisPrompt: 'Based on all our discussions, create a final implementation plan combining the best approaches.',
        createdAt: new Date('2026-02-01T15:00:00Z'),
      },
      metadata: {
        createdAt: new Date('2026-02-01T15:00:00Z'),
        updatedAt: new Date('2026-02-01T15:05:00Z'),
        title: 'Final Implementation Plan',
        isExpanded: true, // Expanded to show the synthesis
      },
    },
  ],
  metadata: {
    createdAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T15:05:00Z'),
    schemaVersion: 4,
  },
}

/**
 * Helper to generate empty canvas for new users
 */
export function createEmptyCanvas(): Canvas {
  return {
    id: nanoid(),
    title: 'My Project',
    conversations: [],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: 4,
    },
  }
}

/**
 * Load mock data or create empty canvas
 */
export function loadInitialCanvas(): Canvas {
  const shouldUseMockData = process.env.NODE_ENV === 'development'
  
  if (shouldUseMockData) {
    console.log('📦 Loading v4 mock data with branching examples')
    return MOCK_CANVAS_V4
  }
  
  return createEmptyCanvas()
}
```

**Visual layout of mock data:**

```
Canvas: "API Design Project"

[Card 1: API Design Discussion]
         ↓ (branches)
    ┌────┴────┐
    ↓         ↓
[Card 2]  [Card 3]        [Card 4]
REST      GraphQL         Database
Design    Alternative     Choice
    \         |           /
     \        |          /
      \       |         /
       ↓      ↓        ↓
    [Card 5: Final Plan] ⚡
       (Merge Node)
```

**Update store to use v4 mock data:**

```typescript
// stores/canvas-store.ts

import { loadInitialCanvas, MOCK_CANVAS_V4 } from '@/lib/mock-data-v4'

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  canvas: loadInitialCanvas(), // Uses mock data in dev
  
  // ... rest of store
}))
```

---

## **6. Breadcrumb Component Simplification**

### **Recommendation: Simplify to workspace name only**

**Why remove hierarchy breadcrumbs:**
✅ **No canvas hierarchy** - We removed parent-child canvas relationships
✅ **Reduced clutter** - Single workspace = no navigation needed
✅ **Clearer UI** - "Workspace: API Design Project" is self-explanatory
✅ **Space efficiency** - More room for canvas controls

**Old breadcrumb (canvas hierarchy):**
```
Main Project > GraphQL Exploration > Database Alternative
```

**New breadcrumb (workspace name):**
```
📁 API Design Project
```

**Implementation:**

```typescript
// components/WorkspaceHeader.tsx

function WorkspaceHeader() {
  const { canvas, canvases, switchCanvas } = useCanvasStore()
  const [isWorkspaceSwitcherOpen, setIsWorkspaceSwitcherOpen] = useState(false)
  
  if (!canvas) return null
  
  return (
    <div className="workspace-header">
      {/* Workspace name with dropdown (if multiple workspaces) */}
      <div className="workspace-name">
        <button
          onClick={() => setIsWorkspaceSwitcherOpen(!isWorkspaceSwitcherOpen)}
          className="workspace-button"
          disabled={canvases.length <= 1}
        >
          <FolderOpen className="w-4 h-4" />
          <span>{canvas.title}</span>
          {canvases.length > 1 && (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        
        {/* Workspace switcher dropdown */}
        {isWorkspaceSwitcherOpen && canvases.length > 1 && (
          <WorkspaceSwitcherDropdown
            canvases={canvases}
            activeCanvasId={canvas.id}
            onSwitch={(canvasId) => {
              switchCanvas(canvasId)
              setIsWorkspaceSwitcherOpen(false)
            }}
            onClose={() => setIsWorkspaceSwitcherOpen(false)}
          />
        )}
      </div>
      
      {/* Canvas stats */}
      <div className="canvas-stats">
        <span className="stat">
          {canvas.conversations.length} cards
        </span>
        <span className="stat">
          {canvas.conversations.filter(c => c.isMergeNode).length} merges
        </span>
      </div>
      
      {/* Actions */}
      <div className="header-actions">
        <button
          onClick={handleExport}
          className="action-button"
          title="Export workspace"
        >
          <Download className="w-4 h-4" />
        </button>
        
        <button
          onClick={handleSettings}
          className="action-button"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
```

**Workspace switcher dropdown:**

```typescript
// components/WorkspaceSwitcherDropdown.tsx

function WorkspaceSwitcherDropdown({ 
  canvases, 
  activeCanvasId, 
  onSwitch, 
  onClose 
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="workspace-switcher-dropdown"
    >
      <div className="dropdown-header">
        <span>Switch Workspace</span>
        <button onClick={onClose}>×</button>
      </div>
      
      <div className="workspace-list">
        {canvases.map(canvas => (
          <button
            key={canvas.id}
            onClick={() => onSwitch(canvas.id)}
            className={activeCanvasId === canvas.id ? 'active' : ''}
          >
            <FolderOpen className="w-4 h-4" />
            <div className="workspace-info">
              <span className="workspace-title">{canvas.title}</span>
              <span className="workspace-meta">
                {canvas.conversations.length} cards
              </span>
            </div>
            {activeCanvasId === canvas.id && (
              <Check className="w-4 h-4 text-green-400" />
            )}
          </button>
        ))}
      </div>
      
      <div className="dropdown-footer">
        <button
          onClick={handleCreateWorkspace}
          className="create-workspace-button"
        >
          <Plus className="w-4 h-4" />
          <span>New Workspace</span>
        </button>
      </div>
    </motion.div>
  )
}
```

**Visual comparison:**

**Old (hierarchical breadcrumbs):**
```
┌────────────────────────────────────────────────┐
│ Main Project > GraphQL > Database Alternative  │
│ [Takes up lots of space, implies navigation]   │
└────────────────────────────────────────────────┘
```

**New (workspace name only):**
```
┌────────────────────────────────────────────────┐
│ 📁 API Design Project ▼  |  5 cards  2 merges │
│ [Clean, shows context, no fake navigation]     │
└────────────────────────────────────────────────┘
```

**Remove old breadcrumb component:**

```typescript
// components/Breadcrumb.tsx - DELETE THIS FILE

// Or if keeping for other purposes, update to:
function Breadcrumb({ items }: Props) {
  console.warn('Breadcrumb component deprecated - use WorkspaceHeader instead')
  return null
}
```

---

## **Implementation Checklist**

**Mock Data v4:**
- [ ] Create `lib/mock-data-v4.ts`
- [ ] Define `MOCK_CANVAS_V4` with 5-card narrative
- [ ] Add `createEmptyCanvas()` helper
- [ ] Add `loadInitialCanvas()` helper
- [ ] Update store to use new mock data
- [ ] Test all inheritance modes (full, summary, custom)
- [ ] Verify merge node has 3 parents

**Workspace Header:**
- [ ] Create `WorkspaceHeader.tsx`
- [ ] Add workspace name display
- [ ] Add workspace switcher dropdown
- [ ] Add canvas stats (cards, merges)
- [ ] Add quick actions (export, settings)
- [ ] Remove/deprecate old `Breadcrumb.tsx`
- [ ] Update layout to use new header

---

## **Visual Mock Data Flow**

When user opens app in development:

```
1. Load mock data
2. Show canvas: "API Design Project"
3. Render 5 cards:
   - [API Design Discussion] (root, collapsed)
   - [REST API Design] (branched, amber edge)
   - [GraphQL Alternative] (branched, amber edge)
   - [Database Choice] (root, collapsed)
   - [Final Implementation Plan] ⚡ (merge, 3 green edges, expanded)
4. User can:
   - Click cards to expand/see messages
   - Hover edges to see inheritance info
   - Click merge node to see 3 parent sources
   - Test branching by adding new cards
```
