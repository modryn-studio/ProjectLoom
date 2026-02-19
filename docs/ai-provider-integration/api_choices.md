

**Claude API (Anthropic) — ✅ Native web search confirmed**

First-class built-in tool, no external service:
```json
{ "type": "web_search_20260209", "name": "web_search" }
```
- API executes the search server-side, results come back in the response
- Works on Sonnet 4.5, Sonnet 4.6, Opus 4.5, Opus 4.6, Haiku 4.5
- Pricing: **$10 per 1,000 searches** + normal token cost for results
- Supports domain filtering, localization, `max_uses` cap, prompt caching
- Latest version (`20260209`) adds dynamic filtering via code execution — Claude writes code to filter HTML before adding to context (reduces junk tokens)
- Works directly via `@ai-sdk/anthropic`

---

**OpenAI API — 

There are now **two separate OpenAI APIs**:

| | Chat Completions (`/v1/chat/completions`) | Responses API (`/v1/responses`) |
|---|---|---|
| Web search | ❌ No native search — must bring your own (Tavily, etc.) via function calling | ✅ Built-in `web_search` tool, same pattern as Claude |
| Status | Still supported, not deprecated | Recommended for all new projects |

The old Chat Completions API is what you used before — that one has no native search. The new **Responses API** has it natively. OpenAI is actively pushing everyone to migrate: *"Chat Completions remains supported, Responses is recommended for all new projects."* The Assistants API is being deprecated August 2026.

---

**Tavily — ✅ Confirmed accurate**

Purpose-built search API for LLM agents. Still the right choice when:
- You want explicit control over what gets searched and returned
- You want to use Chat Completions API (no native search)
- You need to search before sending to the model (pre-processing)
- You want cheaper search ($0.001–$0.005/search vs $0.01 for Claude/OpenAI)

---

**Perplexity — ✅ Confirmed accurate as a real-time model alternative**

Their Sonar models have search baked in at the model level — it's not a tool call, it's how the model works. Good when you want responses that are inherently grounded in web data.

---

**The clean architecture recommendation given all this:**

| Provider | API | Search |
|---|---|---|
| Claude models | `@ai-sdk/anthropic` → Messages API | Native `web_search_20260209` tool |
| OpenAI models | `@ai-sdk/openai` → Responses API | Native `web_search` built-in |
| Perplexity Sonar | Direct Sonar API | Native (model-level) |

No Perplexity proxy. No Tavily unless you need explicit pre-search control. Two API keys (Anthropic + OpenAI), both official SDKs, both with first-class Vercel AI SDK support.