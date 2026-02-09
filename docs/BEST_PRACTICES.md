# ProjectLoom Best Practices

> **For users.** Quick reference for common workflows and tips.  
> **Last Updated:** February 2026

## Setup

**API Keys:**
- Click gear icon → API Keys tab
- Add Anthropic key for Claude models (Opus, Sonnet, Haiku)
- Add OpenAI key for GPT models (GPT-4o, GPT-4o Mini)
- Keys stored in browser localStorage only

**Choose a model:**
- **Claude Sonnet 4** - Best default (balanced quality/speed/cost)
- **Claude Haiku 4** - Fast and cheap for simple tasks
- **Claude Opus 4** - Highest quality for complex reasoning
- **GPT-4o** - OpenAI's flagship model
- **GPT-4o Mini** - OpenAI's efficient model

## Navigation

**Keyboard Shortcuts:**
- `N` - New card
- `Enter` / `Space` - Open chat panel
- `Ctrl+B` - Branch from selected card
- `Ctrl+Enter` - Send message (in chat)
- `Delete` - Delete selected card(s)
- `Escape` - Close panel, then deselect
- `Ctrl+Z` / `Ctrl+Shift+Z` - Undo / Redo
- `Ctrl+F` - Search canvas
- `Ctrl+L` - Auto-layout cards
- `?` - Show all shortcuts

**Mouse:**
- Click card → open chat panel
- Drag canvas → pan
- Scroll → zoom
- Drag card → reposition
- Right-click card → context menu

## Branching

**When to branch:**
- Explore multiple approaches to same problem
- Try different parameters without losing original
- Preserve decision points for later reference

**Inheritance modes:**
- **Full** - All parent messages (default, best for complex tasks)
- **Summary** - AI-generated summary (50-90% token reduction)
- **Custom** - Select specific messages
- **None** - Fresh start with no context

**Quick branch:** Click branch icon (🌿) on any message in chat panel

## Merging

**Use merge nodes to:**
- Compare multiple approaches
- Synthesize parallel explorations
- Make multi-criteria decisions

**Merge limits:**
- Green ⚡ (2 parents) - Ideal, best AI quality
- Amber ⚠️ (3-4 parents) - Complex but acceptable
- Red ⚠️ (5 parents) - Maximum limit, consider hierarchical merge

**Per-parent modes:** Each parent can use different inheritance mode (mix Full + Summary to reduce tokens)

## Vision Support

**Upload images for:**
- UI mockups / screenshots
- Error messages / stack traces
- Diagrams / flowcharts
- Code screenshots with context

**Limits:** Max 3 images per message, 5MB each, PNG/JPEG/WebP/GIF only

**Works with:** All Claude models (Opus, Sonnet, Haiku), GPT-4o, GPT-4o Mini

## Organization

**Multi-select:**
- `Shift+Click` to add cards to selection
- Drag selection box on canvas
- `Ctrl+A` to select all
- `Delete` for bulk deletion

**Search:**
- `Ctrl+F` opens search
- Searches titles, messages, branch reasons
- Arrow keys navigate results
- `Enter` jumps to result

**Auto-layout:**
- `Ctrl+L` organizes overlapping cards
- Uses tree algorithm (respects hierarchy)
- Shows toast with result count

## Pro Tips

**Cost optimization:**
- Start with Haiku for exploration
- Switch to Sonnet when you find direction
- Use Opus only for final refinement

**Visual cues:**
- Amber border = selected or active in chat
- 🌿 icon = branched card
- ⚡ icon = merge node
- Amber edges = branch relationships
- Green edges = merge relationships

**Drafts:**
- Auto-saved per conversation
- Switch conversations freely
- Not persisted across refreshes

**Undo:**
- Last 50 actions tracked
- Survives page refresh
- Toast with undo button appears

## Troubleshooting

**"No AI response"**
- Check Settings → API Keys
- Verify key is valid
- Try different model

**"Can't connect two cards"**
- Check if would create cycle
- Merge nodes limited to 5 parents

**"Performance slow"**
- Close other browser tabs
- Disable browser extensions
- Check dev overlay (should show 60 FPS)

---

**For step-by-step tutorial, see [USER_TUTORIAL.md](USER_TUTORIAL.md)**
