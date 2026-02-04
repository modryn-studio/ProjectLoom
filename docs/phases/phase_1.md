# Phase 1 (Week 1-2)

**Success Criteria: "This canvas feels amazing to organize thoughts on"**

## 1. Context Inheritance Architecture

**Status: Design now, implement in Phase 2**

### Data Structure - Forward Compatible

```typescript
// Simple data structure - forward compatible
interface Canvas {
  id: string
  title: string
  conversations: Conversation[]
  position: { x: number, y: number }
  
  // Placeholder for Phase 2
  parentCanvasId?: string | null
  createdAt: Date
}

interface Conversation {
  id: string
  messages: Message[]
  position: { x: number, y: number }
}
```

### Rationale

- Phase 1 is about validating spatial organization feels good
- No branching yet = no inheritance needed
- Keep Phase 1 scope tight

---

## 2. AI Provider Implementation

**Status: Mock data only**

### Mock Conversation Generator

```typescript
// Mock conversation generator
const mockConversations = [
  {
    id: '1',
    messages: [
      { role: 'user', content: 'Help me build a recipe app' },
      { role: 'assistant', content: 'Here's a plan...' }
    ]
  },
  // ... 5-10 realistic examples
]

// Simple interface - ready for Phase 2
interface AIProvider {
  sendMessage: (content: string) => Promise<Message>
}

class MockProvider implements AIProvider {
  async sendMessage(content: string) {
    return { role: 'assistant', content: 'Mock response' }
  }
}
```

### Rationale

- Validates canvas UX without API complexity
- Faster iteration on spatial organization
- No rate limits, no auth, no cost during dev
- Can use real conversation examples from our own Claude usage

### Action Item

Build mock data generator that creates realistic multi-turn conversations for testing.

---

## 3. Visual Polish Priority

**Status: Core interactions only**

### Phase 1 Focus - Essential for Usability

```css
✅ Smooth drag (Framer Motion)
✅ Node hover lift effect
✅ Connection bezier curves
✅ Basic glow on active node
✅ Pan/zoom with easing
✅ Color system implementation

❌ Particle trails (Phase 2)
❌ Depth of field blur (Phase 2)
❌ Animated context flow (Phase 2)
❌ Branch split animation (Phase 2)
```

### Code Example - Simple but Polished

```typescript
// Phase 1 - Simple but polished
<motion.div
  whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(102, 126, 234, 0.3)' }}
  whileDrag={{ scale: 1.05 }}
  transition={{ type: 'spring', stiffness: 300 }}
>
  {/* Conversation card */}
</motion.div>
```

### Rationale

- Phase 1: Prove the canvas feels good to use
- Advanced effects are expensive to get right - only worth it if Phase 1 works

### Action Item

Create `design-tokens.ts` in Phase 1 with full color system, spacing, and animation curves - even if we don't use all effects yet.

---

---

## 4. Edge Styling

**Status: Simple curves**

### Implementation - Clean Bezier Curves

```typescript
// Simple, clean Bezier curves
<Edge
  id={edgeId}
  source={sourceId}
  target={targetId}
  style={{
    stroke: '#667eea',
    strokeWidth: 2,
    opacity: 0.6
  }}
  type="smoothstep" // or "bezier"
/>
```

### Rationale

- Phase 1 has no branching = no parent/child relationships
- Connections show "these conversations are related"
- Direction doesn't matter yet
- Cleaner visual aesthetic

### Action Item

Use XYFlow's edge customization API but keep it simple in Phase 1.

---

## 5. Card Interaction Modes

**Status: Inline expansion with spatial context**

### Implementation

```typescript
// Conversation card states
interface CardState {
  collapsed: { width: 300, height: 120 }
  expanded: { width: 600, height: 400 }
  fullscreen: { width: '80vw', height: '80vh' }
}

// Phase 1 interaction
<motion.div
  layout // Framer Motion auto-animates size changes
  animate={isExpanded ? 'expanded' : 'collapsed'}
  variants={cardState}
  onClick={() => setExpanded(!isExpanded)}
>
  {/* Collapsed: Show first message + summary */}
  {!isExpanded && <ConversationPreview />}
  
  {/* Expanded: Show full conversation inline */}
  {isExpanded && <ConversationThread />}
</motion.div>
```

### Why Inline Over Modal/Sidebar

1. **Maintains spatial context** - You still see where this conversation sits in your project
2. **Better for comparison** - Can expand multiple cards to compare side-by-side
3. **Feels more canvas-native** - Like Figma frames expanding, not breaking focus
4. **No context switching** - Modal would pull you out of spatial thinking

### UX Flow

```
Click card → Expands in place (animated)
  → Other cards shift to make room
  → Click outside or ESC → Collapses back
  → Double-click → Full-screen overlay (Phase 2)
```

### Visual States

```
Collapsed (300x120):
┌─────────────────┐
│ 💬 Recipe App   │
│ "Help me build.."│
│ 3 messages      │
└─────────────────┘

Expanded (600x400):
┌─────────────────────────────┐
│ 💬 Recipe App               │
│ ─────────────────────────── │
│ User: Help me build...      │
│ Claude: Here's a plan...    │
│ User: What about auth?      │
│ Claude: For auth...         │
│ ─────────────────────────── │
│ [Branch] [Edit] [Delete]    │
└─────────────────────────────┘
```

### Action Item

Use Framer Motion's `layout` prop for automatic position/size animations.

---

## 6. Mock Data Realism

**Status: Realistic, diverse content from day 1**

### Mock Conversation Dataset

```typescript
const mockConversations: Conversation[] = [
  {
    id: '1',
    title: 'Recipe App Planning',
    messages: [
      {
        role: 'user',
        content: 'Help me build a recipe app with Next.js'
      },
      {
        role: 'assistant',
        content: `Here's a plan:

## Tech Stack
- **Frontend**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL)
- **Auth**: NextAuth.js

\`\`\`typescript
// Example schema
interface Recipe {
  id: string
  title: string
  ingredients: Ingredient[]
}
\`\`\`

Would you like me to scaffold the project?`
      }
    ]
  },
  {
    id: '2',
    title: 'Python Data Analysis',
    messages: [
      {
        role: 'user',
        content: 'How do I clean this messy CSV file?'
      },
      {
        role: 'assistant',
        content: `Here's a pandas approach:

\`\`\`python
import pandas as pd

# Read with error handling
df = pd.read_csv('data.csv', encoding='utf-8-sig')

# Clean columns
df.columns = df.columns.str.strip().str.lower()

# Handle missing values
df.fillna({'price': 0, 'name': 'Unknown'}, inplace=True)
\`\`\`

This handles common CSV issues like BOM characters and whitespace.`
      }
    ]
  },
  {
    id: '3',
    title: '日本語会話', // Japanese conversation
    messages: [
      {
        role: 'user',
        content: '東京でおすすめのレストランは？'
      },
      {
        role: 'assistant',
        content: '東京には素晴らしいレストランがたくさんあります：\n\n1. 🍣 すきやばし次郎\n2. 🍜 一蘭ラーメン\n3. 🥩 銀座うかい亭'
      }
    ]
  }
]
```

### Why Include This Diversity

1. **Code rendering** - Validates syntax highlighting works
2. **Markdown** - Tests headers, lists, formatting
3. **Multi-language** - Catches UTF-8/font issues early
4. **Emojis** - Common in real conversations
5. **Long content** - Tests truncation and scrolling
6. **Real use cases** - Makes demos feel authentic

### Edge Cases to Include

```typescript
// Long message that needs truncation
const longMessage = {
  role: 'assistant',
  content: 'a'.repeat(5000) // Test scroll behavior
}

// Empty message (edge case)
const emptyMessage = {
  role: 'user',
  content: ''
}

// Special characters
const specialChars = {
  role: 'assistant',
  content: 'Test: <script>alert("xss")</script> `code` **bold**'
}

// Math/LaTeX (if supporting)
const mathMessage = {
  role: 'assistant',
  content: 'The quadratic formula: $x = \\frac{-b ± \\sqrt{b^2-4ac}}{2a}$'
}
```

### Rendering Implementation

```typescript
// Use a markdown renderer that handles:
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'

<ReactMarkdown
  components={{
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      return !inline && match ? (
        <SyntaxHighlighter
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }
  }}
>
  {message.content}
</ReactMarkdown>
```

### Action Item

Create `mock-data.ts` with 10-15 diverse conversations covering:
- Code (TypeScript, Python, Rust, SQL)
- Different languages (English, Japanese, Spanish, Arabic - tests RTL)
- Markdown formatting
- Different conversation lengths (1 message, 5 messages, 20+ messages)
- Real project types (web app, data science, creative writing, debugging)

### Key Insight

Realistic mock data in Phase 1 = fewer surprises when we add real AI in Phase 2.

---

## 7. Card Expansion Behavior

**Status: Manual control, no auto-repositioning**

### Implementation - Overlays Allowed

```typescript
// Expanded cards can overlap - user maintains control
<motion.div
  layout
  animate={isExpanded ? 'expanded' : 'collapsed'}
  variants={{
    collapsed: { width: 300, height: 120, zIndex: 1 },
    expanded: { width: 600, height: 400, zIndex: 10 } // Bring to front
  }}
  style={{
    position: 'absolute',
    left: position.x,
    top: position.y
  }}
>
  {/* Card content */}
</motion.div>
```

### Why No Auto-Reposition

1. **Preserves user intent** - You placed cards spatially for a reason
2. **Avoids cascade chaos** - Moving one card shouldn't trigger chain reactions
3. **Predictable behavior** - What you see is what you get
4. **Figma model** - Overlapping is fine, layers handle visibility

### UX Patterns

```
Collapsed cards: z-index: 1
Expanded cards: z-index: 10
Dragging card: z-index: 100

User can:
- Drag expanded cards around manually
- Click outside to collapse and regain space
- Use keyboard (ESC) to collapse all
```

---

## 8. RTL Text Rendering

**Status: Language detection + font mapping for quality UX**

### Implementation - Auto-Detection

```typescript
// Language detection helper
import { franc } from 'franc-min' // Lightweight language detector

function detectLanguage(text: string): string {
  const langCode = franc(text, { minLength: 3 })
  return langCode !== 'und' ? langCode : 'eng'
}

// Font stack mapping
const fontFamilies: Record<string, string> = {
  // English, European
  eng: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  
  // Arabic
  ara: `'Noto Sans Arabic', 'Amiri', 'Tajawal', sans-serif`,
  arb: `'Noto Sans Arabic', 'Amiri', 'Tajawal', sans-serif`,
  
  // Hebrew
  heb: `'Noto Sans Hebrew', 'Alef', 'Heebo', sans-serif`,
  
  // Chinese (Simplified)
  cmn: `'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
  
  // Chinese (Traditional)
  yue: `'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`,
  
  // Japanese
  jpn: `'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif`,
  
  // Korean
  kor: `'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`,
  
  // Thai
  tha: `'Noto Sans Thai', 'Sukhumvit Set', 'Thonburi', sans-serif`,
  
  // Hindi, Devanagari
  hin: `'Noto Sans Devanagari', 'Mukta', sans-serif`,
  
  // Default fallback
  default: `'Inter', system-ui, sans-serif`
}

// Text direction detection
function getTextDirection(langCode: string): 'ltr' | 'rtl' {
  const rtlLanguages = ['ara', 'arb', 'heb', 'fas', 'urd', 'pus']
  return rtlLanguages.includes(langCode) ? 'rtl' : 'ltr'
}

// Message component with auto-detection
interface MessageProps {
  content: string
  role: 'user' | 'assistant'
}

function Message({ content, role }: MessageProps) {
  const langCode = detectLanguage(content)
  const direction = getTextDirection(langCode)
  const fontFamily = fontFamilies[langCode] || fontFamilies.default
  
  return (
    <div
      dir={direction}
      style={{ fontFamily }}
      className={`message message-${role}`}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
```

### CSS Support

```css
/* Tailwind config */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Noto Sans Arabic', 'Amiri', 'sans-serif'],
        hebrew: ['Noto Sans Hebrew', 'Alef', 'sans-serif'],
        japanese: ['Noto Sans JP', 'Hiragino Sans', 'sans-serif'],
        korean: ['Noto Sans KR', 'Malgun Gothic', 'sans-serif'],
        chinese: ['Noto Sans SC', 'PingFang SC', 'sans-serif'],
        thai: ['Noto Sans Thai', 'Sukhumvit Set', 'sans-serif']
      }
    }
  }
}
```

### Font Loading Strategy

```typescript
// next.config.js - Use next/font for Google Fonts
import { Noto_Sans_Arabic, Noto_Sans_Hebrew, Noto_Sans_JP } from 'next/font/google'

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-arabic'
})

// Only load fonts when needed
export function getFontVariable(langCode: string) {
  const fontMap = {
    ara: notoArabic.variable,
    // ... other mappings
  }
  return fontMap[langCode] || ''
}
```

### Why This Matters

- **Readability** - Default Latin fonts render Arabic/Hebrew poorly
- **Professional appearance** - Proper typography = quality product
- **International users** - 60%+ of developers are non-English primary
- **Edge cases** - Mixed-language messages render correctly

### Mock Data Update

```typescript
// Add to mock-data.ts
const internationalConversations = [
  {
    title: 'Arabic Code Review',
    messages: [
      { role: 'user', content: 'هل يمكنك مراجعة هذا الكود؟\n\n```javascript\nconst x = 5\n```' },
      { role: 'assistant', content: 'بالتأكيد! الكود يبدو جيداً ولكن أقترح...' }
    ]
  },
  {
    title: 'Mixed Language Discussion',
    messages: [
      { role: 'user', content: 'How do I say "hello" in 日本語?' },
      { role: 'assistant', content: 'In Japanese, "hello" is こんにちは (konnichiwa)' }
    ]
  }
]
```

### Action Item

Add `franc-min` dependency + font mapping in Phase 1.

---

## 9. Performance Optimization

**Status: Enable virtualization now - free insurance**

### React Flow Configuration

```typescript
import ReactFlow, { Background, Controls } from 'reactflow'
import 'reactflow/dist/style.css'

function Canvas() {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      
      // ✅ Enable viewport virtualization (simple flag)
      nodesDraggable={true}
      nodesConnectable={true}
      
      // Performance optimizations
      onlyRenderVisibleElements={true} // 🔥 Key setting
      minZoom={0.1}
      maxZoom={4}
      
      // Smooth interactions
      defaultEdgeOptions={{
        animated: false, // Disable in Phase 1
        style: { strokeWidth: 2 }
      }}
      
      // Viewport optimization
      fitView
      fitViewOptions={{
        padding: 0.2,
        includeHiddenNodes: false
      }}
    >
      <Background color="#1a1d2e" gap={16} />
      <Controls />
    </ReactFlow>
  )
}
```

### Why Enable Now Even With <20 Nodes

1. **Zero cost** - It's a single prop: `onlyRenderVisibleElements={true}`
2. **Future-proof** - When users have 100+ conversations, it just works
3. **Zoom performance** - Zoomed-out view doesn't render hidden details
4. **Mobile support** - Better performance on lower-end devices
5. **No downside** - React Flow handles it automatically

### Performance Monitoring

```typescript
// Add simple performance tracking
import { useEffect } from 'react'

function useCanvasPerformance(nodeCount: number) {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure' && entry.name.includes('react-flow')) {
          console.log(`Render time: ${entry.duration}ms for ${nodeCount} nodes`)
        }
      }
    })
    observer.observe({ entryTypes: ['measure'] })
    return () => observer.disconnect()
  }, [nodeCount])
}
```

### Additional Optimizations

```typescript
// These come free with onlyRenderVisibleElements
- Viewport culling (nodes outside view aren't rendered)
- Edge simplification (bezier curves simplified when zoomed out)
- Lazy edge rendering (only render edges for visible nodes)
- Debounced pan/zoom updates
```

### Benchmark Expectations

```
10 nodes:   ~16ms render (60 FPS) ✅
50 nodes:   ~25ms render (40 FPS) ✅
100 nodes:  ~35ms render (28 FPS) ✅ with virtualization
100 nodes:  ~250ms render (4 FPS) ❌ without virtualization
```

### Action Item

Set `onlyRenderVisibleElements={true}` from day 1.

---

## 10. Expanded Card Z-Index

**Status: Always float above with clear visual hierarchy**

### Implementation - Layering System

```typescript
// Z-index layering system
const Z_INDEX = {
  CANVAS_BACKGROUND: 0,
  EDGES: 1,
  CARD_COLLAPSED: 10,
  CARD_HOVER: 20,
  CARD_EXPANDED: 100,
  CARD_DRAGGING: 1000,
  MODAL_OVERLAY: 10000
} as const

// Card component
interface CardProps {
  isExpanded: boolean
  isDragging: boolean
  isHovered: boolean
}

function ConversationCard({ isExpanded, isDragging, isHovered }: CardProps) {
  const zIndex = isDragging 
    ? Z_INDEX.CARD_DRAGGING
    : isExpanded 
      ? Z_INDEX.CARD_EXPANDED 
      : isHovered
        ? Z_INDEX.CARD_HOVER
        : Z_INDEX.CARD_COLLAPSED

  return (
    <motion.div
      layout
      style={{ 
        position: 'absolute',
        zIndex 
      }}
      animate={{
        scale: isExpanded ? 1 : isHovered ? 1.02 : 1,
        boxShadow: isExpanded 
          ? '0 20px 60px rgba(0, 0, 0, 0.5)' 
          : isHovered
            ? '0 8px 24px rgba(102, 126, 234, 0.3)'
            : '0 4px 12px rgba(0, 0, 0, 0.2)'
      }}
    >
      {/* Card content */}
    </motion.div>
  )
}
```

### Why Always Float

1. **Clear focus** - User knows what they're reading
2. **Prevents occlusion** - Expanded content never hidden behind other cards
3. **Visual affordance** - Elevation = active state (Material Design principle)
4. **Click-outside behavior** - Easy to click canvas to collapse

### Optional UX Refinement

```typescript
// Dim other cards when one is expanded (optional)
function Canvas({ cards, expandedCardId }) {
  return (
    <>
      {cards.map(card => (
        <ConversationCard
          key={card.id}
          isExpanded={card.id === expandedCardId}
          dimmed={expandedCardId && card.id !== expandedCardId}
          style={{
            opacity: expandedCardId && card.id !== expandedCardId ? 0.4 : 1,
            filter: expandedCardId && card.id !== expandedCardId 
              ? 'blur(2px)' 
              : 'none'
          }}
        />
      ))}
    </>
  )
}
```

### Action Item

Create `constants/zIndex.ts` with layering system.

---

## 11. Initial Canvas Layout

**Status: Structured grid with organic variation**

### Implementation - Grid + Randomness

```typescript
// Grid-based layout with randomness
function generateInitialLayout(
  conversations: Conversation[],
  canvasSize = { width: 2000, height: 2000 }
) {
  const CARD_WIDTH = 300
  const CARD_HEIGHT = 120
  const GRID_COLS = 4
  const SPACING_X = 400 // Room for expansion
  const SPACING_Y = 200
  const RANDOMNESS = 30 // ±30px variation

  return conversations.map((conv, index) => {
    const row = Math.floor(index / GRID_COLS)
    const col = index % GRID_COLS
    
    // Base grid position
    const baseX = col * SPACING_X + 100
    const baseY = row * SPACING_Y + 100
    
    // Add organic randomness
    const randomX = (Math.random() - 0.5) * RANDOMNESS
    const randomY = (Math.random() - 0.5) * RANDOMNESS
    
    return {
      ...conv,
      position: {
        x: baseX + randomX,
        y: baseY + randomY
      }
    }
  })
}

// Example output for 12 conversations
/*
  [Card1]  [Card2]  [Card3]  [Card4]
     ↓        ↓        ↓        ↓
  [Card5]  [Card6]  [Card7]  [Card8]
     ↓        ↓        ↓        ↓
  [Card9]  [Card10] [Card11] [Card12]

  (with each card slightly offset for organic feel)
*/
```

### Alternative: Semantic Grouping

```typescript
// Group by conversation type/topic
function generateSemanticLayout(conversations: Conversation[]) {
  const groups = {
    planning: conversations.filter(c => c.tags?.includes('planning')),
    coding: conversations.filter(c => c.tags?.includes('code')),
    research: conversations.filter(c => c.tags?.includes('research'))
  }
  
  // Layout groups in clusters
  return [
    ...layoutCluster(groups.planning, { x: 100, y: 100 }),
    ...layoutCluster(groups.coding, { x: 800, y: 100 }),
    ...layoutCluster(groups.research, { x: 100, y: 600 })
  ]
}

function layoutCluster(
  cards: Conversation[], 
  origin: { x: number, y: number }
) {
  // Circular cluster layout
  const radius = 200
  return cards.map((card, i) => {
    const angle = (i / cards.length) * 2 * Math.PI
    return {
      ...card,
      position: {
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y + Math.sin(angle) * radius
      }
    }
  })
}
```

### Why Structured Grid with Variation

1. **Immediate comprehension** - Users see organization is possible
2. **Not chaotic** - Random scatter looks messy, discourages use
3. **Organic feel** - Slight variation prevents robotic appearance
4. **Easy to adjust** - Users can quickly reorganize from good starting point

### Visual Comparison

```
❌ Pure random:           ✅ Grid + variation:
    [3]                      [1]  [2]  [3]
  [1]    [5]                   
      [2]                      [4]  [5]  [6]
[4]        [6]              
(Chaos)                     (Clear but natural)
```

### Mock Data Setup

```typescript
// mock-data.ts
export const INITIAL_CONVERSATIONS = generateInitialLayout([
  { id: '1', title: 'Recipe App Planning', messages: [...] },
  { id: '2', title: 'Python Data Analysis', messages: [...] },
  { id: '3', title: 'API Design Review', messages: [...] },
  // ... 10-15 total
])
```

### Action Item

Create `utils/layoutGenerator.ts` with grid + randomness algorithm.

---

## 12. Local Storage Migration

**Status: Version field from day 1 - critical for longevity**

### Schema Versioning Strategy

```typescript
// types/storage.ts
interface PersistedState {
  version: number // ⚠️ CRITICAL - add from day 1
  createdAt: string
  updatedAt: string
  data: CanvasState
}

interface CanvasState {
  canvases: Canvas[]
  settings: UserSettings
}

// Current version
const STORAGE_VERSION = 1

// Storage manager with migration support
class StorageManager {
  private readonly STORAGE_KEY = 'projectloom_state'
  private readonly CURRENT_VERSION = STORAGE_VERSION
  
  // Save with version
  save(state: CanvasState): void {
    const persisted: PersistedState = {
      version: this.CURRENT_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: state
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(persisted))
  }
  
  // Load with migration
  load(): CanvasState | null {
    const raw = localStorage.getItem(this.STORAGE_KEY)
    if (!raw) return null
    
    try {
      const persisted: PersistedState = JSON.parse(raw)
      
      // Migrate if needed
      const migrated = this.migrate(persisted)
      
      // Save migrated version
      if (migrated.version !== this.CURRENT_VERSION) {
        this.save(migrated.data)
      }
      
      return migrated.data
    } catch (error) {
      console.error('Failed to load state:', error)
      return null
    }
  }
  
  // Migration pipeline
  private migrate(persisted: PersistedState): PersistedState {
    let current = persisted
    
    // Apply migrations in sequence
    if (current.version < 2) {
      current = this.migrateV1toV2(current)
    }
    if (current.version < 3) {
      current = this.migrateV2toV3(current)
    }
    // ... future migrations
    
    return current
  }
  
  // Example migration: V1 → V2
  private migrateV1toV2(state: PersistedState): PersistedState {
    console.log('Migrating from V1 to V2')
    
    // Example: Add parentCanvasId field to all canvases
    const migratedCanvases = state.data.canvases.map(canvas => ({
      ...canvas,
      parentCanvasId: null, // New field in V2
      contextSnapshot: null // New field in V2
    }))
    
    return {
      ...state,
      version: 2,
      data: {
        ...state.data,
        canvases: migratedCanvases
      }
    }
  }
  
  // Example migration: V2 → V3
  private migrateV2toV3(state: PersistedState): PersistedState {
    console.log('Migrating from V2 to V3')
    
    // Example: Change edge format
    const migratedCanvases = state.data.canvases.map(canvas => ({
      ...canvas,
      connections: canvas.edges?.map(e => ({
        id: e.id,
        source: e.from, // Renamed field
        target: e.to    // Renamed field
      })) || []
    }))
    
    return {
      ...state,
      version: 3,
      data: {
        ...state.data,
        canvases: migratedCanvases
      }
    }
  }
}

export const storage = new StorageManager()
```

### Usage in Components

```typescript
// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { storage } from '@/lib/storage'

function Canvas() {
  const [state, setState] = useState<CanvasState | null>(null)
  
  // Load on mount
  useEffect(() => {
    const loaded = storage.load()
    if (loaded) {
      setState(loaded)
    } else {
      // Initialize with default state
      setState(getDefaultState())
    }
  }, [])
  
  // Save on changes
  useEffect(() => {
    if (state) {
      storage.save(state)
    }
  }, [state])
  
  return <CanvasView state={state} />
}
```

### Migration Testing

```typescript
// __tests__/storage.test.ts
describe('StorageManager migrations', () => {
  it('migrates V1 to V2', () => {
    const v1State = {
      version: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      data: {
        canvases: [{ id: '1', conversations: [] }]
      }
    }
    
    localStorage.setItem('projectloom_state', JSON.stringify(v1State))
    
    const loaded = storage.load()
    
    expect(loaded.canvases[0]).toHaveProperty('parentCanvasId')
    expect(loaded.canvases[0]).toHaveProperty('contextSnapshot')
  })
  
  it('handles corrupted state gracefully', () => {
    localStorage.setItem('projectloom_state', 'invalid json{')
    
    const loaded = storage.load()
    
    expect(loaded).toBeNull()
  })
})
```

### Schema Documentation

```typescript
// docs/schema-versions.md

## Schema Version History

### V1 (Phase 1 - Week 1-2)
```typescript
interface Canvas {
  id: string
  title: string
  conversations: Conversation[]
  edges: Edge[]
}
```

### V2 (Phase 2 - Week 3-4) - Added branching
```typescript
interface Canvas {
  id: string
  title: string
  conversations: Conversation[]
  connections: Connection[] // Renamed from edges
  parentCanvasId: string | null // NEW
  contextSnapshot: ContextSnapshot | null // NEW
}
```

### V3 (Future) - Example
```typescript
interface Canvas {
  // ... V2 fields
  aiProvider: 'claude' | 'openai' | 'local' // NEW
  tags: string[] // NEW
}
```
```

### Why Version From Day 1

1. **Inevitable changes** - Data structure WILL evolve
2. **User data preservation** - Can't lose user's work
3. **Easy rollback** - Can detect old versions and handle them
4. **Testing migrations** - Can test migration logic before shipping
5. **Zero cost** - Just one field: `version: 1`

### Action Item

Create `lib/storage.ts` with versioned persistence layer.

---

## 13. Edge Connection Creation

**Status: Click-and-drag (React Flow native behavior)**

### Implementation

```typescript
import ReactFlow, { 
  Controls, 
  Background, 
  Connection,
  addEdge,
  useNodesState,
  useEdgesState
} from 'reactflow'

function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Handle new connections
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: '#667eea',
        strokeWidth: 2
      }
    }, eds))
  }, [setEdges])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect} // ✅ Click-and-drag connections
      
      // Connection line styling (while dragging)
      connectionLineStyle={{
        stroke: '#fbbf24',
        strokeWidth: 2
      }}
      connectionLineType="smoothstep"
      
      // Visual feedback
      snapToGrid={false}
      snapGrid={[15, 15]}
    >
      <Background color="#1a1d2e" gap={16} />
      <Controls />
    </ReactFlow>
  )
}
```

### Custom Connection Handles

```typescript
// components/ConversationCard.tsx
import { Handle, Position } from 'reactflow'

function ConversationCard({ data, isExpanded }: CardProps) {
  return (
    <div className="conversation-card">
      {/* Connection handles - 4 sides */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 12,
          height: 12,
          background: '#667eea',
          border: '2px solid #1a1d2e'
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 12,
          height: 12,
          background: '#fbbf24',
          border: '2px solid #1a1d2e'
        }}
      />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      
      {/* Card content */}
      <CardContent data={data} isExpanded={isExpanded} />
    </div>
  )
}
```

### Visual States

```css
/* Connection handle hover states */
.react-flow__handle {
  opacity: 0; /* Hidden by default */
  transition: opacity 0.2s;
}

.react-flow__node:hover .react-flow__handle {
  opacity: 1; /* Visible on card hover */
}

.react-flow__handle:hover {
  width: 16px;
  height: 16px;
  background: #fbbf24; /* Amber on hover */
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.6);
}

/* Connection line while dragging */
.react-flow__connectionline {
  stroke: #fbbf24;
  stroke-width: 2;
  stroke-dasharray: 5, 5;
  animation: dash 0.5s linear infinite;
}

@keyframes dash {
  to { stroke-dashoffset: -10; }
}
```

### Why Click-and-Drag Over Context Menu

1. **Spatial thinking** - Directly shows relationship being created
2. **Familiar pattern** - Figma, Miro, React Flow all use this
3. **Visual feedback** - See the connection forming in real-time
4. **Fewer clicks** - No context menu, right to action
5. **Discoverable** - Handles appear on hover (affordance)

### UX Flow

```
1. Hover card → Handles appear
2. Click handle → Drag to target card
3. Drop on target handle → Connection created
4. Visual: Animated bezier curve appears
```

### Action Item

Use React Flow's built-in `onConnect` - it's already perfect.

---

## 14. Keyboard Shortcuts

**Status: Essential shortcuts only (Delete + Escape)**

### Phase 1 Implementation - Essential Only

```typescript
// hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react'

interface ShortcutConfig {
  onDelete: () => void
  onEscape: () => void
  selectedNodes: string[]
}

export function useKeyboardShortcuts({ 
  onDelete, 
  onEscape, 
  selectedNodes 
}: ShortcutConfig) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (selectedNodes.length > 0) {
            e.preventDefault()
            onDelete()
          }
          break

        case 'Escape':
          e.preventDefault()
          onEscape() // Collapse all, deselect, close panels
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDelete, onEscape, selectedNodes])
}
```

### Usage in Canvas

```typescript
function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  useKeyboardShortcuts({
    selectedNodes,
    onDelete: () => {
      // Delete selected nodes
      setNodes(nodes => nodes.filter(n => !selectedNodes.includes(n.id)))
      setSelectedNodes([])
    },
    onEscape: () => {
      // Collapse expanded cards
      setExpandedCard(null)
      // Clear selection
      setSelectedNodes([])
    }
  })

  return <ReactFlow {...props} />
}
```

### Phase 1 Shortcuts (Minimal Set)

```typescript
const PHASE_1_SHORTCUTS = {
  Delete: 'Delete selected card(s)',
  Escape: 'Collapse/deselect',
  // That's it for Phase 1
}
```

### Rationale

- Delete/Escape = **essential**, high impact, zero complexity
- Advanced shortcuts = **nice-to-have**, require more state management
- Phase 1 users won't miss what they don't know exists

### Action Item

Add `useKeyboardShortcuts.ts` with Delete + Escape only.

---

## 15. Error Boundaries

**Status: Wrap everything critical**

### Implementation

```typescript
// components/ErrorBoundary.tsx
'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Canvas error:', error, errorInfo)
    
    // Optional: Send to error tracking service
    // Sentry.captureException(error, { extra: errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary-fallback">
          <div className="error-content">
            <h1>Something went wrong</h1>
            <p>The canvas encountered an error and couldn't recover.</p>
            
            <details className="error-details">
              <summary>Error details</summary>
              <pre>{this.state.error?.message}</pre>
              <pre>{this.state.error?.stack}</pre>
            </details>
            
            <div className="error-actions">
              <button onClick={() => window.location.reload()}>
                Reload Canvas
              </button>
              <button onClick={() => {
                localStorage.removeItem('projectloom_state')
                window.location.reload()
              }}>
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

### Styling

```css
/* components/ErrorBoundary.module.css */
.error-boundary-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #0a0e1a;
  color: #e4e4f0;
  padding: 2rem;
}

.error-content {
  max-width: 600px;
  text-align: center;
}

.error-content h1 {
  color: #fbbf24;
  margin-bottom: 1rem;
}

.error-details {
  margin: 2rem 0;
  text-align: left;
  background: #1a1f35;
  padding: 1rem;
  border-radius: 8px;
}

.error-details pre {
  overflow-x: auto;
  font-size: 0.875rem;
  color: #f87171;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}

.error-actions button {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.error-actions button:first-child {
  background: #667eea;
  color: white;
}

.error-actions button:last-child {
  background: #1a1f35;
  color: #e4e4f0;
  border: 1px solid #667eea;
}

.error-actions button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}
```

### Usage

```typescript
// app/page.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Canvas from '@/components/Canvas'

export default function Page() {
  return (
    <ErrorBoundary>
      <Canvas />
    </ErrorBoundary>
  )
}
```

### Multiple Boundaries for Granular Recovery

```typescript
// app/page.tsx
export default function Page() {
  return (
    <ErrorBoundary>
      {/* Top-level boundary */}
      <Layout>
        <ErrorBoundary fallback={<SidebarError />}>
          {/* Sidebar can fail independently */}
          <Sidebar />
        </ErrorBoundary>
        
        <ErrorBoundary fallback={<CanvasError />}>
          {/* Canvas can fail independently */}
          <Canvas />
        </ErrorBoundary>
      </Layout>
    </ErrorBoundary>
  )
}
```

### Error Recovery Strategies

```typescript
// components/ErrorBoundary.tsx (extended)
class ErrorBoundary extends Component<Props, State> {
  // ... previous code

  private attemptRecovery = () => {
    // Try to recover by clearing problematic state
    try {
      const state = localStorage.getItem('projectloom_state')
      if (state) {
        const parsed = JSON.parse(state)
        
        // Remove potentially corrupted data
        delete parsed.data.expandedCard
        delete parsed.data.selectedNodes
        
        localStorage.setItem('projectloom_state', JSON.stringify(parsed))
        
        // Reset error state
        this.setState({ hasError: false, error: undefined })
      }
    } catch (e) {
      console.error('Recovery failed:', e)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <button onClick={this.attemptRecovery}>
            Try to Recover
          </button>
          <button onClick={() => window.location.reload()}>
            Reload Canvas
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

### Why Error Boundaries Are Critical

1. **Prevents white screen** - User sees helpful message, not blank page
2. **Data preservation** - Can offer recovery without losing work
3. **Debugging** - Captures error details for fixing
4. **User confidence** - Professional error handling builds trust
5. **Granular recovery** - Canvas fails ≠ whole app fails

### Common Errors to Catch

```typescript
// Types of errors that can occur:
- localStorage quota exceeded
- JSON parse errors (corrupted state)
- React Flow rendering errors (invalid node data)
- Network errors (when adding AI providers in Phase 2)
- Out of memory (too many nodes)
```

### Action Item

Create `components/ErrorBoundary.tsx` wrapping Canvas.

---

## 16. Dark Mode Only or Theme Toggle

**Status: Dark-only - it's the product identity**

### Design Identity

```typescript
// The design IS dark mode - not just a theme option
const DESIGN_IDENTITY = {
  background: '#1a1d2e',      // Deep navy
  nodes: '#667eea',           // Electric violet
  accent: '#fbbf24',          // Warm amber
  // This palette doesn't translate to light mode
}
```

### Why Dark-Only

1. **Design coherence** - The glowing nodes, particle effects, and deep space aesthetic only work in dark
2. **Scope reduction** - Theming doubles CSS work and testing surface
3. **Target audience** - Developers overwhelmingly prefer dark mode
4. **Visual brand** - "Deep space" is the product identity
5. **Light mode would look wrong** - Glow effects, gradients, and color palette break in light mode

### Phase 1 Implementation

```typescript
// app/layout.tsx
export default function RootLayout({ children }: Props) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#1a1d2e] text-[#e4e4f0]">
        {children}
      </body>
    </html>
  )
}
```

### Action Item

Hard-code dark theme, no toggle in Phase 1.

---

## 17. Deployment Target

**Status: Platform-agnostic Next.js, deploy to Vercel but don't lock in**

### Architecture Approach

```typescript
// ✅ Use Next.js features that work anywhere
export const dynamic = 'force-dynamic'  // Works on Vercel/Netlify/self-hosted
export const runtime = 'nodejs'         // Not 'edge' (Vercel-specific)

// ❌ Avoid Vercel-specific features in Phase 1
// - Edge runtime (unless needed for performance)
// - Vercel KV (use localStorage Phase 1, DB Phase 2)
// - Vercel Blob storage
// - ISR (not needed for client-side canvas)
```

### Phase 1 Architecture (Platform-Agnostic)

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standard Next.js config - works everywhere
  reactStrictMode: true,
  
  // No Vercel-specific settings
  // No edge runtime requirements
  // No ISR/SSG (client-side app)
}

module.exports = nextConfig
```

### Data Layer (Phase 1)

```typescript
// lib/storage.ts - Browser APIs only
class StorageManager {
  // ✅ localStorage (works everywhere)
  save(state: CanvasState): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state))
  }
  
  // ❌ NOT Vercel KV (vendor lock-in)
  // import { kv } from '@vercel/kv'
}
```

### Deployment Config

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "export": "next build && next export"  // Static export option
  }
}
```

### Why Platform-Agnostic

1. **Flexibility** - Can switch hosts if Vercel pricing changes
2. **Open source friendly** - Users can self-host
3. **No vendor lock-in** - Not dependent on Vercel APIs
4. **Simpler** - Standard Next.js is well-documented
5. **Broader deployment** - Netlify, Railway, Cloudflare Pages all work

### Deployment Options

```bash
# Primary: Vercel (easiest)
vercel deploy

# Alternative 1: Netlify
netlify deploy

# Alternative 2: Self-hosted
docker build -t projectloom .
docker run -p 3000:3000 projectloom

# Alternative 3: Static export
npm run export
# Deploy to any static host (Cloudflare Pages, GitHub Pages)
```

### Action Item

Use standard Next.js App Router, deploy to Vercel but keep portable.

---

## 18. Testing Strategy

**Status: Test critical logic (storage + layout), defer UI tests**

### Phase 1 Test Coverage

```
✅ Test (critical business logic):
- layoutGenerator.ts
- storage.ts (migrations!)
- zIndex.ts (constants)

❌ Don't test (defer to Phase 2):
- React components
- React Flow interactions
- Visual regression tests
- E2E tests
```

### Setup

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.ts'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### Test 1: Layout Generator

```typescript
// __tests__/utils/layoutGenerator.test.ts
import { describe, it, expect } from 'vitest'
import { generateInitialLayout } from '@/utils/layoutGenerator'
import { mockConversations } from '@/mock-data'

describe('layoutGenerator', () => {
  it('generates grid-based layout with randomness', () => {
    const positioned = generateInitialLayout(mockConversations)
    
    // Should have same count
    expect(positioned).toHaveLength(mockConversations.length)
    
    // Should have position property
    positioned.forEach(conv => {
      expect(conv.position).toBeDefined()
      expect(conv.position.x).toBeGreaterThan(0)
      expect(conv.position.y).toBeGreaterThan(0)
    })
  })
  
  it('applies randomness within bounds', () => {
    const positioned = generateInitialLayout(mockConversations)
    
    // First card should be roughly at (100, 100) ± 30px
    const firstCard = positioned[0]
    expect(firstCard.position.x).toBeGreaterThan(70)
    expect(firstCard.position.x).toBeLessThan(130)
    expect(firstCard.position.y).toBeGreaterThan(70)
    expect(firstCard.position.y).toBeLessThan(130)
  })
  
  it('spaces cards appropriately', () => {
    const positioned = generateInitialLayout(mockConversations.slice(0, 8))
    
    // Second card (col 1) should be ~400px away from first
    const distance = positioned[1].position.x - positioned[0].position.x
    expect(distance).toBeGreaterThan(370)  // 400 - 30 randomness
    expect(distance).toBeLessThan(430)     // 400 + 30 randomness
  })
})
```

### Test 2: Storage Manager (CRITICAL)

```typescript
// __tests__/lib/storage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { storage } from '@/lib/storage'
import type { CanvasState } from '@/types'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('StorageManager', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  
  it('saves and loads state with version', () => {
    const state: CanvasState = {
      canvases: [{ id: '1', title: 'Test', conversations: [] }],
      settings: {}
    }
    
    storage.save(state)
    const loaded = storage.load()
    
    expect(loaded).toEqual(state)
  })
  
  it('returns null for empty storage', () => {
    const loaded = storage.load()
    expect(loaded).toBeNull()
  })
  
  it('handles corrupted JSON gracefully', () => {
    localStorage.setItem('projectloom_state', 'invalid{json')
    const loaded = storage.load()
    expect(loaded).toBeNull()
  })
  
  // 🔥 CRITICAL TEST - Migration logic
  it('migrates V1 to V2 schema', () => {
    const v1State = {
      version: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      data: {
        canvases: [
          { id: '1', title: 'Test', conversations: [] }
        ],
        settings: {}
      }
    }
    
    localStorage.setItem('projectloom_state', JSON.stringify(v1State))
    
    const loaded = storage.load()
    
    // Should have V2 fields
    expect(loaded.canvases[0]).toHaveProperty('parentCanvasId')
    expect(loaded.canvases[0]).toHaveProperty('contextSnapshot')
    
    // Should update version in storage
    const storedRaw = localStorage.getItem('projectloom_state')
    const stored = JSON.parse(storedRaw!)
    expect(stored.version).toBe(2)
  })
  
  it('adds timestamps on save', () => {
    const state: CanvasState = {
      canvases: [],
      settings: {}
    }
    
    storage.save(state)
    
    const raw = localStorage.getItem('projectloom_state')
    const persisted = JSON.parse(raw!)
    
    expect(persisted.createdAt).toBeDefined()
    expect(persisted.updatedAt).toBeDefined()
    expect(persisted.version).toBe(1)
  })
})
```

### Test 3: Constants (Simple Validation)

```typescript
// __tests__/constants/zIndex.test.ts
import { describe, it, expect } from 'vitest'
import { Z_INDEX } from '@/constants/zIndex'

describe('Z_INDEX constants', () => {
  it('maintains proper layering order', () => {
    expect(Z_INDEX.CANVAS_BACKGROUND).toBeLessThan(Z_INDEX.EDGES)
    expect(Z_INDEX.EDGES).toBeLessThan(Z_INDEX.CARD_COLLAPSED)
    expect(Z_INDEX.CARD_COLLAPSED).toBeLessThan(Z_INDEX.CARD_HOVER)
    expect(Z_INDEX.CARD_HOVER).toBeLessThan(Z_INDEX.CARD_EXPANDED)
    expect(Z_INDEX.CARD_EXPANDED).toBeLessThan(Z_INDEX.CARD_DRAGGING)
    expect(Z_INDEX.CARD_DRAGGING).toBeLessThan(Z_INDEX.MODAL_OVERLAY)
  })
  
  it('has no duplicate values', () => {
    const values = Object.values(Z_INDEX)
    const unique = new Set(values)
    expect(values.length).toBe(unique.size)
  })
})
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### Why This Testing Strategy

1. **High ROI** - Storage migrations breaking = data loss (unacceptable)
2. **Quick to write** - Pure functions, no mocking React
3. **Fast execution** - No browser, no rendering
4. **Critical paths** - Layout and storage are core logic
5. **Defer UI tests** - Components will change a lot in Phase 1

### What We're NOT Testing in Phase 1

```typescript
// ❌ Skip these (too much churn in Phase 1)
- Component rendering
- User interactions (click, drag, hover)
- React Flow integration
- Animation timing
- Visual regression
- E2E workflows

// Test these in Phase 2 when UI stabilizes
```

### Test Coverage Target Phase 1

```
Storage layer:     100% (critical)
Layout generator:  90%  (core logic)
Constants:         80%  (validation)
Components:        0%   (defer to Phase 2)

Overall:           ~40% (acceptable for MVP)
```

### Action Item

Add Vitest with tests for `storage.ts`, `layoutGenerator.ts`, and `zIndex.ts`.

---

## 19. Connection Visual Feedback

**Status: Use React Flow's native connection line styling**

### Implementation

```typescript
// components/Canvas.tsx
import ReactFlow, { ConnectionLineType } from 'reactflow'

function Canvas() {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onConnect={onConnect}
      
      // ✅ Connection line while dragging
      connectionLineType={ConnectionLineType.SmoothStep}
      connectionLineStyle={{
        stroke: '#fbbf24',        // Amber (different from final edge)
        strokeWidth: 3,
        strokeDasharray: '8, 4',  // Dashed line
        animation: 'dash 0.5s linear infinite'
      }}
      
      // ✅ Connection mode
      connectionMode="loose"  // Can connect to any handle
      
      // ✅ Visual states
      connectionLineComponent={CustomConnectionLine}
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
```

### Custom Connection Line Component

```typescript
// components/CustomConnectionLine.tsx
import { ConnectionLineComponentProps } from 'reactflow'

export function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  connectionLineStyle
}: ConnectionLineComponentProps) {
  return (
    <g>
      {/* Main connection line */}
      <path
        d={`M ${fromX} ${fromY} C ${fromX} ${toY} ${fromX} ${toY} ${toX} ${toY}`}
        style={connectionLineStyle}
        className="connection-line-preview"
      />
      
      {/* Endpoint indicator (glowing dot) */}
      <circle
        cx={toX}
        cy={toY}
        r={8}
        fill="#fbbf24"
        className="connection-endpoint"
      />
      
      {/* Animated particles along the line (optional) */}
      <circle
        cx={fromX + (toX - fromX) * 0.5}
        cy={fromY + (toY - fromY) * 0.5}
        r={4}
        fill="#fbbf24"
        className="connection-particle"
      />
    </g>
  )
}
```

### CSS Animations

```css
/* styles/canvas.css */

/* Dashed line animation */
@keyframes dash {
  to {
    stroke-dashoffset: -12;
  }
}

.connection-line-preview {
  stroke: #fbbf24;
  stroke-width: 3;
  stroke-dasharray: 8, 4;
  animation: dash 0.5s linear infinite;
  opacity: 0.8;
}

/* Glowing endpoint */
.connection-endpoint {
  fill: #fbbf24;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.6));
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    r: 8;
  }
  50% {
    opacity: 0.6;
    r: 10;
  }
}

/* Particle movement */
.connection-particle {
  fill: #fbbf24;
  opacity: 0.6;
  animation: particleMove 2s ease-in-out infinite;
}

@keyframes particleMove {
  0%, 100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(20px);
  }
}
```

### Visual States During Connection

```typescript
// Handle hover states
const handleStyle = {
  default: {
    width: 12,
    height: 12,
    background: '#667eea',
    border: '2px solid #1a1d2e',
    opacity: 0
  },
  hover: {
    width: 16,
    height: 16,
    background: '#fbbf24',
    boxShadow: '0 0 12px rgba(251, 191, 36, 0.6)',
    opacity: 1
  },
  connecting: {
    width: 18,
    height: 18,
    background: '#fbbf24',
    boxShadow: '0 0 16px rgba(251, 191, 36, 0.8)',
    opacity: 1,
    animation: 'pulse 0.5s ease-in-out infinite'
  }
}
```

### Why This Matters

1. **Clear affordance** - User sees exactly where the connection will land
2. **Prevents errors** - Visual confirmation before releasing mouse
3. **Professional feel** - Polished animation = quality product
4. **Spatial understanding** - Shows relationship being created in real-time

### Action Item

Use React Flow's built-in connection line with custom styling.

---

## 20. Card Metadata Display

**Status: Timestamp + message count, defer tags to Phase 2**

### Collapsed Card Layout

```typescript
// components/ConversationCard.tsx
interface ConversationCardProps {
  data: {
    id: string
    title: string
    messages: Message[]
    createdAt: Date
    tags?: string[]  // Phase 2
  }
  isExpanded: boolean
}

function ConversationCard({ data, isExpanded }: ConversationCardProps) {
  if (!isExpanded) {
    return (
      <motion.div className="card-collapsed">
        {/* Header with metadata */}
        <div className="card-header">
          <h3 className="card-title">{data.title}</h3>
          
          {/* Message count badge */}
          <span className="message-count">
            💬 {data.messages.length}
          </span>
        </div>
        
        {/* Preview of first message */}
        <p className="card-preview">
          {truncate(data.messages[0]?.content, 80)}
        </p>
        
        {/* Footer with timestamp */}
        <div className="card-footer">
          <time className="card-timestamp">
            {formatRelativeTime(data.createdAt)}
          </time>
        </div>
      </motion.div>
    )
  }
  
  return <ExpandedCard data={data} />
}
```

### Styling

```css
/* components/ConversationCard.module.css */
.card-collapsed {
  width: 300px;
  height: 120px;
  background: #1a1f35;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(102, 126, 234, 0.2);
  transition: all 0.2s;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #e4e4f0;
  margin: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.card-preview {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-timestamp {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
}

/* Hover state */
.card-collapsed:hover {
  border-color: rgba(102, 126, 234, 0.5);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.card-collapsed:hover .card-timestamp {
  color: #9ca3af;
}
```

### Utility Functions

```typescript
// utils/formatters.ts
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
```

### Visual Layout

```
┌─────────────────────────────┐
│ Recipe App Planning    💬 12 │  ← Title + message count
├─────────────────────────────┤
│ Help me build a recipe app  │  ← First message preview
│ with Next.js and...         │
├─────────────────────────────┤
│ 2h ago                      │  ← Relative timestamp
└─────────────────────────────┘
```

### Why This Metadata

1. **Message count** - Shows conversation depth at a glance
2. **Timestamp** - Helps find recent work ("I was working on this 2h ago")
3. **Preview text** - Context without expanding
4. **Defer tags** - No tagging system yet, don't show empty state

### Action Item

Add timestamp + message count badge to collapsed cards.

---

## 21. Initial Viewport Position

**Status: Center on card cluster with fitView() on mount**

### Implementation

```typescript
// components/Canvas.tsx
import ReactFlow, { 
  useReactFlow,
  ReactFlowProvider 
} from 'reactflow'
import { useEffect } from 'react'

function CanvasInner() {
  const { fitView } = useReactFlow()
  
  // Center on cards when component mounts
  useEffect(() => {
    // Small delay to ensure nodes are rendered
    setTimeout(() => {
      fitView({
        padding: 0.2,           // 20% padding around cards
        includeHiddenNodes: false,
        minZoom: 0.5,           // Don't zoom in too close
        maxZoom: 1,             // Don't zoom in beyond 100%
        duration: 800           // Smooth animation
      })
    }, 100)
  }, [fitView])
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onConnect={onConnect}
      
      // Default viewport (fallback)
      defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      
      // Fit view options for subsequent operations
      fitViewOptions={{
        padding: 0.2,
        includeHiddenNodes: false
      }}
    >
      <Background color="#1a1d2e" gap={16} />
      <Controls />
    </ReactFlow>
  )
}

// Wrap with provider (required for useReactFlow)
export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
```

### Controls for User Navigation

```typescript
// Add custom control buttons
import { Controls, ControlButton } from 'reactflow'
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  FitScreen 
} from 'lucide-react'

function CustomControls() {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow()
  
  return (
    <Controls>
      {/* Default zoom controls */}
      <ControlButton onClick={() => zoomIn()}>
        <ZoomIn size={16} />
      </ControlButton>
      <ControlButton onClick={() => zoomOut()}>
        <ZoomOut size={16} />
      </ControlButton>
      
      {/* Fit to view */}
      <ControlButton 
        onClick={() => fitView({ padding: 0.2, duration: 600 })}
        title="Fit all cards (Cmd+0)"
      >
        <FitScreen size={16} />
      </ControlButton>
      
      {/* Reset to 100% */}
      <ControlButton 
        onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 600 })}
        title="Reset zoom (Cmd+1)"
      >
        <Maximize size={16} />
      </ControlButton>
    </Controls>
  )
}
```

### Keyboard Shortcuts Integration

```typescript
// hooks/useKeyboardShortcuts.ts (extended)
export function useKeyboardShortcuts({ onDelete, onEscape }: Config) {
  const { fitView, setViewport } = useReactFlow()
  
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // ... existing shortcuts
      
      // Viewport controls
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault()
        fitView({ padding: 0.2, duration: 600 })
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault()
        setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 600 })
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fitView, setViewport])
}
```

### Visual Behavior

```typescript
// Different fitView scenarios

// 1. Initial mount - center on all cards
useEffect(() => {
  fitView({ padding: 0.2, duration: 800 })
}, [])

// 2. After adding new card - pan to new card
function addCard(newCard: Node) {
  setNodes(nodes => [...nodes, newCard])
  
  // Pan to show new card
  setTimeout(() => {
    const { x, y } = newCard.position
    setViewport({ 
      x: -x + window.innerWidth / 2, 
      y: -y + window.innerHeight / 2, 
      zoom: 1 
    }, { duration: 600 })
  }, 100)
}

// 3. After layout reorganization - fit to new positions
function applyLayout(newPositions: Position[]) {
  updateNodePositions(newPositions)
  
  setTimeout(() => {
    fitView({ padding: 0.2, duration: 800 })
  }, 100)
}
```

### Viewport Persistence (Optional)

```typescript
// Save viewport position in localStorage
function Canvas() {
  const { getViewport, setViewport } = useReactFlow()
  
  // Load saved viewport
  useEffect(() => {
    const saved = localStorage.getItem('projectloom_viewport')
    if (saved) {
      const viewport = JSON.parse(saved)
      setViewport(viewport, { duration: 0 })
    } else {
      // First time - fit to cards
      fitView({ padding: 0.2, duration: 800 })
    }
  }, [])
  
  // Save viewport on change
  const handleMoveEnd = () => {
    const viewport = getViewport()
    localStorage.setItem('projectloom_viewport', JSON.stringify(viewport))
  }
  
  return (
    <ReactFlow
      onMoveEnd={handleMoveEnd}
      // ... other props
    />
  )
}
```

### Why Center on Mount

1. **Immediate context** - User sees their cards right away
2. **No confusion** - Don't start at (0, 0) with cards off-screen
3. **Professional UX** - Apps like Figma/Miro do this
4. **Discoverable** - User can see there's content to interact with
5. **Smooth entry** - Animated zoom creates polished feel

### Visual Comparison

```
❌ Start at (0,0):
┌─────────────────┐
│                 │  ← Empty space
│                 │
│                 │
│        [Cards are way down here]
└─────────────────┘

✅ Fit to cards:
┌─────────────────┐
│  [C1] [C2] [C3] │  ← Cards centered
│  [C4] [C5] [C6] │     with padding
│  [C7] [C8] [C9] │
└─────────────────┘
```

### Action Item

Add `fitView()` on mount with 20% padding and smooth animation.

---

## 22. Mock Data Connections

**Status: Logical connections that tell a coherent project story**

### Story-Driven Mock Data

```typescript
// mock-data.ts
export const MOCK_PROJECT_STORY = {
  // Act 1: Initial Planning
  conversations: [
    {
      id: 'conv-1',
      title: '🎯 Recipe App - Initial Idea',
      messages: [
        { role: 'user', content: 'I want to build a recipe app for meal planning' },
        { role: 'assistant', content: 'Great! Let me help you plan this...' }
      ],
      position: { x: 100, y: 100 },
      createdAt: new Date('2026-02-01T10:00:00Z')
    },
    {
      id: 'conv-2',
      title: '📋 Feature Requirements',
      messages: [
        { role: 'user', content: 'What features should I include in MVP?' },
        { role: 'assistant', content: 'For MVP, focus on: recipe CRUD, search, meal planning...' }
      ],
      position: { x: 500, y: 100 },
      createdAt: new Date('2026-02-01T10:30:00Z')
    },
    
    // Act 2: Technical Planning
    {
      id: 'conv-3',
      title: '🏗️ Tech Stack Decision',
      messages: [
        { role: 'user', content: 'Should I use Next.js or Remix?' },
        { role: 'assistant', content: 'For this use case, Next.js 15 would be ideal...' }
      ],
      position: { x: 100, y: 300 },
      createdAt: new Date('2026-02-01T11:00:00Z')
    },
    {
      id: 'conv-4',
      title: '🗄️ Database Schema Design',
      messages: [
        { role: 'user', content: 'Help me design the database schema' },
        { role: 'assistant', content: 'Here's a schema for recipes, ingredients, and meal plans...' }
      ],
      position: { x: 500, y: 300 },
      createdAt: new Date('2026-02-01T11:30:00Z')
    },
    
    // Act 3: Implementation
    {
      id: 'conv-5',
      title: '⚛️ React Component Structure',
      messages: [
        { role: 'user', content: 'How should I structure the components?' },
        { role: 'assistant', content: 'Create a RecipeCard, RecipeList, and RecipeDetail...' }
      ],
      position: { x: 100, y: 500 },
      createdAt: new Date('2026-02-01T14:00:00Z')
    },
    {
      id: 'conv-6',
      title: '🔐 Authentication Setup',
      messages: [
        { role: 'user', content: 'Add user authentication with NextAuth' },
        { role: 'assistant', content: 'Here's how to set up NextAuth with Supabase...' }
      ],
      position: { x: 500, y: 500 },
      createdAt: new Date('2026-02-01T15:00:00Z')
    },
    
    // Act 4: Problem-Solving
    {
      id: 'conv-7',
      title: '🐛 Image Upload Bug',
      messages: [
        { role: 'user', content: 'Recipe images aren't uploading correctly' },
        { role: 'assistant', content: 'Let's debug the Supabase storage configuration...' }
      ],
      position: { x: 300, y: 700 },
      createdAt: new Date('2026-02-02T09:00:00Z')
    },
    {
      id: 'conv-8',
      title: '⚡ Performance Optimization',
      messages: [
        { role: 'user', content: 'Search is slow with 1000+ recipes' },
        { role: 'assistant', content: 'Add pagination and implement full-text search...' }
      ],
      position: { x: 700, y: 700 },
      createdAt: new Date('2026-02-02T10:00:00Z')
    }
  ],
  
  // Logical connections that tell the story
  connections: [
    // Planning flow
    { id: 'e1', source: 'conv-1', target: 'conv-2', label: 'leads to' },
    { id: 'e2', source: 'conv-2', target: 'conv-3', label: 'informs' },
    { id: 'e3', source: 'conv-2', target: 'conv-4', label: 'defines' },
    
    // Implementation flow
    { id: 'e4', source: 'conv-3', target: 'conv-5', label: 'framework for' },
    { id: 'e5', source: 'conv-4', target: 'conv-6', label: 'requires' },
    
    // Problem-solving branches
    { id: 'e6', source: 'conv-5', target: 'conv-7', label: 'led to bug' },
    { id: 'e7', source: 'conv-4', target: 'conv-8', label: 'scaling issue' },
    
    // Cross-references
    { id: 'e8', source: 'conv-6', target: 'conv-7', label: 'related to', type: 'reference' }
  ]
}
```

### Edge Types with Visual Distinction

```typescript
// types/edges.ts
export type EdgeType = 'flow' | 'reference' | 'problem' | 'solution'

export const EDGE_STYLES: Record<EdgeType, EdgeStyle> = {
  flow: {
    stroke: '#667eea',
    strokeWidth: 2,
    label: 'leads to',
    animated: false
  },
  reference: {
    stroke: '#9ca3af',
    strokeWidth: 1,
    strokeDasharray: '5, 5',
    label: 'related to',
    animated: false
  },
  problem: {
    stroke: '#ef4444',
    strokeWidth: 2,
    label: 'caused',
    animated: false
  },
  solution: {
    stroke: '#10b981',
    strokeWidth: 2,
    label: 'solved by',
    animated: false
  }
}
```

### Enhanced Mock Data Generator

```typescript
// utils/mockDataGenerator.ts
export function generateMockCanvas() {
  const { conversations, connections } = MOCK_PROJECT_STORY
  
  // Convert to React Flow format
  const nodes = conversations.map(conv => ({
    id: conv.id,
    type: 'conversationCard',
    position: conv.position,
    data: {
      title: conv.title,
      messages: conv.messages,
      createdAt: conv.createdAt,
      messageCount: conv.messages.length
    }
  }))
  
  const edges = connections.map(conn => ({
    id: conn.id,
    source: conn.source,
    target: conn.target,
    type: 'smoothstep',
    label: conn.label,
    ...EDGE_STYLES[conn.type || 'flow']
  }))
  
  return { nodes, edges }
}
```

### Visual Layout Showing Narrative

```
                [1: Initial Idea]
                       ↓
                [2: Requirements]
                   ↙       ↘
      [3: Tech Stack]    [4: Database]
              ↓               ↓
      [5: Components]    [6: Auth]
              ↓               ↓
          [7: Bug]    ← ← ← [6] (reference)
              
                    [8: Performance]
```

### Why Logical Connections

1. **Demonstrates value** - User sees "oh, this shows how my project evolved"
2. **Teaches spatial thinking** - Shows how to organize conversations
3. **Realistic scenario** - Matches actual development workflow
4. **Story arc** - Planning → Implementation → Problems → Solutions
5. **Different edge types** - Shows connection semantics matter

### Action Item

Create narrative-driven mock data with 8-10 connected conversations.

---

## 23. Card Color Coding

**Status: Single scheme Phase 1, color coding Phase 2**

### Phase 1 - Consistent Visual Language

```css
/* components/ConversationCard.module.css */
.card {
  background: #1a1f35;                    /* Navy background */
  border: 1px solid rgba(102, 126, 234, 0.2); /* Violet border */
  border-radius: 8px;
}

.card:hover {
  border-color: rgba(102, 126, 234, 0.5);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.card-expanded {
  border-color: #fbbf24;                  /* Amber when active */
  box-shadow: 0 20px 60px rgba(251, 191, 36, 0.3);
}

.message-count {
  background: rgba(251, 191, 36, 0.1);    /* Amber accent */
  color: #fbbf24;
}
```

### Why Single Scheme Phase 1

1. **Visual consistency** - Unified aesthetic, not rainbow chaos
2. **Focus on structure** - Spatial organization is the feature, not colors
3. **Reduces decisions** - User doesn't wonder "what color should this be?"
4. **Matches brand** - Deep space + electric violet + amber = ProjectLoom identity
5. **Defer complexity** - No tagging/categorization system yet

### Optional: Subtle Emoji Indicators (Phase 1 Compatible)

```typescript
// Add emoji prefix to titles in mock data
const conversations = [
  { title: '🎯 Initial Planning', ... },    // Planning
  { title: '⚛️ Component Design', ... },     // Implementation
  { title: '🐛 Image Upload Bug', ... },     // Debugging
  { title: '📚 API Documentation', ... }     // Documentation
]

// No color coding, but visual categorization through emoji
```

### Action Item

Use single color scheme (navy + violet + amber) in Phase 1.

---

## 24. Performance Monitoring

**Status: Dev-only overlay for React Flow metrics**

### Implementation

```typescript
// components/PerformanceMonitor.tsx
'use client'

import { useEffect, useState } from 'react'
import { useReactFlow } from 'reactflow'

interface PerformanceStats {
  fps: number
  nodeCount: number
  edgeCount: number
  visibleNodes: number
  renderTime: number
  zoom: number
  viewport: { x: number, y: number }
}

export function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const { getNodes, getEdges, getViewport } = useReactFlow()
  
  // Toggle with keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd + Shift + P
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        setIsVisible(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  // FPS monitoring
  useEffect(() => {
    if (!isVisible) return
    
    let frameCount = 0
    let lastTime = performance.now()
    let animationId: number
    
    function measureFPS() {
      frameCount++
      const currentTime = performance.now()
      const elapsed = currentTime - lastTime
      
      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed)
        const nodes = getNodes()
        const edges = getEdges()
        const viewport = getViewport()
        
        // Count visible nodes (simplified)
        const visibleNodes = nodes.length // TODO: Calculate actual visibility
        
        setStats({
          fps,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          visibleNodes,
          renderTime: 0, // TODO: Measure actual render time
          zoom: viewport.zoom,
          viewport: { x: viewport.x, y: viewport.y }
        })
        
        frameCount = 0
        lastTime = currentTime
      }
      
      animationId = requestAnimationFrame(measureFPS)
    }
    
    measureFPS()
    return () => cancelAnimationFrame(animationId)
  }, [isVisible, getNodes, getEdges, getViewport])
  
  if (!isVisible || !stats) return null
  
  return (
    <div className="performance-monitor">
      <div className="perf-header">
        <span>Performance Monitor</span>
        <button onClick={() => setIsVisible(false)}>×</button>
      </div>
      
      <div className="perf-stats">
        <StatRow 
          label="FPS" 
          value={stats.fps} 
          status={getFPSStatus(stats.fps)}
        />
        <StatRow 
          label="Nodes" 
          value={`${stats.visibleNodes}/${stats.nodeCount}`}
        />
        <StatRow 
          label="Edges" 
          value={stats.edgeCount}
        />
        <StatRow 
          label="Zoom" 
          value={`${Math.round(stats.zoom * 100)}%`}
        />
        <StatRow 
          label="Viewport" 
          value={`(${Math.round(stats.viewport.x)}, ${Math.round(stats.viewport.y)})`}
        />
      </div>
    </div>
  )
}

function StatRow({ 
  label, 
  value, 
  status 
}: { 
  label: string
  value: string | number
  status?: 'good' | 'warning' | 'bad'
}) {
  return (
    <div className={`stat-row ${status || ''}`}>
      <span className="stat-label">{label}:</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

function getFPSStatus(fps: number): 'good' | 'warning' | 'bad' {
  if (fps >= 55) return 'good'
  if (fps >= 30) return 'warning'
  return 'bad'
}
```

### Styling

```css
/* components/PerformanceMonitor.module.css */
.performance-monitor {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(10, 14, 26, 0.95);
  border: 1px solid #667eea;
  border-radius: 8px;
  padding: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #e4e4f0;
  min-width: 200px;
  z-index: 10000;
  backdrop-filter: blur(10px);
}

.perf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(102, 126, 234, 0.3);
  font-weight: 600;
  color: #fbbf24;
}

.perf-header button {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  width: 20px;
  height: 20px;
}

.perf-header button:hover {
  color: #ef4444;
}

.perf-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.stat-label {
  color: #9ca3af;
  margin-right: 8px;
}

.stat-value {
  color: #e4e4f0;
  font-weight: 500;
}

/* FPS status colors */
.stat-row.good .stat-value {
  color: #10b981;
}

.stat-row.warning .stat-value {
  color: #fbbf24;
}

.stat-row.bad .stat-value {
  color: #ef4444;
}
```

### Dev-Only Conditional Rendering

```typescript
// app/page.tsx
import { PerformanceMonitor } from '@/components/PerformanceMonitor'

export default function Page() {
  const isDev = process.env.NODE_ENV === 'development'
  
  return (
    <ErrorBoundary>
      <Canvas />
      
      {/* Only show in development */}
      {isDev && <PerformanceMonitor />}
    </ErrorBoundary>
  )
}
```

### Enhanced Version with React DevTools Integration

```typescript
// Optional: Add React DevTools Profiler
import { Profiler, ProfilerOnRenderCallback } from 'react'

function Canvas() {
  const onRender: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('React render:', {
        id,
        phase,
        actualDuration: `${actualDuration.toFixed(2)}ms`,
        baseDuration: `${baseDuration.toFixed(2)}ms`
      })
    }
  }
  
  return (
    <Profiler id="Canvas" onRender={onRender}>
      <ReactFlow {...props} />
    </Profiler>
  )
}
```

### Performance Benchmarks to Watch

```typescript
// Expected performance targets
const PERFORMANCE_TARGETS = {
  fps: {
    good: 60,      // Smooth
    acceptable: 30, // Usable
    poor: 15       // Laggy
  },
  renderTime: {
    good: 16,      // < 1 frame at 60fps
    acceptable: 33, // < 1 frame at 30fps
    poor: 50       // Noticeable lag
  },
  nodeCount: {
    phase1: 20,    // Initial mock data
    phase2: 100,   // Expected user projects
    phase3: 500    // Power users
  }
}
```

### Why Performance Monitoring

1. **Validate virtualization** - Confirm `onlyRenderVisibleElements` works
2. **Animation tuning** - Ensure 60fps during pan/zoom
3. **Catch regressions** - Notice if new features slow things down
4. **User debugging** - Power users can report FPS issues
5. **Dev confidence** - See concrete proof of performance

### Action Item

Add dev-only performance overlay with FPS + node count.

---

## Complete Mock Data Structure

```typescript
// mock-data.ts - Final version
export const MOCK_CANVAS = {
  nodes: [
    { id: '1', title: '🎯 Initial Idea', position: { x: 100, y: 100 }, ... },
    { id: '2', title: '📋 Requirements', position: { x: 500, y: 100 }, ... },
    { id: '3', title: '🏗️ Tech Stack', position: { x: 100, y: 300 }, ... },
    { id: '4', title: '🗄️ Database', position: { x: 500, y: 300 }, ... },
    { id: '5', title: '⚛️ Components', position: { x: 100, y: 500 }, ... },
    { id: '6', title: '🔐 Auth', position: { x: 500, y: 500 }, ... },
    { id: '7', title: '🐛 Bug Fix', position: { x: 300, y: 700 }, ... },
    { id: '8', title: '⚡ Performance', position: { x: 700, y: 700 }, ... }
  ],
  edges: [
    { id: 'e1', source: '1', target: '2', label: 'leads to' },
    { id: 'e2', source: '2', target: '3', label: 'informs' },
    { id: 'e3', source: '2', target: '4', label: 'defines' },
    { id: 'e4', source: '3', target: '5', label: 'framework' },
    { id: 'e5', source: '4', target: '6', label: 'requires' },
    { id: 'e6', source: '5', target: '7', label: 'bug found' },
    { id: 'e7', source: '4', target: '8', label: 'scaling' }
  ]
}
```

---

## Files to Create

```
/src/
  ├── constants/
  │   ├── zIndex.ts           # Z-index layering system
  │   ├── layout.ts           # Layout constants
  │   ├── storage.ts          # Storage constants
  │   └── shortcuts.ts        # Keyboard shortcuts
  ├── utils/
  │   └── layoutGenerator.ts  # Grid + randomness algorithm
  ├── lib/
  │   └── storage.ts          # Versioned persistence manager
  ├── types/
  │   └── storage.ts          # PersistedState interface
  ├── config/
  │   ├── fonts.ts            # Font family mappings
  │   ├── languages.ts        # Language detection + direction
  │   └── performance.ts      # React Flow optimization settings
  ├── components/
  │   ├── ErrorBoundary.tsx
  │   ├── ErrorBoundary.module.css
  │   ├── ConversationCard.tsx          # With handles and metadata
  │   ├── ConversationCard.module.css
  │   ├── CustomConnectionLine.tsx      # Enhanced feedback
  │   ├── CustomControls.tsx            # Fit view button
  │   ├── PerformanceMonitor.tsx        # Dev-only FPS overlay
  │   └── PerformanceMonitor.module.css
  ├── utils/
  │   ├── layoutGenerator.ts            # Grid + randomness algorithm
  │   └── formatters.ts                 # formatRelativeTime, truncate
  ├── hooks/
  │   └── useKeyboardShortcuts.ts
  └── styles/
      └── canvas.css                    # Connection animations

/__tests__/
  ├── lib/
  │   └── storage.test.ts
  ├── utils/
  │   └── layoutGenerator.test.ts
  └── constants/
      └── zIndex.test.ts

/
├── vitest.config.ts
└── package.json
```

## Key Constants

```typescript
// constants/zIndex.ts
export const Z_INDEX = {
  CANVAS_BACKGROUND: 0,
  EDGES: 1,
  CARD_COLLAPSED: 10,
  CARD_HOVER: 20,
  CARD_EXPANDED: 100,
  CARD_DRAGGING: 1000,
  MODAL_OVERLAY: 10000
} as const

// constants/layout.ts
export const LAYOUT = {
  CARD_WIDTH: 300,
  CARD_HEIGHT: 120,
  GRID_COLS: 4,
  SPACING_X: 400,
  SPACING_Y: 200,
  RANDOMNESS: 30
} as const

// constants/storage.ts
export const STORAGE_VERSION = 1
export const STORAGE_KEY = 'projectloom_state'

// constants/shortcuts.ts
export const PHASE_1_SHORTCUTS = {
  Delete: 'Delete selected card(s)',
  Escape: 'Collapse expanded cards and clear selection'
} as const

// React Flow config
const connectionLineStyle = {
  stroke: '#fbbf24',
  strokeWidth: 2
}

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#667eea', strokeWidth: 2 }
}
```

---

## Dependencies

```json
{
  "dependencies": {
    "reactflow": "^11.11.0",
    "franc-min": "^6.2.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "react-syntax-highlighter": "^15.5.0"
  },
  "devDependencies": {
    "@types/react-syntax-highlighter": "^15.5.0"
  }
}
```

---

## Summary

| Feature | Phase 1 Status |
|---------|----------------|
| **Context Inheritance** | Design docs only |
| **AI Providers** | Mock data only |
| **Visual Polish** | Core interactions |
| **Edge Styling** | Simple curves |
| **Card Interaction** | Inline expansion |
| **Mock Data** | Realistic, diverse from day 1 |
| **Card Expansion** | Manual control, overlays allowed |
| **RTL + Fonts** | Auto-detect + font mapping |
| **Virtualization** | Enable from day 1 |
| **Z-Index** | Float expanded cards (z-index: 100) |
| **Initial Layout** | Grid + 30px randomness |
| **Storage Version** | Add version field from day 1 |
| **Edge Creation** | Click-and-drag (React Flow native) |
| **Shortcuts** | Delete + Escape only |
| **Error Boundary** | Wrap Canvas + Sidebar |
| **Theme** | Dark-only (product identity) |
| **Deployment** | Platform-agnostic Next.js |
| **Testing** | Critical logic only (storage + layout) |
| **Connection Feedback** | Dashed amber line + glowing endpoint |
| **Card Metadata** | Timestamp + message count badge |
| **Initial Viewport** | fitView() on mount with padding |
| **Mock Connections** | Story-driven project narrative (8 conversations) |
| **Card Colors** | Single scheme (navy/violet/amber) |
| **Performance Monitor** | Dev-only overlay with FPS + stats |
