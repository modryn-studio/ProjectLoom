# Perplexity Agent API — Future Feature Spec

> Status: **Planned** | Priority: Medium  
> Last updated: 2026-02-18  
> API Reference: https://docs.perplexity.ai/api-reference/responses-post

This document specifies future enhancements to ProjectLoom's Perplexity Agent API integration. These features are available in the API but not yet implemented.

---

## 1. Custom Function Tools

### Overview

The Agent API supports custom function tools alongside the built-in `web_search` and `fetch_url` tools. Function tools allow the model to call application-defined functions, enabling structured data extraction, workspace automation, and multi-step agent workflows.

### API Specification

```typescript
// Request body tools array accepts FunctionTool objects:
{
  tools: [
    { type: 'web_search' },    // existing
    { type: 'fetch_url' },     // existing (not yet used in ProjectLoom)
    {
      type: 'function',
      name: 'tool_name',         // unique identifier, 1-64 chars
      description: 'What this tool does', // helps the model decide when to call it
      parameters: {              // JSON Schema defining the tool's input
        type: 'object',
        properties: {
          param1: { type: 'string', description: '...' },
          param2: { type: 'number' },
        },
        required: ['param1'],
      },
    },
  ],
}
```

### Response Handling

When the model invokes a function tool, the response includes a `FunctionCallOutputItem`:

```typescript
// Response output item:
{
  type: 'function_call',
  id: 'call_abc123',
  name: 'tool_name',
  arguments: '{"param1": "value", "param2": 42}',  // JSON string
  status: 'completed' | 'failed' | 'in_progress',
}
```

The response `status` will be `requires_action` when the model is waiting for function call results. The client must:

1. Parse the function call arguments
2. Execute the function locally
3. Send a follow-up request with the function result as a new input item

### Streaming Considerations

During streaming, function call events appear as:
- `response.function_call_arguments.delta` — streamed argument chunks
- `response.function_call_arguments.done` — complete arguments

The response will pause at `requires_action` status until the client sends results back.

### Implementation Plan

#### Phase 1: Infrastructure
- [ ] Add `requires_action` to the `PerplexityAgentResponse.status` union type
- [ ] Add `FunctionCallOutputItem` type to the response output union
- [ ] Update `doStream` to detect `requires_action` status and surface it to the caller
- [ ] Add function call SSE event parsing (`response.function_call_arguments.delta/done`)

#### Phase 2: Tool Registry
- [ ] Create `src/lib/tools/tool-registry.ts` — central registry for available tools
- [ ] Define `ToolDefinition` interface (name, description, parameters schema, handler function)
- [ ] Implement built-in tools:
  - `workspace_search` — search across conversation cards
  - `create_branch` — create a new branch from a card
  - `summarize_card` — summarize a conversation card
  - `read_knowledge_base` — retrieve knowledge base entries

#### Phase 3: Execution Loop
- [ ] Implement multi-turn tool execution loop in `src/app/api/chat/route.ts`
- [ ] Add max steps guard (default 5, configurable) to prevent infinite loops
- [ ] Add timeout guard (default 30s) for tool execution
- [ ] Surface tool call progress to the UI (show "Searching workspace..." etc.)

#### Phase 4: UI Integration
- [ ] Show tool call indicators in the message thread (collapsible tool call details)
- [ ] Add tool configuration in Settings panel (enable/disable individual tools)
- [ ] Show tool execution cost in usage tracking

### Security Considerations
- Tool handlers must validate all arguments before execution
- Limit tool execution to read-only operations by default
- Destructive tools (create, delete, modify) require explicit user confirmation
- Rate limit tool executions per conversation (max 20 calls per message)

---

## 2. `max_steps` Parameter

### Overview

The `max_steps` parameter controls the maximum number of research loop steps the model can take. This is useful for controlling depth of web search chains and multi-step reasoning.

### API Specification

```typescript
{
  model: 'openai/gpt-5.2',
  input: '...',
  max_steps: 5,  // 1–10, integer
}
```

- **Range:** 1 to 10 (inclusive)
- **Default:** Determined by preset or API default
- **Behavior:** If provided, overrides the preset's `max_steps` value
- **Impact:** Higher values allow deeper research chains but increase latency and token usage

### Implementation Plan

- [ ] Add `max_steps` to `PerplexityAgentRequestBody` interface
- [ ] Add `maxSteps` to model config in `src/lib/model-configs.ts` (per-model defaults)
- [ ] Expose in Settings UI as an advanced option (slider: 1–10)
- [ ] Pass through from chat route: `requestBody.max_steps = modelConfig.maxSteps`
- [ ] Consider per-conversation override (some conversations may need deeper research)

### Recommended Defaults

| Use Case | max_steps |
|----------|-----------|
| Quick Q&A | 1–2 |
| Research tasks | 3–5 |
| Deep analysis | 5–10 |
| Sonar model (built-in search) | 3 |
| Non-search models | 1 |

---

## 3. `language_preference` Parameter

### Overview

The `language_preference` parameter accepts an ISO 639-1 language code to control the response language. This is useful for multilingual workspaces.

### API Specification

```typescript
{
  model: 'openai/gpt-5.2',
  input: '...',
  language_preference: 'es',  // ISO 639-1 code
}
```

- **Format:** ISO 639-1 two-letter language code (e.g., `en`, `es`, `fr`, `de`, `ja`, `zh`)
- **Default:** Not set (model infers from input)
- **Behavior:** Guides the model to respond in the specified language

### Implementation Plan

- [ ] Add `language_preference` to `PerplexityAgentRequestBody` interface
- [ ] Add language preference to workspace settings (per-workspace, inheritable)
- [ ] Add language selector UI in Settings or workspace context panel
- [ ] Pass through from chat route when set
- [ ] Store in workspace context alongside instructions and knowledge base

### Supported Languages (common)

`en` (English), `es` (Spanish), `fr` (French), `de` (German), `it` (Italian), `pt` (Portuguese), `ja` (Japanese), `ko` (Korean), `zh` (Chinese), `ar` (Arabic), `hi` (Hindi), `ru` (Russian)

---

## 4. `fetch_url` Tool

### Overview

The `fetch_url` tool fetches and extracts content from specific URLs. Already supported by the Agent API but not yet enabled in ProjectLoom.

### API Specification

```typescript
{
  tools: [
    { type: 'fetch_url' }
  ]
}
```

Response includes `FetchUrlResultsOutputItem` with extracted page content.

### Implementation Plan

- [ ] Add `fetch_url` to the tools array when user pastes URLs in messages
- [ ] Auto-detect URLs in user messages and enable `fetch_url` tool
- [ ] Display fetched content in collapsible section below the message

---

## 5. Model Fallback Chains

### Overview

Specify multiple models for automatic failover. If one model fails or is unavailable, the API automatically tries the next model.

### API Specification

```typescript
{
  models: ['openai/gpt-5.2', 'anthropic/claude-sonnet-4-5', 'openai/gpt-5-mini'],
  input: '...',
}
```

- **Max models:** 5 in the fallback chain
- **Behavior:** Models are tried in order until one succeeds
- **Response:** `response.model` reflects the model that actually succeeded

### Implementation Plan

- [ ] Add fallback chain configuration to model settings
- [ ] Use `models` (array) instead of `model` (string) when fallbacks are configured
- [ ] Show which model actually responded in the message metadata
- [ ] Allow per-workspace fallback chain configuration

---

## 6. Reasoning Control

### Overview

Control reasoning effort for models that support extended thinking (e.g., GPT-5.2, Claude Opus).

### API Specification

```typescript
{
  model: 'openai/gpt-5.2',
  input: '...',
  reasoning: {
    effort: 'high'  // 'low' | 'medium' | 'high'
  },
}
```

### Implementation Plan

- [ ] Add `reasoning` to `PerplexityAgentRequestBody`
- [ ] Add reasoning effort selector to model settings (per-model, per-conversation)
- [ ] Only show for models that support reasoning
- [ ] Default to `medium` for reasoning-capable models

---

## Priority Order

1. **Custom Function Tools** — enables workspace automation and structured agent workflows
2. **`max_steps`** — controls research depth and cost
3. **`fetch_url` Tool** — enhances web research capabilities  
4. **Model Fallback Chains** — improves reliability
5. **`language_preference`** — internationalization support
6. **Reasoning Control** — advanced users / complex tasks
