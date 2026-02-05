# ProjectLoom Best Practices & FAQ

> **Version:** v4.0.0  
> **Last Updated:** February 5, 2026  
> **For:** Users wanting to master efficient workflows
> **New to ProjectLoom?** Start with [USER_TUTORIAL.md](USER_TUTORIAL.md) for step-by-step feature learning

---

## 🎯 Quick Answers

### Interface & Navigation

**Q: How do I see all my conversation cards at once?**  
A: Click the **"fit view"** button (bottom-left) or use the minimap to pan around. The minimap shows your entire workspace.

**Q: Can I zoom in/out on specific areas?**  
A: Yes! Use **scroll wheel** to zoom. The canvas zooms toward your cursor position for precise control.

**Q: What's the sidebar toggle button in the breadcrumb bar?**  
A: The folder icon (top-left) shows/hides the Canvas Tree Sidebar. Click it to collapse the sidebar when you need more canvas space.

**Q: Why can't I see the workspace name in the breadcrumb?**  
A: The breadcrumb shows the workspace title when **no card is selected**. Select a card to see its ancestry path instead.

**Q: How do I view the full conversation for a card?**  
A: Click any card to open the **right chat panel** with the full conversation history. The panel is resizable (drag the left edge) and closes with Escape.

---

## 🌿 Branching Strategies

### When to Branch vs. Continue

**Branch when you want to:**
- Explore multiple approaches to the same problem
- Try different parameters/configurations without losing original
- Create "what-if" scenarios
- Preserve decision points for future reference

**Continue (don't branch) when:**
- The conversation is naturally evolving in one direction
- You're iterating on the same idea
- Previous messages are errors/false starts you want to replace

### Choosing Inheritance Modes

**Full Context** (default)
- ✅ Use when: New direction needs complete history
- ✅ Best for: Complex problems requiring all background
- ⚠️ Watch: Token usage grows with conversation length

**Summary** (future Phase 3 feature)
- ✅ Use when: Branch point is clear, but full history is long
- ✅ Best for: Reducing token costs on long conversations
- ⚠️ Watch: May lose subtle context

**Custom**
- ✅ Use when: Only specific messages are relevant
- ✅ Best for: Surgical extraction of key information
- ⚠️ Watch: Easy to miss important context

**None**
- ✅ Use when: Starting completely fresh
- ✅ Best for: Testing same prompt with zero bias
- ⚠️ Watch: No context means AI doesn't know prior work

---

## ⚡ Merge Node Best Practices

### Merge Warning System

ProjectLoom actively warns you about merge complexity:

**At 3+ parents:** 🟡 Warning toast appears
- "Adding source 3/5. Complex merges may reduce AI response quality."
- Badge turns amber, ⚠️ icon appears on card

**At 5 parents:** 🔴 Error toast with suggestion
- "Merge node limit reached (5 sources). Consider intermediate merge nodes."
- Click "Learn More" to see hierarchical merge dialog
- Badge turns red, card shows maximum complexity

**At 6+ parents:** 🚫 Connection blocked
- Cannot add more parents
- System suggests creating hierarchical merge pattern

### Optimal Merge Patterns

**2 Parents (Green ⚡ - Ideal)**
```
Option A ──┐
           ├─→ Decision
Option B ──┘
```
- Compare/contrast two approaches
- Evaluate trade-offs
- Make informed decisions
- Highest AI synthesis quality

**3-4 Parents (Amber ⚠️ - Complex)**
```
Approach A ──┐
Approach B ──┤
Approach C ──┼─→ Comprehensive Analysis
Approach D ──┘
```
- Multi-factor analysis
- Synthesizing diverse perspectives
- Requires well-structured parent conversations
- Quality depends on parent content clarity

**5 Parents (Red ⚠️ - Maximum)**
- Last resort only
- Consider hierarchical merges instead
- AI quality significantly degraded

### When NOT to Use Merge Nodes

❌ **Don't merge when:**
- Parents explore completely unrelated topics
- You just want to "collect" conversations
- Parents are sequential steps (use regular branching)
- More than 5 sources needed (use hierarchical approach)

✅ **Do merge when:**
- Synthesizing parallel explorations
- Combining complementary analyses
- Making multi-criteria decisions
- Evaluating trade-offs across options

### Hierarchical Merge Strategy

For 6+ conversation threads:
```
A ──┐
B ──┼─→ Group 1 ──┐
C ──┘             │
D ──┐             ├─→ Final Synthesis
E ──┼─→ Group 2 ──┘
F ──┘
```

Group related threads → merge groups → final synthesis

---

## ⚨ Workflow Tips

### Keyboard Power User

**Essential shortcuts:**
- `N` - New card (fastest way to start)
- `Enter` or `Space` - Open chat panel for selected card
- `Ctrl+B` - Branch from current card
- `Escape` - Close chat panel, then deselect (two-stage)
- `Ctrl+Enter` - Send message (when typing in chat panel)
- `Ctrl+Z` / `Ctrl+Shift+Z` - Undo/Redo

**View & Navigation:**
- `+` / `-` - Zoom in/out
- `Ctrl+0` - Fit all cards in view
- `Ctrl+1` - Reset zoom to 100%
- `Ctrl+F` - Search canvas (across titles, messages, branch reasons)
- `?` - Show keyboard shortcuts panel

**Selection & Organization:**
- `Ctrl+A` - Select all cards
- `Shift+Click` - Add card to selection (multi-select)
- `Ctrl+L` - Auto-layout (organize overlapping cards)

**Pro tip:** Use `Escape` twice to "dismiss" a card:
1. First press: closes chat panel
2. Second press: deselects card completely

### Multi-Select Operations

**Select multiple cards:**
- Hold `Shift` and click cards to add to selection
- Drag selection box on canvas (hold and drag on empty space)
- Press `Ctrl+A` to select all cards

**Bulk operations:**
- Delete multiple cards: Select → press `Delete` → confirm count
- Shows "X selected" badge in breadcrumb
- Confirmation dialog shows: "Delete X conversations?"

### Canvas Search

**Find cards quickly:**
- Press `Ctrl+F` to open search overlay (top-center)
- Type query → searches titles, messages, branch reasons
- Use `↑` / `↓` arrows to navigate results
- Press `Enter` to jump to result (auto-pans viewport)
- Shows match count (X/Y) and result snippets
- Press `Escape` to close search

**Search tips:**
- Partial matches work ("auth" finds "authentication")
- Case-insensitive by default
- Match type badges show where text was found (title/message/branchReason)
- Highlighted snippets show context around matches

### Auto-Layout Organization

**Organize overlapping cards:**
- Press `Ctrl+L` to trigger auto-layout
- System uses tree layout (respects parent-child hierarchy)
- Cards reorganized to minimize overlaps
- Success toast shows: "Organized X cards"
- If already optimal: "Cards are already well organized!"

**When to use:**
- After creating many branches
- When cards overlap and hard to read
- To see clean hierarchical structure
- Before taking screenshots/demos

### Message-Level Branching

**When expanded cards show branch icons:**
- Hover over any message to see branch icon (🌿)
- Click to open inline branching panel
- Branch from specific message, not just card-level

**Use case:** "That 3rd message was perfect, but the 4th went wrong → branch from message 3"

### Selection & Focus

**Sidebar click behavior:**
- Click card in tree → selects + centers card on canvas (smooth framing)
- Click workspace when collapsed → auto-expands to show contents
- Use breadcrumb to see ancestry path

**Canvas click behavior:**
- Click card → opens chat panel with full conversation
- Right-click → context menu
- Drag card → reposition on canvas

**Chat panel behavior:**
- Drag left edge → resize panel (400-800px)
- Click X or press Escape → close panel
- Type and press Ctrl+Enter → send message
- Amber border on canvas card → indicates active conversation

---

## 🎨 Organization Patterns

### Workspace Structure

**Single Workspace (Simple Projects)**
```
Main Workspace
├── Requirements Gathering
├── Tech Stack Exploration
│   ├── Frontend Options
│   └── Backend Options
└── Architecture Decision
```

**Multiple Workspaces (Complex Projects)**
```
Workspace: Backend
├── API Design
├── Database Schema
└── Performance

Workspace: Frontend
├── UI Components
├── State Management
└── Routing
```

### Naming Conventions

**Good card titles:**
- ✅ "Explore React vs Vue performance"
- ✅ "Database schema for user auth"
- ✅ "Fix: Login button not responding"

**Avoid:**
- ❌ "Conversation 1"
- ❌ "Testing"
- ❌ "Notes"

Descriptive titles help when scanning the tree sidebar.

### Decision-Making Workflow Pattern

**Parallel Exploration → Synthesis** (Advanced)

This pattern demonstrates strategic decision-making using branching + merge:

**Step 1: Establish the decision point**
- Start with requirements/problem definition card
- Example: "Project Requirements Gathering"

**Step 2: Create parallel exploration branches**
```
Requirements
├─→ Explore tech stack options
└─→ Explore design patterns
```
- Branch from same parent
- Use "Full Context" inheritance
- Each explores different dimension

**Step 3: Merge explorations into synthesis**
```
Tech Stack ──┐
             ├─→ Architecture Decision (⚡ merge node)
Design Patterns ──┘
```
- Drag from one card to the other
- Creates merge node with both contexts
- AI synthesizes both perspectives

**Step 4: Continue from synthesis**
```
Architecture Decision
└─→ Implementation Plan
```
- Branch from merge node
- Inherits combined context from both explorations

**Result:** Structured decision-making where multiple angles converge into informed choice.

**When to use this pattern:**
- ✅ Evaluating competing approaches
- ✅ Multi-factor technical decisions
- ✅ Trade-off analysis
- ✅ Combining complementary research

**Variations:**
```
3-way decision:
Option A ──┐
Option B ──┼─→ Decision
Option C ──┘

Hierarchical (5+ options):
A ──┐         D ──┐
B ──┼─→ Group 1 ──┐     E ──┼─→ Group 2
C ──┘             ├─→ Final Decision
                  │
                  └── Direct input
```

---

## 🐛 Troubleshooting

### "Can't Connect Two Cards"

**Problem:** Drag handle to another card, but connection rejected

**Causes:**
1. Would create a cycle (child → parent connection)
2. Target is descendant of source
3. Target has 5 parents (merge limit reached)

**Solution:**
- Check ancestry in breadcrumb
- Reverse connection direction
- Create hierarchical merge if needed

### "Merge Node Won't Accept Parent"

**Problem:** Trying to add parent to merge node fails

**Cause:** Already at 5-parent limit

**Solution:**
- Create intermediate merge node
- Group related parents first
- Hierarchical merge pattern (see above)

### "Performance Drops During Interaction"

**Check:**
1. Dev overlay FPS counter (should be ~60)
2. Browser extensions (disable for testing)
3. Number of open tabs
4. Canvas complexity (100+ cards?)

**Optimize:**
- Close unused workspaces
- Use branching instead of many parallel cards
- Check `PERFORMANCE_OPTIMIZATIONS.md` for details

### "Lost My Work"

**Recovery:**
- Work auto-saves to localStorage every 300ms
- Refresh page (F5) - should restore immediately
- Check browser console for errors
- Clear localStorage only as last resort

---

## ⚙️ Settings Tips

### Branching Tab

**"Always ask when branching"** (ON by default)
- ✅ Turn ON: When you want to configure each branch
- ✅ Turn OFF: For rapid prototyping, same inheritance mode

**"Default inheritance mode"**
- Set to most-used mode when "Always ask" is OFF
- Full Context is safest default

### Display Tab

**"Show Inherited Context Panel"**
- Keep ON to see parent context
- Turn OFF for minimal UI when you know ancestry

**"Show Canvas Tree Sidebar"**
- Keep ON when organizing complex projects
- Turn OFF for distraction-free focus

---

## 📊 Scale & Limits

### What We Track

| Metric | Limit | Notes |
|--------|-------|-------|
| Undo history | 50 actions | Persists across refresh |
| Merge parents | 5 | Hard limit for quality |
| Cards per workspace | Unlimited | Performance tested to 100+ |
| Workspaces | Unlimited | Stored in localStorage |
| Storage | ~5-10 MB | Browser localStorage limit |

### When to Create New Workspace

**Create new workspace when:**
- Starting unrelated project
- Different team/client
- Experimental sandbox separate from main work
- Archive completed projects

**Stay in one workspace when:**
- Related branches of same project
- Different features of same app
- Sequential phases that reference each other

---

## 🔮 Phase 3 Preview

### Coming Soon (Live AI Integration)

**Auto-Summary Mode:**
- Branch with AI-generated summary instead of full context
- Reduce token usage on long conversations
- Intelligent extraction of key points

**Merge Synthesis:**
- AI automatically synthesizes multiple parent contexts
- Generates comparison/decision matrix
- Suggests optimal path forward

**Context Warnings:**
- Real-time token count
- Inheritance depth alerts
- Merge complexity analysis

---

## 💡 Pro Tips

### Efficiency Hacks

1. **Use minimap for navigation** - Click minimap to jump instantly
2. **F2 to rename workspace** - While workspace selected in sidebar
3. **Double-click to expand** - Faster than right-click menu
4. **Hover for quick scan** - Branch icons show without clicking

### Visual Cues

**Border colors tell the story:**
- Amber = Branched, selected, or active in chat panel
- Green = Healthy merge (2 parents)
- Amber + ⚠️ = Complex merge (3-4)
- Red + ⚠️ = Maximum merge (5)
- Thick amber border (2px) = Card is open in right chat panel

**Edge colors indicate relationship:**
- Amber edges = Branch relationships
- Emerald edges = Merge relationships
- Violet dashed = References (future feature)

**Complete color reference:**

| Element | Color Code | Meaning |
|---------|-----------|----------|
| Selected card border | `#f59e0b` (amber) | Active selection |
| Branch edge | `#f59e0b` (amber) | Parent → child |
| Merge edge | `#10b981` (emerald) | Source → merge node |
| Reference edge | `#8b5cf6` (violet, dashed) | Non-hierarchical link |
| Background | `#0a0e27` (navy) | Canvas base |
| Cards | `#141b3d` (navy-light) | Card background |
| Merge node (2 parents) | `#10b981` (green) | Healthy complexity |
| Merge node (3-4 parents) | `#f59e0b` (amber) | Complex but acceptable |
| Merge node (5 parents) | `#ef4444` (red) | Maximum limit |

### Keyboard Flow

Rapid card creation and conversation:
```
N → Enter → (type message) → Ctrl+Enter → (AI responds)
↓
New card created, chat panel open, ready to converse

Branching flow:
Select card → Ctrl+B → (configure) → Enter → (new branch opens in chat)
```

---

## 🎓 Learning Path

**Beginner** (Day 1):
1. Create cards with `N`
2. Open chat panel with click or `Enter`
3. Send messages with `Ctrl+Enter`
4. Basic selection and navigation
5. Simple branching with `Ctrl+B`

**Intermediate** (Week 1):
5. Message-level branching
6. Context inheritance modes
7. Tree sidebar organization
8. Keyboard shortcuts mastery

**Advanced** (Month 1):
9. Merge node strategies
10. Hierarchical merges
11. Multi-workspace organization
12. Performance optimization

---

## ❓ Still Have Questions?

**Check these resources:**
- `USER_TUTORIAL.md` - Step-by-step walkthrough
- `architecture.md` - Technical deep dive
- `PERFORMANCE_OPTIMIZATIONS.md` - Speed tips
- GitHub Issues - Report bugs or request features

**Common learning curve:**
- Day 1: Basic navigation feels natural
- Day 3: Branching becomes second nature
- Week 1: Using merge nodes effectively
- Week 2: Building complex DAG structures effortlessly

---

**Remember:** ProjectLoom is designed for exploration. There's no "wrong" way to organize your conversations. Start simple, experiment, and develop patterns that work for your thinking style.

**Happy exploring! 🚀**
