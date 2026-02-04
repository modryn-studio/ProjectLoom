# Card-Level Branching: Future Features

> **Reference:** See GitHub Issue #5 (comment #2) "Revised Implementation Plan: Card-Level Branching & Multi-Parent Merging" - Phase 3+ section for the comprehensive future roadmap.

## **Phase 3+ Features (From Spec)**

### **Tiered Context System**
**Priority:** High (performance)  
**Description:** Auto-summarize historical messages when context exceeds token limits

```typescript
interface TieredContext {
  essential: Message[]      // Most recent 10 messages
  summary: string          // AI-generated summary of older messages
  full: Message[]          // Complete history (loaded on demand)
  totalMessageCount: number
}

// When preparing context for AI request
function prepareContextForAI(card: Conversation): Message[] {
  const totalMessages = getTotalInheritedMessages(card)
  
  if (totalMessages < 50) {
    return card.inheritedContext.full  // Send everything
  } else {
    return [
      { role: 'system', content: card.inheritedContext.summary },
      ...card.inheritedContext.essential
    ]
  }
}
```

**Benefit:** Prevents token blowups with large merge nodes (5 parents × 20 messages = 100+ messages)

---

### **Edge Virtualization**
**Priority:** Medium (performance)  
**Description:** Only render edges for cards visible in viewport

```typescript
// Only render edges for visible cards
const visibleEdges = edges.filter(edge => {
  const sourceVisible = isCardInViewport(edge.source, viewport)
  const targetVisible = isCardInViewport(edge.target, viewport)
  return sourceVisible || targetVisible
})
```

**Benefit:** Improves performance for canvases with 100+ cards and 150+ edges

---

### **Level of Detail (LOD)**
**Priority:** Medium (performance)  
**Description:** Simplify visual complexity when zoomed out

```typescript
// Simplified edges when zoomed out
const edgeStyle = zoom < 0.5 
  ? { strokeWidth: 1, animated: false }  // Simple line
  : { strokeWidth: 2, animated: true, showLabel: true }  // Full detail
```

**Benefit:** Reduces visual noise and improves rendering performance at different zoom levels

---

### **Collaborative Features**
**Priority:** Low (future product direction)  
**Description:** Multi-user editing with conflict resolution

- Real-time presence indicators
- Card-level locks during editing
- Merge conflict resolution UI
- Activity feed showing who branched/merged what

**Benefit:** Enables team collaboration on complex conversation trees

---

### **Advanced Merge Algorithms**
**Priority:** Low (AI quality)  
**Description:** Smart context selection and relevance scoring

- Automatically detect which parent messages are most relevant
- Score messages by semantic similarity to user's query
- Suggest which parents to include/exclude before synthesis
- Adaptive summarization based on detected themes

**Benefit:** Improves AI response quality for complex multi-source merges

---

## **Additional Feature Ideas**

### **Cross-workspace references**

**Description:** Allow linking cards across workspaces

```typescript
// Allow linking cards across workspaces
interface CrossWorkspaceReference {
  fromCardId: string
  fromCanvasId: string
  toCardId: string
  toCanvasId: string
  note?: string  // "See database discussion in Main Project"
}
```

---

*Add additional future feature ideas here as they come up*
