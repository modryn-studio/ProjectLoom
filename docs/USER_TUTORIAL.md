# ProjectLoom User Tutorial

> **Version:** v4.2.0 (Phase 2 Complete)  
> **Last Updated:** February 6, 2026  
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
- Three-panel layout: left sidebar, center canvas, right area (for chat panel)
- Infinite dark navy canvas with dot grid background
- 10 mock conversation cards arranged in a tree
- Minimap in bottom-right corner
- Controls (zoom/fit) in bottom-left corner
- Performance overlay (dev mode only) on right side

### 1.2 Configure API Keys (Required for AI Responses)

**ProjectLoom uses BYOK (Bring Your Own Key) for AI providers:**

1. **Open Settings** - Click the gear icon (⚙️) in the bottom-right corner
2. **Navigate to API Keys tab**
3. **Add your API key(s):**
   - **Anthropic (Claude):** Get from [console.anthropic.com](https://console.anthropic.com)
   - **OpenAI (GPT):** Get from [platform.openai.com](https://platform.openai.com)
   - You need at least one provider key to use AI chat
4. **Save:** Keys are stored locally in your browser (localStorage)
5. **Close Settings**

**Security Notes:**
- Your API keys are stored locally in your browser only
- Keys are never sent to ProjectLoom servers
- Keys are obfuscated (but not encrypted) in localStorage
- For production, use environment variables (see docs)

**First-Time Setup Flow:**
- If you try to send a message without API keys, you'll see a warning banner
- Click "Configure API Keys" to open the setup modal
- Add at least one provider key to continue

### 1.3 Basic Navigation

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

**View full conversation:**
- **Click any card** to open the **right chat panel**
- The panel slides in from the right side
- Shows full message history with scrollable thread
- **Resizable:** Drag the left edge to resize (400-800px)
- **Close:** Press `Escape` or click the X button

**What you'll see in the chat panel:**
- Header with conversation title, model selector, and indicators
- Scrollable message thread (user messages on right, AI on left)
- Message input at bottom with "Type a message..." placeholder
- Branch button to create branches from current conversation

**Model selection:**
- Click the model dropdown in the chat panel header
- Choose from available models:
  - **Anthropic Claude:** Opus 4 (Premium), Sonnet 4 (Balanced), Haiku 4 (Efficient)
  - **OpenAI:** GPT-4o (Premium), GPT-4o Mini (Efficient)
- Each model shows cost tier badge and context window size
- Model is saved per conversation (different cards can use different models)

**Sending messages:**
- Type in the message input at the bottom
- Press **Ctrl+Enter** to send (or click the send button)
- AI responds with streaming text (watch it appear in real-time!)
- Click **Stop** button during generation to cancel
- Model badge shows which AI generated each response

**Attaching images (Vision support):**
- Click the **paperclip icon** (📎) when using vision-capable models (Claude Opus/Sonnet/Haiku 4, GPT-4o, GPT-4o Mini)
- Select up to 3 images (PNG, JPEG, WebP, GIF, max 5MB each)
- Thumbnail previews appear above the input
- Click **X** on thumbnail to remove
- Send with or without text - images are included in AI context
- AI can analyze, describe, and answer questions about images

**Hover over messages in the panel:**
- A **branch icon** (🌿) appears on each message
- Click to branch from that specific message

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
- New card appears to the right on canvas
- **Amber edge** connects parent → child
- New card has a **🌿 GitBranch icon**
- Chat panel switches to the new conversation
- Undo toast appears
- New card is auto-selected with amber border

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

**Method 3: Multi-Select and Create Merge (With Per-Parent Control)**

1. **Select multiple cards** (Shift+Click or Ctrl+A)
2. Right-click → "Create merge node from selection"
3. **Merge Node Creator dialog appears** with per-parent controls:
   - Each selected card shown with its title and message count
   - Toggle **"📄 Full"** / **"📝 Summary"** for each parent independently
   - When switching to Summary mode, AI generates a summary on-demand
   - Cost estimate shown during summary generation
   - Loading spinner per parent during generation
4. Click **"Create Merge Node"** to finalize
5. New merge node created with configured inheritance modes per parent

**Per-Parent Inheritance Benefits:**
- Use Full context for critical parents, Summary for background context
- Reduces token costs while preserving key information
- Each parent can have different treatment based on importance

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
| **Enter** or **Space** | Open chat panel for selected card | Panel slides in from right |
| **Ctrl+B / ⌘+B** | Branch from selected card | Opens branch dialog |
| **Ctrl+Enter / ⌘+Enter** | Send message | Only works when typing in chat panel |
| **Delete** | Delete selected card | Removes card, shows undo toast |
| **Escape** | Close chat panel, then deselect | Two-stage behavior |
| **Ctrl+Z / ⌘+Z** | Undo | Restores last action |
| **Ctrl+Shift+Z / ⌘+Shift+Z** | Redo | Re-applies undone action |
| **+** / **-** | Zoom in/out | Smooth zoom animation |
| **Ctrl+0 / ⌘+0** | Fit all cards in view | Pans and zooms to show everything |
| **Ctrl+1 / ⌘+1** | Reset zoom to 100% | Returns to default zoom level |
| **Ctrl+A / ⌘+A** | Select all cards | Multi-select all visible cards |
| **Ctrl+F / ⌘+F** | Open canvas search | Search across titles/messages |
| **Ctrl+L / ⌘+L** | Auto-layout suggestions | Organize overlapping cards |
| **?** | Show keyboard shortcuts panel | View all shortcuts organized by category |

**Escape key behavior test:**
1. Click a card to open chat panel
2. Press Escape → chat panel closes
3. Press Escape again → card deselects

### 5.2 Keyboard Shortcuts Panel

**View all available shortcuts:**

1. Press **?** (question mark key)
2. **Shortcuts panel appears** (centered modal)
3. Organized by category:
   - Navigation (N, Enter, Escape)
   - Editing (Ctrl+B, Delete, Undo/Redo)
   - View (+/-, Ctrl+0, Ctrl+1)
   - Selection (Ctrl+A)
   - Search & Help (Ctrl+F, Ctrl+L, ?)

**Panel features:**
- Platform-aware (shows Cmd on Mac, Ctrl on Windows)
- Searchable/scannable layout
- Close with Escape or click backdrop

**Pro tip:** Keep this open while learning to reference shortcuts quickly!

### 5.3 Multi-Select System

**Select multiple cards at once:**

**Method 1: Shift+Click**
1. Click first card (selects it)
2. Hold **Shift** and click another card
3. Both cards are now selected (amber borders)
4. Continue Shift+clicking to add more

**Method 2: Drag Selection Box**
1. Click and drag on **empty canvas space**
2. Selection box appears (dashed rectangle)
3. All cards inside box when you release = selected

**Method 3: Select All**
- Press **Ctrl+A** to select all cards in workspace

**What you can do with multi-select:**
- **Bulk delete:** Press Delete → confirmation shows count ("Delete 5 conversations?")
- **Visual indicator:** Breadcrumb shows "X selected" badge
- **Deselect:** Click empty canvas or press Escape

**Test it:**
1. Shift+click 3 cards
2. Look at breadcrumb → "3 selected" badge appears
3. Press Delete → "Delete 3 conversations?" confirmation
4. Click Cancel (don't actually delete)
5. Press Escape → all deselected

### 5.4 Canvas Search

**Find cards across entire workspace:**

1. Press **Ctrl+F** (or ⌘+F on Mac)
2. **Search panel appears** at top-center of canvas
3. Type your query (e.g., "database" or "authentication")
4. **Results appear instantly** with:
   - Match count (X/Y)
   - Card titles
   - Match type badges (title/message/branchReason)
   - Highlighted snippets showing context

**Navigate results:**
- **Arrow keys** (↑/↓) to move between results
- **Enter** to jump to selected result
- **Canvas auto-pans** to show the card
- **Card is selected** after jumping

**Close search:**
- Press **Escape**
- Click outside the panel

**Search features:**
- Case-insensitive
- Partial matches work
- Searches card titles, message content, and branch reasons
- Real-time results (no submit button needed)

**Test it:**
1. Press Ctrl+F
2. Type "testing" or "mock"
3. See results populate
4. Use arrow keys to navigate
5. Press Enter to jump to first match
6. Press Escape to close search

### 5.5 Auto-Layout Organization

**Automatically organize overlapping cards:**

1. Create several cards and move them to overlap
2. Press **Ctrl+L** (or ⌘+L on Mac)
3. **Cards reorganize** using tree layout algorithm
4. **Success toast appears:** "Organized X cards"

**What happens:**
- Cards arranged by hierarchy (parent-child relationships)
- Overlaps minimized
- Tree structure becomes visible
- Respects existing relationships

**If cards are already well-organized:**
- Toast shows: "Cards are already well organized!"
- No changes made

**Layout algorithms used:**
1. **Tree layout** (primary) - Respects parent-child hierarchy
2. **Grid layout** (fallback) - If no hierarchy detected
3. **Spread layout** (alternative) - Pushes overlapping cards apart

**Test it:**
1. Drag 4-5 cards to overlap in center of canvas
2. Press Ctrl+L
3. Watch cards smoothly reorganize
4. Check toast notification for result

### 5.6 Merge Node Toast Warnings

**Real-time feedback when creating merge nodes:**

**At 3 parents:**
- **Warning toast** (🟡 amber) appears
- Message: "Adding source 3/5. Complex merges may reduce AI response quality."
- Auto-dismisses after 5 seconds
- Can dismiss manually by clicking X

**At 5 parents (maximum):**
- **Error toast** (🔴 red) appears
- Message: "Merge node limit reached (5 sources). Consider intermediate merge nodes."
- Includes **"Learn More"** button
- Click button → opens Hierarchical Merge Dialog

**Hierarchical Merge Dialog:**
- Shows visual example of good vs bad merge patterns
- **Bad pattern:** 6 sources → 1 merge (too complex)
- **Good pattern:** Group sources → intermediate merges → final synthesis
- Educational guide to help you structure better

**Test the warning system:**
1. Find or create a merge node with 2 parents
2. Add a 3rd parent → warning toast appears
3. Add 4th parent → edges bundle, another warning
4. Add 5th parent → error toast with "Learn More"
5. Click "Learn More" → dialog shows hierarchical pattern
6. Try to add 6th parent → connection blocked

### 5.7 Undo/Redo System

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

### 5.8 Settings Panel

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

### 5.9 Canvas Tree Sidebar Features

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

### 5.10 Inherited Context Panel

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

## Part 7: Language Support & Visual Design

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

## Part 8: Next Steps

**You've completed the tutorial! 🎉**

You now understand:
- ✅ API key setup and model selection
- ✅ Real-time streaming AI chat
- ✅ Canvas navigation and card management
- ✅ Branching from messages and cards
- ✅ Context inheritance modes
- ✅ Merge nodes and DAG structures
- ✅ Keyboard shortcuts and settings

**Ready to level up?**

👉 **See [BEST_PRACTICES.md](BEST_PRACTICES.md)** for:
- AI model selection strategies (when to use each model)
- Cost optimization tips (start efficient, scale up)
- Strategic workflow patterns (decision-making, parallel exploration)
- Optimization tips and efficiency hacks
- When to branch vs. merge vs. continue
- Multi-workspace organization strategies
- Advanced keyboard flows

---

## Troubleshooting Common Issues

### "No API key configured"
- **Cause:** Need to add API keys first
- **Solution:** Settings → API Keys → Add Anthropic or OpenAI key

### "AI not responding"
- **Cause:** Invalid API key or network error
- **Solution:** Check Settings → API Keys, verify key is correct

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

## Additional Resources

**Phase 2 AI Integration (Completed):**
- ✅ Real AI integration with streaming responses
- ✅ Claude (Anthropic) and OpenAI support
- ✅ BYOK (Bring Your Own Key) security model
- ✅ Real-time model switching
- ✅ API key management

**Phase 2 Features (All Complete):**
- ✅ Real AI integration with streaming responses (Week 1-2)
- ✅ Claude (Anthropic) and OpenAI support (Week 1-2)
- ✅ Context inheritance for branching (Week 3)
- ✅ Auto-generated summaries for long conversations (Week 4)
- ✅ Multi-parent merge with per-parent inheritance modes (Week 4)
- ✅ Agent workflows with tool calling (Week 5)
- ✅ Vision support with image attachments (Must-Have #5)

**Documentation:**
- **[BEST_PRACTICES.md](BEST_PRACTICES.md)** - Strategic patterns and optimization
- **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** - Latest features and status
- **architecture.md** - Technical deep dive
- **PERFORMANCE_OPTIMIZATIONS.md** - Performance insights
- **GitHub issue #5** - Complete v4 specification

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
- Click card → Open chat panel
- Click model dropdown → Select AI model
- Type in message input → Draft message
- Press send button → Send to AI
- Right-click card → Context menu
- Drag from handle → Create connection
- Hover message (in chat panel) → Show branch icon
- Click branch icon → Inline branch panel
- Drag chat panel left edge → Resize panel

KEYBOARD SHORTCUTS
N               New conversation
Enter / Space   Open chat panel
Ctrl+B / ⌘+B    Branch from card
Ctrl+Enter      Send message (in chat panel)
Delete          Delete selected
Escape          Close chat then deselect
Ctrl+Z          Undo
Ctrl+Shift+Z    Redo
Ctrl+F          Canvas search
Ctrl+L          Auto-layout
?               Keyboard shortcuts help
F2              Rename workspace

VISUAL INDICATORS
🌿 GitBranch    Branched card
⚡ Zap          Merge node
Amber border    Selected or active in chat
Green border    Merge (2 parents)
Thick amber     Open in chat panel
Amber+⚠️        Merge (3-4 parents)
Red+⚠️          Merge (5 parents, max)
Model badge     Shows which AI generated each message
```

---

**Happy branching! 🎨🚀**
