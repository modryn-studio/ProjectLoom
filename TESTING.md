# ProjectLoom Phase 1 Testing Guide

Quick manual test checklist to verify core functionality.

## Setup

```bash
npm run dev
# Open http://localhost:3000
```

## Test Checklist

### 1. Canvas Interaction (React Flow)
- [ ] **Pan**: Click and drag on empty canvas space → canvas moves
- [ ] **Zoom**: Mouse wheel → canvas zooms in/out
- [ ] **Minimap**: Bottom-right corner shows minimap with small rectangles (representing cards)
- [ ] **Controls**: Bottom-left corner has zoom controls (+, -, fit view)

### 2. Conversation Cards
- [ ] **Visible**: 10 conversation cards appear on canvas
- [ ] **Hover**: Hover over card → elevation effect (shadow increases)
- [ ] **Click to Expand**: Click card → expands inline showing all messages
- [ ] **Click to Collapse**: Click expanded card → collapses back to summary
- [ ] **Language Detection**: Cards show appropriate fonts:
  - English: Geist Sans
  - Arabic: Noto Sans Arabic (RTL text)
  - Japanese: Noto Sans JP
  - Russian: Noto Sans

### 3. Selection & Multi-Select
- [ ] **Single Select**: Click card → border turns gold (`#EDC55C`)
- [ ] **Multi-Select**: Ctrl+Click multiple cards → all selected cards have gold border
- [ ] **Click Empty Space**: Click canvas → all selections clear

### 4. Keyboard Shortcuts
- [ ] **Delete**: Select card(s) → Press `Delete` or `Backspace` → cards disappear
- [ ] **Escape**: Select card(s) → Press `Escape` → selection clears
- [ ] **Undo**: Press `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (Mac) → card reappears
- [ ] **Redo**: Press `Ctrl+Y` or `Ctrl+Shift+Z` (Windows/Linux) or `Cmd+Shift+Z` (Mac) → card disappears again

### 5. Mock Data
- [ ] **Variety**: Cards show different conversation types:
  - Code reviews
  - Technical explanations
  - Language learning
  - Creative writing
  - International languages
- [ ] **Edges**: Lines connect related conversations (branching)

### 6. Persistence (localStorage)
- [ ] **Save State**: Delete a card → refresh page → card stays deleted
- [ ] **Pan Position**: Pan canvas → refresh page → position maintained
- [ ] **Zoom Level**: Zoom in/out → refresh page → zoom level maintained
- [ ] **Selection**: (not persisted) Select card → refresh → selection clears ✓

### 7. Load Mock Data
- [ ] **Reset**: Open DevTools Console → run `useCanvasStore.getState().loadMockData()`
- [ ] **Verify**: All 10 cards reappear with default layout

### 8. Visual Polish
- [ ] **Dark Theme**: Entire app uses dark theme (`#0A0A0A` background)
- [ ] **Typography**: Clean fonts (Geist Sans, Geist Mono)
- [ ] **Animations**: Card expansion animates smoothly (Framer Motion)
- [ ] **Z-Index**: Selected cards appear above others

### 9. Performance
- [ ] **Smooth Pan/Zoom**: No lag when navigating canvas
- [ ] **Quick Expansion**: Card expand/collapse is instant
- [ ] **No Console Errors**: Check browser DevTools → no React warnings

## Expected Behavior Summary

**Default State**: 10 conversation cards in grid layout, canvas centered
**Interactions**: Pan, zoom, select, expand, delete all work smoothly
**Persistence**: Canvas state (nodes, edges, viewport) saves to localStorage automatically
**Mock Data**: Can reset to default state via `loadMockData()`

## Quick Reset

To restore default state:
```js
// In browser console
localStorage.clear()
location.reload()
```
