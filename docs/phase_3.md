# Phase 3 (Week 5-6)

**Status: Advanced features and refinements**

## 1. Card Expansion - Auto-Layout Suggestions

**Status: "Suggest Layout" feature**

### Implementation - Smart Overlap Detection

```typescript
// "Suggest Layout" can clean up overlaps
function suggestLayout(nodes: Node[]) {
  // Detect overlapping expanded cards
  const overlaps = detectOverlaps(nodes)
  
  if (overlaps.length > 0) {
    return {
      type: 'suggestion',
      message: '3 cards are overlapping. Organize automatically?',
      preview: calculateOptimalPositions(nodes)
    }
  }
}
```

### Rationale

- Phase 3: Add intelligent layout suggestions after core UX is validated
- User maintains control but gets helpful automation when needed
- Non-intrusive suggestion system rather than forced auto-layout

---

## 2. Keyboard Shortcuts - Advanced

**Status: Full keyboard navigation system**

### Phase 3 Implementation - Advanced Features

```typescript
const PHASE_3_SHORTCUTS = {
  // Phase 1 basics
  Delete: 'Delete selected card(s)',
  Escape: 'Collapse/deselect',
  
  // Navigation
  'Arrow Keys': 'Navigate between cards',
  'Tab': 'Cycle through cards',
  
  // Actions
  'Cmd/Ctrl+B': 'Branch from selected card',
  'Cmd/Ctrl+D': 'Duplicate card',
  'Cmd/Ctrl+F': 'Search canvas',
  'Cmd/Ctrl+Z': 'Undo',
  'Cmd/Ctrl+Shift+Z': 'Redo',
  
  // View
  'Cmd/Ctrl+0': 'Fit all cards in view',
  'Cmd/Ctrl+1': 'Zoom to 100%',
  '+/-': 'Zoom in/out',
  
  // Selection
  'Cmd/Ctrl+A': 'Select all cards',
  'Shift+Click': 'Multi-select',
  
  // Layout
  'Cmd/Ctrl+L': 'Suggest layout',
  'Space+Drag': 'Pan canvas'
}
```

### Keyboard Shortcuts Panel

```typescript
// components/KeyboardShortcutsPanel.tsx
function KeyboardShortcutsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        setIsOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
      <h2>Keyboard Shortcuts</h2>
      <dl>
        {Object.entries(SHORTCUTS).map(([key, description]) => (
          <div key={key}>
            <dt><kbd>{key}</kbd></dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
```

### Rationale

- Advanced shortcuts require more state management (undo/redo, search, etc.)
- Defer complexity until core UX is validated
- Power users will appreciate comprehensive shortcuts in Phase 3

---

## Future Considerations (Phase 4+)

### Alternative Dark Themes

**Status: Optional - IF users demand it**

```typescript
// IF users demand it, add limited theme support
const THEMES = {
  // Primary theme - our design
  dark: {
    background: '#1a1d2e',
    primary: '#667eea',
    accent: '#fbbf24'
  },
  // Alternative dark theme only
  midnight: {
    background: '#0a0e1a',
    primary: '#818cf8',
    accent: '#f59e0b'
  }
  // NO LIGHT MODE - doesn't fit the product
}
```

### Vercel-Specific Features

**Status: Consider ONLY if clear performance benefit**

```typescript
// Phase 3+ - ONLY if there's a clear performance benefit
export const runtime = 'edge'  // For global low-latency

// ISR - Not needed for client-side canvas app
export const revalidate = 60  // Skip this entirely

// Vercel AI SDK - Maybe Phase 2 for streaming
import { useChat } from 'ai/react'  // Consider for AI providers
```

---

## Additional Content

*This document will be populated with more Phase 3 details when provided.*
