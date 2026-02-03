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
