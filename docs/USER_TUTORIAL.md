# ProjectLoom User Tutorial

> **Version:** v4.0.0  
> **Last Updated:** February 4, 2026  
> **Time to Complete:** 15-20 minutes  
> **Prerequisites:** None - starts with mock data

---

## Welcome to ProjectLoom! 🎨

This tutorial will walk you through all features of ProjectLoom, including the brand-new **v4 card-level branching system** with merge nodes and DAG support. By the end, you'll understand how to organize AI conversations spatially, branch from any message, and merge multiple conversation threads.

---

## Part 1: Getting Started (5 min)

### 1.1 Launch the Application

```bash
npm run dev
```

Open your browser to `http://localhost:3000`

**What you'll see:**
- Infinite dark navy canvas with dot grid background
- 10 mock conversation cards arranged in a tree
- Minimap in bottom-right corner
- Controls (zoom/fit) in bottom-left corner
- Performance overlay (dev mode only) on right side

### 1.2 Basic Navigation

**Try these interactions:**

| Action | How to Do It | What Happens |
|--------|-------------|--------------|
| **Pan canvas** | Click + drag on empty space | Canvas moves smoothly |
| **Zoom in/out** | Scroll wheel | Canvas zooms, cards scale |
| **Fit view** | Click "fit view" button (bottom-left) | All cards visible with padding |
| **Reset zoom** | Click "1:1" button | Returns to 100% zoom |

**Performance check:** Open the dev overlay (right side). It should show **60 FPS** during all interactions.

### 1.3 Canvas Tree Sidebar

**Open the sidebar:**
- Look for the **folder icon** in the top-left corner
- Click it to reveal the Canvas Tree Sidebar

**What you'll see:**
- "Main Workspace" with expand/collapse chevron
- Tree structure showing parent-child relationships
- Icons indicating card types:
  - 💬 Normal cards
  - 🌿 Branched cards (amber border in tree)
  - ⚡ Merge nodes (green/amber/red based on parent count)

**Try this:**
- Click on any card in the tree → it gets selected on canvas
- Expand/collapse the workspace tree

---

## Part 2: Working with Cards (5 min)

### 2.1 Select and View Cards

**Select a card:**
- Click on any card → it gets an amber border
- Look at the **breadcrumb** at the top (shows current selection)

**Expand a card:**
- **Double-click** the card, OR
- Press **Space** while card is selected

**What you'll see:**
- Card expands to show full message history
- Smooth animation (width increases to 480px)
- User messages on the right (dark background)
- Assistant messages on the left

**Hover over messages:**
- A **branch icon** (🌿) appears on the left/right of each message
- This lets you branch from any specific message

### 2.2 Card Visual Indicators

Look for these visual cues on cards:

| Indicator | Meaning |
|-----------|---------|
| 🌿 **GitBranch icon** (top-left) | This card was branched from a parent |
| ⚡ **Zap icon** (top-left) | This is a merge node (multiple parents) |
| **Amber border** | Branched card |
| **Green border** | Merge node with 2 parents (healthy) |
| **Amber border + ⚠️** | Merge node with 3-4 parents (complex) |
| **Red border + ⚠️** | Merge node with 5 parents (max limit) |
| **Number badge** | Message count or parent count (for merge nodes) |

### 2.3 Context Menu Actions

**Right-click on any card:**
- "Branch from here" - Creates a branch (we'll cover this next!)
- "Expand/Collapse" - Toggle card size
- "Delete" - Remove the card (can undo)

**Try deleting a card:**
1. Right-click → Delete
2. Watch the **undo toast** appear in bottom-right
3. Click "Undo" to restore it

---

## Part 3: Branching Workflow (5 min)

This is the **core v4 feature**! You can branch from any message in any card.

### 3.1 Quick Branch (Mouse Workflow)

**Create your first branch:**

1. **Expand a card** (double-click or Space)
2. **Hover over any message** → branch icon appears
3. **Click the branch icon** 🌿
4. **Inline panel appears** on the right side showing:
   - Branch settings
   - Inheritance mode selector (Full/Summary/Custom/None)
   - Message range slider
   - Branch reason input

**Configure the branch:**
- **Inheritance Mode:** Try "Full Context" (default)
- **Message Range:** Leave as default (all messages up to branch point)
- **Branch Reason:** Type "Testing branch workflow"
- Click **"Create Branch"**

**What happens:**
- New card appears to the right
- **Amber edge** connects parent → child
- New card has a **🌿 GitBranch icon**
- Undo toast appears
- New card is auto-selected

**Inspect the new card:**
1. Look for the "Inherited Context" panel at the top of the canvas
2. It shows the parent card and inherited messages
3. Click to expand/collapse the inherited context details

### 3.2 Keyboard Branch Workflow

**Try the keyboard shortcut:**

1. **Select a card** (click on it)
2. Press **Ctrl+B** (or **⌘+B** on Mac)
3. **Branch dialog appears** (centered modal)
4. Configure settings:
   - Choose inheritance mode
   - Select message index to branch from
   - Add branch reason
5. Click **"Create Branch"** or press **Enter**

**Settings panel shortcut:**
- If you want branches to **always ask** or **create instantly**, open Settings (gear icon bottom-right)
- Go to "Branching" tab
- Toggle "Always ask when branching"

### 3.3 Understanding Context Inheritance

**4 Inheritance Modes:**

| Mode | What Gets Inherited | Use Case |
|------|-------------------|----------|
| **Full Context** | All messages up to branch point | Maximum context for AI |
| **Summary** | AI-generated summary of context | Reduce token usage |
| **Custom** | User-selected specific messages | Surgical context control |
| **None** | Nothing (fresh start) | Start over with no history |

**Test different modes:**
- Create 2 branches from the same parent with different inheritance modes
- Notice how the inherited context panel shows different amounts of data

---

## Part 4: Merge Nodes (DAG Support) (5 min)

**v4's killer feature:** Merge multiple conversation threads into a synthesis node!

### 4.1 Create a Merge Node

**Method 1: Drag-to-Merge**

1. **Select a card** (Card A)
2. **Drag from the right handle** (small circle on right edge)
3. **Drop on another card** (Card B) that's **not a descendant** of Card A
4. If Card B is already a merge node with < 5 parents, it adds Card A as a parent
5. Watch the **emerald green edge** appear

**Method 2: Connect via Handles**

1. Click and drag from any card's **right handle**
2. Connect to another card's **left handle**
3. System detects if target should become a merge node

### 4.2 Merge Node Limits

ProjectLoom enforces these limits:

- **MAX_PARENTS: 5** - Hard limit (for AI quality)
- **WARNING_THRESHOLD: 3** - Amber warning starts here
- **BUNDLE_THRESHOLD: 4** - Edges bundle visually

**Test the limits:**

1. Find or create a merge node with 2 parents (green ⚡ icon)
2. Add a 3rd parent → icon turns **amber + ⚠️**
3. Add a 4th parent → edges **bundle together** with reduced opacity
4. Try to add a 6th parent → **rejected** with console warning

### 4.3 Merge Node Visual Feedback

**What you'll see on merge nodes:**

- ⚡ **Zap icon** (color changes with complexity)
- **Number badge** showing parent count
- **Thick emerald edges** (3px) from each parent
- **Bundled edges** at 4+ parents (all visible, opacity 0.6)
- **Tooltip** on badge: "⚠️ Complex merge (4 sources) - May reduce AI quality"

**Edge bundling behavior:**
- All edges still render (no hiding)
- Opacity reduced to 0.6
- First edge shows label: "4 sources"

### 4.4 Cycle Prevention

**Try creating a cycle:**

1. Create a branch: Card A → Card B
2. Try to connect Card B → Card A (backward)
3. **Blocked!** Console shows: "Cannot create circular dependency"

**System prevents:**
- Self-loops (card connecting to itself)
- Backward connections (child → parent)
- Any cycle in the DAG

---

## Part 5: Advanced Features (5 min)

### 5.1 Keyboard Shortcuts

**Test all shortcuts:**

| Shortcut | Action | What to Test |
|----------|--------|--------------|
| **N** | New conversation | Creates card at center or click position |
| **Space** | Expand/collapse selected card | Toggle card size |
| **Ctrl+B / ⌘+B** | Branch from selected card | Opens branch dialog |
| **Delete** | Delete selected card | Removes card, shows undo toast |
| **Escape** | Collapse expanded card, then deselect | Two-stage behavior |
| **Ctrl+Z / ⌘+Z** | Undo | Restores last action |
| **Ctrl+Shift+Z / ⌘+Shift+Z** | Redo | Re-applies undone action |

**Escape key behavior test:**
1. Expand a card (Space)
2. Press Escape → card collapses
3. Press Escape again → card deselects

### 5.2 Undo/Redo System

**Test the history:**

1. **Create a branch** → Undo toast appears
2. Click **"Undo"** in toast → branch disappears
3. Press **Ctrl+Z** → nothing (already undone)
4. Press **Ctrl+Shift+Z** → branch reappears
5. Delete a card → Undo toast appears
6. Press **Ctrl+Z** → card restored

**History limits:**
- Last 50 actions are tracked
- Undo/redo survives page refresh (stored in localStorage)

### 5.3 Settings Panel

**Open settings (gear icon in bottom-right):**

**Display Tab:**
- Toggle Canvas Tree Sidebar
- Toggle Inherited Context Panel
- Toggle Minimap
- Toggle Dev Performance Overlay

**Branching Tab:**
- **Always ask when branching** - Opens dialog vs instant branch
- **Default inheritance mode** - What mode to use for instant branches
- **Show branch icons on hover** - Toggle message branch icons
- **Confirm before deleting** - Safety check

**Test settings:**
1. Turn off "Always ask when branching"
2. Set default to "Summary"
3. Press Ctrl+B on a card → instant branch with summary context
4. Turn setting back on

### 5.4 Canvas Tree Sidebar Features

**Advanced sidebar interactions:**

1. **Workspace Management:**
   - Right-click workspace → "Rename" or "Delete"
   - Press **F2** while workspace selected → rename mode
   
2. **Tree Navigation:**
   - Expand/collapse workspace tree
   - Click cards in tree to select on canvas
   - See merge nodes rendered under their **first sorted parent** (deterministic)

3. **Visual Indicators:**
   - 💬 Normal cards
   - 🌿 Branched cards (left amber border)
   - ⚡ Merge nodes (left green border)
   - Number badge on merge nodes

### 5.5 Inherited Context Panel

**When to see it:**
- Auto-shows when you select a card with parents
- Shows at top of canvas (pointer-events-auto overlay)

**What it shows:**
- Parent card titles (clickable to select parent)
- Inherited message count per parent
- Inheritance mode badge (Full/Summary/Custom/None)
- Expand/collapse to see full message details

**Test it:**
1. Select a branched card
2. Panel appears at top
3. Click on parent card title → parent gets selected
4. Click collapse button → panel minimizes

---

## Part 6: Performance Testing (Optional)

### 6.1 Dev Performance Overlay

**Monitor performance:**
- FPS should stay at **60** during all interactions
- Watch during:
  - Node dragging
  - Canvas panning
  - Zoom operations
  - Card expansion

**If FPS drops:**
- Check if you have 100+ cards (not typical for v4)
- Look for browser extensions causing overhead
- See PERFORMANCE_OPTIMIZATIONS.md for details

### 6.2 Storage Persistence

**Test data persistence:**

1. Create several branches
2. Move cards around
3. Refresh the page (F5)
4. Everything should be exactly where you left it

**Behind the scenes:**
- Debounced localStorage writes (300ms delay)
- Schema version 4
- Full state serialization

---

## Part 7: Visual Polish & Language Support

### 7.1 Language Detection

**Test multilingual support:**

1. Create a new card (press **N**)
2. Add message content with different languages:
   - Japanese: こんにちは
   - Arabic: مرحبا
   - Hebrew: שלום
   - Chinese: 你好
   - Korean: 안녕하세요

**What happens:**
- Font automatically switches to language-appropriate font
- Text direction adjusts (RTL for Arabic/Hebrew)
- Text alignment follows natural direction

### 7.2 Design System

**Notice the visual consistency:**

| Element | Color | Meaning |
|---------|-------|---------|
| Selected card border | `#f59e0b` (amber) | Active selection |
| Branch edge | `#f59e0b` (amber) | Parent → child |
| Merge edge | `#10b981` (emerald) | Source → merge node |
| Reference edge | `#8b5cf6` (violet, dashed) | Non-hierarchical link |
| Background | `#0a0e27` (navy) | Canvas base |
| Cards | `#141b3d` (navy-light) | Card background |

---

## Part 8: Real-World Workflow Example

### Complete Branching Scenario

Let's create a realistic project structure:

**Step 1: Find the root card**
- Look for "Project Requirements Gathering" (usually top-left)

**Step 2: Branch for exploration**
1. Expand the requirements card
2. Branch from the first message
3. Name it: "Explore tech stack options"
4. Use "Full Context" inheritance

**Step 3: Create parallel branches**
1. From the same parent, create another branch
2. Name it: "Explore design patterns"
3. Notice both branches share the same parent

**Step 4: Create a merge node**
1. Drag from "tech stack" card to "design patterns" card
2. "Design patterns" becomes a merge node with ⚡ icon
3. Both contexts are now merged

**Step 5: Continue the DAG**
1. Branch from the merge node
2. Name it: "Final architecture decision"
3. This card inherits context from TWO parents

**Result:** You've created a realistic decision-making flow where multiple exploration paths converge into a synthesis.

---

## Troubleshooting

### "I can't connect two cards"
- **Cause:** Would create a cycle
- **Solution:** Check if target is already an ancestor of source

### "Merge node won't accept more parents"
- **Cause:** Max 5 parents reached
- **Solution:** Create a hierarchical merge (merge → merge)

### "Inherited context panel not showing"
- **Cause:** Disabled in settings
- **Solution:** Open settings → Display → Enable "Show Inherited Context"

### "Performance is slow"
- **Cause:** Browser extensions, many tabs open
- **Solution:** Close other tabs, disable extensions, check dev overlay

### "Cards don't save positions"
- **Cause:** localStorage issue
- **Solution:** Check browser console for errors, clear localStorage and reload

---

## Next Steps

**You've mastered v4! 🎉**

**What's coming in Phase 3:**
- Live AI integration (Claude, OpenAI, Local LLMs)
- Real conversations within cards
- Auto-generated summaries
- AI-powered merge synthesis

**Want to dive deeper?**
- Read `architecture.md` for technical details
- Check `PERFORMANCE_OPTIMIZATIONS.md` for performance insights
- See GitHub issue #5 for the complete v4 specification

**Found a bug?**
- Check browser console for errors
- File an issue on GitHub
- Include steps to reproduce

---

## Quick Reference Card

```
MOUSE ACTIONS
- Click + drag canvas → Pan
- Scroll wheel → Zoom
- Double-click card → Expand/collapse
- Click card → Select
- Right-click card → Context menu
- Drag from handle → Create connection
- Hover message → Show branch icon
- Click branch icon → Inline branch panel

KEYBOARD SHORTCUTS
N               New conversation
Space           Expand/collapse
Ctrl+B / ⌘+B    Branch from card
Delete          Delete selected
Escape          Collapse then deselect
Ctrl+Z          Undo
Ctrl+Shift+Z    Redo
F2              Rename workspace

VISUAL INDICATORS
🌿 GitBranch    Branched card
⚡ Zap          Merge node
Amber border    Selected or branched
Green border    Merge (2 parents)
Amber+⚠️        Merge (3-4 parents)
Red+⚠️          Merge (5 parents, max)
```

---

**Happy branching! 🎨🚀**
