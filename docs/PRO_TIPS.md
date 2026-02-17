# ProjectLoom Pro Tips

> **Quick Reference Guide for Power Users**  
> Last Updated: February 2026

## 🎯 Core Workflow Strategy

### **Tip 1: Start with Sonar for Research**

**Why:** Sonar models have built-in web search and return current, cited information.

**Pattern:**
```
Research Phase
└─ Use: Sonar Pro or Sonar Reasoning Pro
   └─ Ask: "What's the current state of [technology/tool]?"
   └─ Get: Up-to-date info with sources
   
Deep Dive Phase
└─ Switch to: Claude Opus / GPT-5.2 / Gemini
   └─ Ask: "Based on those findings, design [specific solution]"
   └─ Get: Detailed reasoning and implementation
```

**Examples:**
- ✅ "What are the latest React 19 features?" → **Sonar Pro**
- ✅ "Design an authentication system using those features" → **Claude Sonnet**
- ✅ "What's the current Rust async ecosystem like?" → **Sonar Pro**
- ✅ "Implement async database pool with those libraries" → **GPT-5.2**

**Don't:**
- ❌ Ask Claude about "latest 2026 pricing" (training cutoff)
- ❌ Use Sonar for deep code generation (slower, less precise)

---

### **Tip 2: Upload Documentation Early**

**Why:** Knowledge Base (RAG) automatically injects relevant context into every conversation.

**What to Upload (max 10 files, 500KB each):**
```
✓ API documentation    (official docs, OpenAPI specs)
✓ Your existing code   (key modules, utilities)
✓ Requirements         (specs, compliance rules)
✓ Architecture notes   (design decisions, diagrams as markdown)
✓ Style guides         (code standards, patterns)
✓ Error logs           (for debugging sessions)
```

**Best Practices:**
- **Name files clearly:** `github-api-v3.md` not `docs.md`
- **Keep focused:** One topic per file (easier for RAG to retrieve)
- **Format as text:** .md, .txt, .js, .py (not PDFs or images)
- **Update regularly:** Delete old versions, upload new ones

**How RAG Helps:**
```
Without KB:
You: "How do we handle OAuth?"
AI: [Generic OAuth explanation]

With KB (github-api-docs.md + auth-module.py uploaded):
You: "How do we handle OAuth?"
AI: "Based on your existing auth-module.py (lines 45-89), 
     you're already using the pattern from github-api-docs.md.
     For the new scope, modify..."
```

---

### **Tip 3: Branch Often, Merge Later**

**Why:** Explore multiple solutions in parallel without commitment. Synthesize the best parts.

**When to Branch:**
- 🌿 **Exploring alternatives:** "Try 3 different database designs"
- 🌿 **Different perspectives:** Same question to GPT vs Claude vs Gemini
- 🌿 **Risk assessment:** Optimistic path + worst-case scenario path
- 🌿 **Incremental refinement:** Keep original, try variations

**Branching Patterns:**

**Pattern A: Multi-Approach Exploration**
```
[Problem Definition]
        │
        ├─ [Approach A: SQL] → Claude Sonnet
        ├─ [Approach B: NoSQL] → GPT-5.2
        └─ [Approach C: Hybrid] → Gemini 3 Flash
                │
                └─ [Compare & Decide] → Claude Opus (merge)
```

**Pattern B: Progressive Refinement**
```
[Initial Solution]
        │
        ├─ [What if we used TypeScript?]
        ├─ [What if we made it async?]
        └─ [What if we added caching?]
                │
                └─ [Best Combination] (merge)
```

**Pattern C: Risk Scenarios**
```
[Architecture Decision]
        │
        ├─ [Optimistic: Everything Works]
        └─ [Pessimistic: Edge Cases & Failures]
                │
                └─ [Realistic Plan] (merge both)
```

**Pro Move: Branch from ANY message**
- Right-click any AI response → Branch
- Explore "what if we changed that part?"
- Original conversation stays intact

---

### **Tip 4: Use the Right Model for the Task**

**Model Selection Cheat Sheet:**

| Task | Best Model | Why |
|------|-----------|-----|
| **Current info / research** | Sonar Pro | Built-in web search, citations |
| **Deep reasoning** | Claude Opus 4.6 | Best at complex analysis |
| **Code generation** | Claude Sonnet 4.5 | Fast + accurate code |
| **Long context (50+ msgs)** | Gemini 3 Flash | 2M context window, FREE tier |
| **Cost-conscious** | Gemini 2.5 Flash | Best price/performance |
| **Quick tasks** | Claude Haiku 4.5 | Fastest + cheapest |
| **Balanced default** | GPT-5.2 or Claude Sonnet | Reliable all-rounders |
| **Vision (images)** | Any except Sonar | Analyze screenshots, diagrams |
| **Real-time analysis** | Sonar Reasoning Pro | Web data + deep thinking |

**Cost Optimization Strategy:**
```
1. Start cheap: Haiku or GPT-5 Mini
   ↓ (if answer insufficient)
2. Upgrade: Sonnet or GPT-5.2
   ↓ (if needs deep analysis)
3. Bring out the big gun: Opus
```

**Context Window Strategy:**
```
Short conversation (< 10 messages):
→ Any model works

Medium (10-30 messages):
→ Claude, GPT, Gemini 2.5

Deep branch (30-50 messages):
→ Claude (200K), Gemini 3 (2M)

Mega merge (5 parents, 50+ msgs each):
→ Gemini 3 Flash (2M context, handles it easily)
```

---

### **Tip 5: Instructions = Your AI Personality**

**Why:** Set global rules once. Every conversation inherits them. No repetition.

**What to Include:**

```markdown
[Workspace Instructions - 1500 char max]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Role: [Who is the AI? e.g., "Senior TypeScript architect"]

Requirements:
- [Technical constraints, e.g., "Must use React 19, TypeScript 5.3+"]
- [Code style, e.g., "Functional components, no classes"]
- [Security rules, e.g., "Never store secrets in code"]

Behavior:
- [Tone, e.g., "Concise. Code-first. Challenge bad patterns."]
- [Citations, e.g., "Always cite sources for current info"]
- [Format, e.g., "Use TypeScript for examples, not JavaScript"]

Forbidden:
- [What NOT to do, e.g., "No 'any' types. No console.log in production."]
```

**Examples:**

**For Code Review Project:**
```
You are a security-focused senior engineer reviewing code.

Priority: Security > Performance > Readability
Always check for: SQL injection, XSS, auth bypasses
Tone: Direct. Flag issues immediately.
Format: Show vulnerable code, then fixed version.
Cite: OWASP Top 10, CWE numbers when relevant.
```

**For Learning Project:**
```
You are a patient teacher explaining concepts.

Tone: Encouraging, step-by-step, use analogies
Format: Explain "why" before "how"
Examples: Always include code examples
Check understanding: Ask if concept is clear before moving on
```

**For API Design:**
```
You are designing RESTful APIs for a startup.

Standards: OpenAPI 3.1, JSON:API spec
Constraints: Max 200ms response time, < 1KB payloads
Patterns: Use standard HTTP methods, consistent error format
Cite: REST best practices, HTTP RFCs when relevant
```

**Pro Move:** Instructions flow to all branches and merges automatically.

---

## 🛠️ Advanced Techniques

### **Tip 6: Multi-Parent Merges for Synthesis**

**When:** You've explored 3-5 different approaches and need a unified answer.

**How:**
1. Select 2-5 conversation cards (Ctrl+Click)
2. Right-click → "Merge into new card"
3. Add synthesis prompt (optional but recommended)
4. Choose your best synthesis model (Claude Opus or Gemini 3)

**Synthesis Prompts:**
```
Good: "Compare these approaches and recommend the best one."

Better: "Compare these 3 architecture approaches. Consider:
         - Development time (we have 2 weeks)
         - Cost (< $100/month budget)
         - Matches our security-requirements.md
         Recommend one with justification."

Best: "Synthesize a hybrid approach using:
       - Database design from Branch A
       - API structure from Branch B  
       - Error handling from Branch C
       Show how they integrate. Flag conflicts."
```

**Why It Works:**
- AI sees ALL parent contexts (up to 5 parents, max context window)
- Can reference specific parts: "Branch A suggested X but Branch C shows Y is better"
- Creates decision documentation: "We chose X over Y because..."

---

### **Tip 7: Use Vision for Diagrams & Screenshots**

**Supported:** All models except Sonar (use Claude, GPT, or Gemini)

**Great For:**
- 📊 Architecture diagrams → "Is this design scalable?"
- 🐛 Error screenshots → "Debug this stack trace"
- 🎨 UI mockups → "Convert this to React components"
- 📈 Charts/graphs → "Explain trends in this data"
- 📋 Whiteboard photos → "Formalize these notes into specs"

**How:**
1. Click image icon in chat input
2. Upload image (max 3 images, 5MB each, PNG/JPEG/WebP/GIF)
3. Add text prompt
4. AI analyzes image + responds

**Pro Tips:**
- **Combine with KB:** Upload architecture doc + screenshot → AI references both
- **Branch with images:** "What if we changed the layout?" → Attach new mockup
- **Use Opus for complex diagrams:** Better at understanding intricate visuals

---

### **Tip 8: Keyboard Shortcuts for Speed**

| Shortcut | Action |
|----------|--------|
| `N` | New conversation card |
| `Ctrl+B` | Branch from selected card |
| `Ctrl+F` | Search canvas |
| `Ctrl+L` | Auto-layout cards |
| `Escape` | Close dialogs/panels |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Delete` | Delete selected card |
| `Ctrl+Enter` | Send message |

**Workflow Example:**
```
1. [N] → New card
2. Type question → [Ctrl+Enter] → Send
3. [Ctrl+B] → Branch for alternative
4. Switch model in dropdown
5. [Ctrl+L] → Auto-organize canvas
```

---

### **Tip 9: Context Inheritance Modes**

**When branching, choose how much parent context to inherit:**

| Mode | What's Inherited | When to Use |
|------|-----------------|-------------|
| **Full** | All parent messages | Most common. Keep full context. |
| **Summary** | AI-generated summary | Long parent (30+ msgs). Reduce tokens. |
| **Custom** | Select specific messages | Need only certain parts of parent. |
| **None** | Fresh start | Completely new direction. |

**Examples:**

**Full Mode (default):**
```
Parent: 50 messages about React architecture
Branch: "Now implement the auth module"
→ Inherits all 50 messages (AI knows full context)
```

**Summary Mode:**
```
Parent: 100 messages (huge context)
Branch: "What about database design?"
→ Inherits 2-paragraph summary of parent
→ Saves tokens, faster, cheaper
```

**Custom Mode:**
```
Parent: 50 messages, but only messages 10-15 are relevant
Branch: Right-click → Custom → Select messages 10-15
→ Only those messages inherited
```

---

### **Tip 10: Export & Share Your Thinking**

**Canvas = Visual Decision Log**

**Export Options:**
- JSON export (future: share workspaces)
- Screenshot canvas (document decision tree)
- Copy conversations (paste into docs/Notion)

**Great For:**
- 📝 **Documentation:** "Here's how we decided on this architecture"
- 🧑‍🤝‍🧑 **Team alignment:** Visual decision tree
- 📊 **Presentations:** "Let me show you our research process"
- 🔄 **Retrospectives:** "Here's what we explored and why we chose X"

---

## 🎨 Canvas Organization Tips

### Keep Your Canvas Clean

**Pattern A: Linear Flow (Simple)**
```
[Research] → [Design] → [Implementation] → [Testing]
```

**Pattern B: Hub-and-Spoke (Exploration)**
```
                [Central Problem]
                       │
        ┌──────┬───────┼───────┬──────┐
        │      │       │       │      │
     [Opt A] [Opt B] [Opt C] [Opt D] [Opt E]
```

**Pattern C: Staged Decision Tree**
```
[Problem]
    ├─ [Research Phase]
    │   ├─ Current tools
    │   └─ Requirements
    ├─ [Design Phase]
    │   ├─ Approach A
    │   ├─ Approach B
    │   └─ Approach C
    └─ [Decision]
        └─ [Implementation]
```

**Use Auto-Layout:**
- Messy canvas? Press `Ctrl+L`
- Automatically organizes into clean tree structure

---

## 💰 Cost Management

### **Token Optimization**

**Strategy 1: Start Cheap, Scale Up**
```
Try Haiku ($0.25 / 1M tokens)
  ↓ Not good enough?
Try Sonnet ($3 / 1M tokens)
  ↓ Still need more power?
Try Opus ($15 / 1M tokens)
```

**Strategy 2: Use Gemini for Long Contexts**
```
5-parent merge with 50+ messages each?
→ Gemini 3 Flash (2M context)
→ FREE tier available!
→ Cheaper than Claude/GPT for huge contexts
```

**Strategy 3: Summary Mode for Deep Branches**
```
Parent has 100 messages → Full inheritance costs $$
→ Use Summary mode when branching
→ 100 messages → 2 paragraphs
→ 95% token savings
```

---

## 🐛 Debugging & Iteration

### **When AI Gets It Wrong**

**Option 1: Edit & Regenerate**
```
AI said: "Use Redux for state management"
You: [Edit message] "Use Zustand for state management"
→ Regenerate from that point
→ Conversation continues with correction
```

**Option 2: Branch & Try Different Model**
```
Claude gave generic answer
→ Branch → Switch to GPT-5.2 → Ask again
→ Compare responses
→ Choose better one
```

**Option 3: Retry (Same Model)**
```
[Retry icon] → Model gives fresh attempt
→ Different answer, same model
→ Useful for creative tasks
```

**Option 4: Add More Context**
```
Vague answer → Upload relevant docs to KB
→ Ask again → AI now has context
→ Much better answer
```

---

## ⚡ Performance Tips

### Keep Things Fast

1. **Close unused workspaces:** Settings → Delete old ones
2. **Limit attachments:** Max 3 images per message
3. **Use Summary mode:** For mega-branches (30+ messages)
4. **Clear knowledge base:** Delete unused files
5. **Browser cache:** Transformers.js model cached (17MB, one-time)

---

## 🎓 Learning Resources

**Built-In:**
- `?` → Keyboard shortcuts panel
- Settings → API Keys → Provider info
- Canvas → Right-click → Context menu

**External:**
- Perplexity API: `docs.perplexity.ai`
- Model comparison: `artificialanalysis.ai`
- Token pricing: Check Perplexity dashboard

---

## 🚀 Quick Start Checklist

Starting a new project? Follow this:

- [ ] **1. Set up workspace instructions** (Settings → Canvas Context)
- [ ] **2. Upload relevant docs** (API docs, your code, requirements)
- [ ] **3. Start with Sonar** (Get current landscape)
- [ ] **4. Branch 2-3 approaches** (Don't commit too early)
- [ ] **5. Switch models strategically** (Cheap → Expensive as needed)
- [ ] **6. Merge insights** (Synthesize best parts)
- [ ] **7. Export decision log** (Document your thinking)

---

**Remember:** ProjectLoom is a thinking tool, not just a chatbot. Use the canvas to explore, branch to experiment, merge to synthesize. Your spatial reasoning + AI capabilities = better decisions.
