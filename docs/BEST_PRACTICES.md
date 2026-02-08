# ProjectLoom Best Practices & FAQ

> **Version:** v4.2.0 (Phase 2 Complete)  
> **Last Updated:** February 6, 2026  
> **For:** Users wanting to master efficient workflows
> **New to ProjectLoom?** Start with [USER_TUTORIAL.md](USER_TUTORIAL.md) for step-by-step feature learning

---

## 🎯 Quick Answers

### API Keys & AI Configuration

**Q: How do I set up AI chat?**  
A: You need to provide your own API key(s). Click the gear icon (⚙️) → API Keys tab → add keys for Anthropic and/or OpenAI. Keys are stored locally in your browser only.

**Q: Are my API keys secure?**  
A: Keys are stored in your browser's localStorage with basic obfuscation. They're never sent to ProjectLoom servers. For production use, set environment variables (`NEXT_PUBLIC_ANTHROPIC_API_KEY` or `NEXT_PUBLIC_OPENAI_API_KEY`).

**Q: Which AI model should I use?**  
A: It depends on your needs:
- **Claude Opus 4** - Best quality, highest cost, slowest. Use for complex reasoning.
- **Claude Sonnet 4** - Balanced quality/speed/cost. Best default for most tasks.
- **Claude Haiku 4** - Fast and cheap. Good for simple tasks or high-volume.
- **GPT-4o** - OpenAI's flagship. Similar to Opus in capability.
- **GPT-4o Mini** - OpenAI's efficient model. Similar to Haiku.

**Q: Can different cards use different models?**  
A: Yes! Each conversation can use a different model. Switch models anytime in the chat panel header. The model badge shows which AI generated each message.

**Q: What happens if my API key is invalid?**  
A: You'll see an error banner in the chat panel with a suggestion to check your key in Settings. ProjectLoom validates keys before sending requests.

**Q: Can I switch models mid-conversation?**  
A: Yes! Click the model dropdown in the chat panel header and select a new model. Future messages in that conversation will use the new model. Previous messages keep their original model badge.

---

## Interface & Navigation

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

## 🤖 AI Model Selection Strategies

### Choosing the Right Model

**By Task Complexity:**

**Simple/Routine Tasks** (Use Efficient Models)
- ✅ Haiku 4 or GPT-4o Mini
- ✅ Fast responses (< 2 seconds)
- ✅ Low cost (1/100th of premium models)
- ✅ Examples: Code formatting, simple Q&A, data extraction

**Balanced Tasks** (Use Balanced Models)
- ✅ Sonnet 4 (recommended default)
- ✅ Good speed/quality trade-off
- ✅ Moderate cost
- ✅ Examples: Code generation, technical writing, debugging

**Complex Reasoning** (Use Premium Models)
- ✅ Opus 4 or GPT-4o
- ✅ Best quality and reasoning
- ✅ Highest cost and slowest
- ✅ Examples: Architecture decisions, complex algorithms, research synthesis

### Cost Optimization Strategies

**Start Efficient, Scale Up:**
```
New Card (Exploration)
├─→ Use Haiku 4 for initial ideas
├─→ Switch to Sonnet 4 when you find direction
└─→ Use Opus 4 only for final refinement
```

**Benefits:**
- Save 90% on early exploration costs
- Reserve premium models for decisions that matter
- Still get high quality when needed

**Branch with Different Models:**
```
Problem Definition (Sonnet 4)
├─→ Quick Solution A (Haiku 4) ───┐
├─→ Quick Solution B (Haiku 4) ───┤
└─→ Detailed Analysis (Opus 4) ───┴→ Merge & Decide (Opus 4)
```

**Pattern:** Explore quickly with cheap models, synthesize with premium.

### Model-Specific Tips

**Claude Haiku 4:**
- ⚡ Fastest responses (~0.5-1s)
- 💰 Most cost-effective (1/100th of Opus)
- ✅ Best for: Quick iterations, simple tasks, high-volume
- ⚠️ Watch: May oversimplify complex problems

**Claude Sonnet 4:**
- ⚖️ Balanced speed and quality
- 💰 Moderate cost (1/5th of Opus)
- ✅ Best for: Most tasks, default choice
- ⚠️ Watch: Occasionally needs Opus for very complex reasoning

**Claude Opus 4:**
- 🧠 Highest reasoning capability
- 💰 Highest cost
- ✅ Best for: Architecture, complex algorithms, research
- ⚠️ Watch: Slower responses (3-10s)

**GPT-4o:**
- 🧠 Similar to Opus in capability
- 💰 High cost
- ✅ Best for: When you prefer OpenAI ecosystem
- ⚠️ Watch: Different reasoning style than Claude

**GPT-4o Mini:**
- ⚡ Fast and efficient
- 💰 Similar cost to Haiku
- ✅ Best for: OpenAI preference + simple tasks
- ⚠️ Watch: May not match Haiku's speed

### When to Switch Models

**During a Conversation:**

**Switch UP (to premium) when:**
- Current model gives superficial answers
- You need deeper reasoning or analysis
- Making important decisions
- Synthesis/merge nodes (combining multiple threads)

**Switch DOWN (to efficient) when:**
- Doing repetitive tasks
- Prototyping many variations quickly
- Cost is a concern
- Simple implementation after design is done

**Example workflow:**
```
1. Start conversation: Sonnet 4
2. Get initial direction
3. Switch to Haiku 4: Generate 5 quick variations
4. Switch to Opus 4: Deep dive on best variation
5. Switch back to Sonnet 4: Implementation details
```

### Model Persistence

**How it works:**
- Each conversation remembers its current model
- Model persists across page refreshes
- Branching: Child conversation starts with parent's model (can change immediately)
- Merging: Merge nodes default to highest-tier model among parents

**Best practice:**
- Set model before sending first message
- Review model before important decisions
- Check model badges on messages to see what generated each response

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

**Summary** (✅ Implemented)
- ✅ Use when: Branch point is clear, but full history is long
- ✅ Best for: Reducing token costs on long conversations (50-90% reduction)
- ✅ How: AI generates concise summary via `/api/summarize` endpoint
- ✅ Regenerate: Click "Regenerate Summary" in Inherited Context panel
- ⚠️ Watch: May lose subtle context or nuance from original messages

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

### Per-Parent Inheritance Modes

**New Feature:** Each parent in a merge node can use a different inheritance mode!

**When creating merge nodes:**
- Use **Full context** for primary/critical sources
- Use **Summary** for secondary/background sources
- Mix modes based on importance and relevance

**Example strategy:**
```
Main Discussion (Full) ──┐
Research Notes (Full)   ──┤
Prior Ideas (Summary)   ──┼─→ Decision Node
Tangential Topic (Summary)──┘
```

**Benefits:**
- Reduce token costs by 50-80% vs all-Full mode
- Preserve critical context where it matters
- Avoid overwhelming AI with too much information
- Faster generation with smaller context windows

**Best practice:**
- Prioritize most recent/relevant parents with Full mode
- Use Summary for older or tangential threads
- Test both modes if unsure - summaries usually sufficient

---

## 📷 Vision Support Best Practices

### When to Use Image Attachments

**Vision-capable models:**
- Claude Opus 4, Sonnet 4, Haiku 4
- GPT-4o, GPT-4o Mini
- Look for 📎 paperclip icon in message input

**Ideal use cases:**
- ✅ UI/UX mockups or screenshots for design feedback
- ✅ Error messages or stack traces (faster than copy-paste)
- ✅ Diagrams, flowcharts, or architecture drawings
- ✅ Code screenshots with context
- ✅ Data visualizations or charts
- ✅ Handwritten notes or whiteboard photos

**When NOT to use images:**
- ❌ Pure text (copy-paste is cheaper and more accurate)
- ❌ Large documents (use text extraction instead)
- ❌ Videos (not supported - extract key frames)
- ❌ Files over 5MB (will be rejected)

### Image Quality Tips

**For best results:**
- Use PNG or JPEG at reasonable resolution (1000-2000px wide)
- Ensure text in images is readable (avoid tiny fonts)
- Crop to relevant area (don't send full desktop screenshot)
- Use good lighting for photos (avoid glare or shadows)
- Keep images focused on single topic per image

**Cost considerations:**
- Images add to token count (varies by model and size)
- Claude models typically charge per image + base message cost
- Use images strategically - not every message needs them
- Haiku 4 is most cost-effective for image analysis

### Image Workflow Patterns

**Design Review Workflow:**
```
1. Attach UI mockup image
2. Ask: "Review this design for accessibility issues"
3. AI analyzes and provides feedback
4. Branch with revised mockup
5. Compare responses
```

**Error Debugging Workflow:**
```
1. Attach error screenshot
2. Ask: "What's causing this error?"
3. AI reads stack trace and suggests fixes
4. Faster than typing out error messages
```

**Code Review with Context:**
```
1. Attach code screenshot showing surrounding context
2. Ask about specific function or pattern
3. AI sees full context without manual excerpt
```

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
- Click empty canvas → closes chat panel and clears selection

**Chat panel behavior:**
- Drag left edge → resize panel (400-800px)
- Click X or press Escape → close panel
- Type and press Ctrl+Enter → send message
- Amber border on canvas card → indicates active conversation
- Chat panel lives in a right column; top bars remain visible

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

### "No Response from AI"

**Problem:** Message sent, but no AI response appears

**Causes:**
1. No API key configured
2. Invalid API key
3. Network error
4. Provider API is down

**Solution:**
- Check for error/warning banners in chat panel
- Open Settings → API Keys → verify key is saved
- Test key by sending a simple message like "Hi"
- Check browser console for detailed error messages
- Try switching to a different provider/model

### "API Key Error"

**Problem:** "Invalid API key" error when sending message

**Solution:**
1. Open Settings → API Keys
2. Delete the problematic key
3. Copy fresh key from provider console:
   - Anthropic: [console.anthropic.com](https://console.anthropic.com)
   - OpenAI: [platform.openai.com](https://platform.openai.com)
4. Paste into Settings and save
5. Try sending message again

**Common mistakes:**
- Copied key with extra spaces (trim whitespace)
- Used expired or revoked key
- Key belongs to different provider than selected model

### "Streaming Stops Mid-Response"

**Problem:** AI response cuts off before finishing

**Causes:**
1. Network interruption
2. Provider rate limit hit
3. Token limit reached
4. User clicked stop button

**Solution:**
- Check network connection
- Wait a moment and try again (rate limit cooldown)
- If consistently hitting limits, switch to smaller model
- Check provider dashboard for usage/limits

### "Model Not Responding Well"

**Problem:** AI gives poor quality responses

**Check:**
1. Using efficient model for complex task? → Switch to premium
2. Conversation too long? → Branch to start fresh
3. Context confusing? → Use "none" inheritance mode
4. Wrong model for task? → See model selection guide above

**Optimize:**
- Start new card for new topics (avoid context pollution)
- Use branching to explore multiple angles
- Switch to higher-tier model for important decisions
- Review conversation history for confusing messages

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
- All conversations, messages, and AI responses are saved
- API keys saved separately (persistent across sessions)
- Refresh page (F5) - should restore immediately
- Check browser console for errors
- Clear localStorage only as last resort (will lose API keys too)

**What persists:**
- ✅ All conversation cards and positions
- ✅ All messages (user and AI)
- ✅ Branch relationships and merge nodes
- ✅ API keys (localStorage)
- ✅ Model selection per conversation
- ✅ Panel widths and UI preferences

**What doesn't persist:**
- ❌ Draft messages (session-only)
- ❌ Chat panel open/closed state
- ❌ Current selection
- ❌ Undo/redo beyond 50 actions

---

## ⚙️ Settings Tips

### API Keys Tab

**Security:**
- Keys stored in browser localStorage (basic obfuscation)
- For production: Use environment variables instead
- Set `NEXT_PUBLIC_ANTHROPIC_API_KEY` or `NEXT_PUBLIC_OPENAI_API_KEY`

**Management:**
- Show/hide toggle to view keys safely
- Delete button to remove keys from storage
- Visual indicators (checkmark) show which keys are saved
- Keys sync immediately (no save button needed)

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
| API key storage | Browser localStorage | Use env vars for production |
| Streaming message length | Unlimited | Handled by AI provider |
| Models per workspace | Unlimited | Each card can use different model |

---

## ✅ Phase 2 Complete!

All Week 1-5 features from Phase 2 are now fully implemented:

### **Context Inheritance for Branching** ✅
Branched cards automatically receive parent conversation as context:
- Full context mode (all messages up to branch point)
- Summary mode with AI-generated summaries (50-90% token reduction)
- Each conversation inherits context from its parent
- Inherited Context panel shows what was inherited

### **Multi-Parent Merge with Per-Parent Context** ✅
Merge nodes combine contexts from multiple parents:
- Each parent can use Full or Summary mode independently
- On-demand AI summary generation per parent
- Cost estimation during summary creation
- Synthesis across multiple exploration threads

### **Agent Workflows** ✅
Three AI agents with tool calling and confirmation UI:
- **Cleanup Agent** - Suggests deletions and renames for workspace organization
- **Branch Agent** - Generates multiple exploration branches from a card
- **Summarize Agent** - Creates markdown summaries of card conversations
- 5-layer safety: User confirmation for all destructive actions

### **Vision Support** ✅
Upload and analyze images in conversations:
- Paperclip button (📎) for vision-capable models
- Up to 3 images per message (max 5MB each)
- PNG, JPEG, WebP, GIF formats supported
- Works with Claude Opus/Sonnet/Haiku 4, GPT-4o, GPT-4o Mini
- Clickable thumbnails in message thread

**See Full Details:** Check [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for technical documentation.

---

## 🏢 Workspace Management

### Current Capabilities

| Metric | Limit | Notes |
|--------|-------|-------|
| Workspaces | Unlimited | Stored in localStorage |
| Storage | ~5-10 MB per workspace | Browser localStorage limit |
| Cards per workspace | Unlimited | Performance tested to 100+ |
| Merge parents | 5 per node | Hard limit for AI quality |

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

### What's Next (Future Development)

**Advanced Summary Features:**
- Customizable summary templates per use case
- Summary history and versioning
- Summary quality feedback and regeneration strategies

**Enhanced Merge Synthesis:**
- AI-generated comparison matrices across merge parents
- Conflict detection and resolution suggestions
- Suggested optimal paths based on merge analysis

**Advanced Context Management:**
- Real-time token count indicators
- Context depth visualizations
- Merge complexity analysis dashboard
- Smart context pruning suggestions

**Desktop Application:**
- Native Electron app for Windows/Mac/Linux
- Better performance and reliability
- Offline-first architecture with sync
- Native file system integration

**Export & Sharing:**
- Export conversations as markdown/PDF/HTML
- Share workspace snapshots
- Collaborative workspaces (multi-user)
- Version control integration

**See Roadmap:** Check GitHub issue #9 comments for Phase 3 detailed planning.

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
