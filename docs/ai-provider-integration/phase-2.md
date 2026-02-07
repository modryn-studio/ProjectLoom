Excellent questions! These are critical implementation details that will significantly impact Phase 2's scope and user experience. Let me think through each one carefully:

---

## 🤔 **Question 1: Vision Support - Files vs URLs**

### **Recommendation: Image File Uploads (Not URLs) for Phase 2**

**Why:**
- ✅ Matches user expectations (ChatGPT, Claude.ai all use file uploads)
- ✅ Vercel AI SDK supports this natively via `experimental_attachments`
- ✅ Context inheritance works seamlessly (files tracked per message)
- ❌ URLs require additional validation, CORS issues, link rot problems

**Scope for Phase 2:**
```typescript
// What we SHOULD support
interface MessageAttachment {
  type: 'image';
  file: File; // User uploads PNG/JPG/WebP
  preview: string; // Base64 for UI preview
}

// What we should NOT support (Phase 3+)
- PDFs (defer to Phase 3)
- Videos (defer to Phase 3+)
- Arbitrary files (defer to Phase 3+)
- External URLs (defer to Phase 3+)
```

**Implementation Pattern:**
```typescript
// components/ChatPanel.tsx
const { messages, input, handleSubmit, handleImageUpload } = useChat({
  api: '/api/chat',
  experimental_attachments: true, // Enable vision
});

// app/api/chat/route.ts
const result = await streamText({
  model: provider,
  messages,
  experimental_attachments: attachments, // Forward to AI
});
```

**User Flow:**
1. User clicks 📎 attachment button
2. File picker opens (accept: .png, .jpg, .jpeg, .webp)
3. Preview shows in message input
4. On submit, image sent with message
5. AI response includes image in context

**Limits for Phase 2:**
- Max 5MB per image (prevent API quota abuse)
- Max 3 images per message (UX overwhelm prevention)
- Only images (no PDFs/docs yet)

---

## 🤔 **Question 2: Summary Regeneration - Full Context vs Previous Summary**

### **Recommendation: Full Parent Conversation (Always)**

**Why:**
- ✅ Prevents "summary drift" (summary of summary of summary degrades)
- ✅ User has full control (can edit/regenerate with confidence)
- ✅ Transparent cost (user sees exact token count before regenerating)
- ⚠️ Higher token cost, but user-controlled

**The Problem with "Summary of Summary":**
```
Original: 50 messages (10,000 tokens)
→ Summary 1: 200 words
→ Summary 2 (of Summary 1): 150 words (INFORMATION LOSS)
→ Summary 3 (of Summary 2): 100 words (MORE LOSS)
```

**Better Approach (Full Context):**
```
Original: 50 messages (10,000 tokens)
→ Summary 1: 200 words (generated from full 50 messages)
→ Regenerate Summary: 180 words (STILL from full 50 messages)
```

**Implementation:**
```typescript
// lib/summarization.ts
export async function regenerateSummary(
  parentCardId: string,
  model: string,
  apiKey: string
): Promise<Message> {
  const parentCard = getCard(parentCardId);
  
  // ALWAYS use full parent conversation
  const fullParentMessages = parentCard.content;
  
  // Show user token estimate BEFORE calling API
  const estimatedTokens = estimateTokens(fullParentMessages);
  
  // User confirms: "Regenerate summary (~10,000 tokens, ~$0.03)"
  const confirmed = await confirmSummaryRegeneration(estimatedTokens);
  if (!confirmed) return;
  
  // Generate fresh summary from FULL context
  return await generateSummary(fullParentMessages, apiKey, model);
}
```

**UX Flow:**
1. User clicks "Regenerate Summary" on inherited context panel
2. Toast: "This will cost ~10,000 tokens (~$0.03). Continue?"
3. User confirms
4. New summary generated from **full parent conversation**
5. Old summary replaced

**Edge Case: Parent Conversation Updated After Branch**
```typescript
// What if parent gets NEW messages after branch was created?

// Option A: Ignore new messages (use snapshot at branch time) ✅
const messagesAtBranchTime = parentCard.content.slice(
  0, 
  branchPoint.messageIndex + 1
);

// Option B: Include new messages (dynamic summary) ❌
// This is confusing - branch summary should be immutable
```

**Decision: Use snapshot at branch time** (Option A)

---

## 🤔 **Question 3: API Failure Handling**

### **Recommendation: Graceful Degradation + User Recovery**

**Failure Categories:**

### **1. Authentication Failures (Invalid API Key)**
```typescript
// app/api/chat/route.ts
try {
  const result = await streamText({ model: provider, messages });
  return result.toDataStreamResponse();
} catch (error) {
  if (error.status === 401) {
    return Response.json({
      error: 'Invalid API key. Please check your settings.',
      code: 'INVALID_API_KEY',
      recoverable: true,
    }, { status: 401 });
  }
}
```

**User Experience:**
- ❌ Message fails to send
- 🔴 Error banner: "Invalid API key for Claude. Update in Settings?"
- 🔧 Click → Opens settings modal
- ✅ User fixes key, retries message

### **2. Rate Limit Failures**
```typescript
if (error.status === 429) {
  return Response.json({
    error: 'Rate limit exceeded. Wait 60 seconds or try different model.',
    code: 'RATE_LIMIT',
    retryAfter: 60,
    recoverable: true,
  }, { status: 429 });
}
```

**User Experience:**
- ⏱️ Toast: "Rate limit hit. Retry in 60s?"
- ♻️ Auto-retry countdown button
- 🔄 Or: Switch to different model (Claude → GPT)

### **3. Network Failures (Timeout, Connection Lost)**
```typescript
if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
  return Response.json({
    error: 'Network timeout. Check your connection.',
    code: 'NETWORK_ERROR',
    recoverable: true,
  }, { status: 408 });
}
```

**User Experience:**
- 🌐 Toast: "Connection lost. Retry?"
- 🔄 Message remains in draft (not lost)
- ✅ User clicks retry → Resends

### **4. Context Length Exceeded**
```typescript
if (error.status === 400 && error.message.includes('context_length')) {
  return Response.json({
    error: 'Context too long. Try using AI Summary inheritance.',
    code: 'CONTEXT_TOO_LONG',
    recoverable: false, // Requires user action
    suggestion: 'use_summary',
  }, { status: 400 });
}
```

**User Experience:**
- ⚠️ Error: "Context exceeds model limit (200K tokens)"
- 💡 Suggestion: "Branch with AI Summary instead of Full Context"
- 🔧 User creates new branch with summary mode

### **5. Streaming Interruption (Mid-Stream Failure)**
```typescript
// components/ChatPanel.tsx
const { error, isLoading, reload } = useChat({
  onError: (error) => {
    if (error.message.includes('stream')) {
      // Partial response received, offer to keep it
      showPartialResponseDialog(lastPartialMessage);
    }
  },
});
```

**User Experience:**
- 💬 Partial response: "Here's how to fix the bug: First, check your..."
- ❌ Stream cuts off
- 🤔 Dialog: "Keep partial response or retry?"
  - Keep → Saves partial message, user can ask followup
  - Retry → Discards partial, resends original message

---

### **Unified Error Handling UI**

```typescript
// components/ErrorBanner.tsx
interface ErrorBannerProps {
  error: APIError;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div className="error-banner">
      <Icon type={error.code} />
      <p>{error.message}</p>
      
      {error.recoverable && (
        <button onClick={onRetry}>
          {error.retryAfter ? `Retry in ${error.retryAfter}s` : 'Retry'}
        </button>
      )}
      
      {error.suggestion && (
        <button onClick={() => handleSuggestion(error.suggestion)}>
          {getSuggestionLabel(error.suggestion)}
        </button>
      )}
      
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
```

**Draft Message Preservation:**
```typescript
// CRITICAL: Never lose user input on error
const { input, setInput } = useChat({
  onError: (error) => {
    // Input remains in text field (not cleared)
    // User can edit and retry
  },
});
```

---

## 🤔 **Question 4: Agent Workflow Guardrails**

### **Recommendation: Multi-Layer Safety System**

**Problem Scenarios:**
1. Infinite loops (agent keeps calling same tool)
2. Excessive API costs (agent makes 100+ calls)
3. Destructive actions (agent deletes all cards)
4. Runaway execution (agent never stops)

---

### **Guardrail 1: Step Limits**

```typescript
// lib/agents/cleanupAgent.ts
export const cleanupAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4'),
  maxSteps: 10, // HARD LIMIT: Agent can call max 10 tools
  tools: { deleteCard, renameCard },
});

// If agent hits limit:
if (stepCount >= maxSteps) {
  throw new Error('Agent hit step limit (10). Review suggested actions.');
}
```

**UX:**
- Agent proposes 3 deletions, 2 renames (5 steps)
- ✅ User reviews and approves
- Agent executes
- 🛑 If agent tries 11th step → Error toast: "Agent stopped (safety limit)"

---

### **Guardrail 2: Confirmation for Destructive Actions**

```typescript
// lib/agents/cleanupAgent.ts
tools: {
  deleteCard: tool({
    description: 'Mark card for deletion (requires user confirmation)',
    parameters: z.object({ cardId: z.string(), reason: z.string() }),
    execute: async ({ cardId, reason }) => {
      // NEVER auto-delete - always return suggestion
      return { 
        cardId, 
        reason, 
        status: 'pending_confirmation',
        action: 'delete',
      };
    },
  }),
}
```

**Agent Flow:**
1. Agent analyzes workspace
2. Agent calls `deleteCard` tool 5 times (suggests 5 deletions)
3. Tool returns `pending_confirmation` status
4. UI shows confirmation dialog:
   ```
   Agent suggests deleting 5 cards:
   ☐ "Old React notes" - outdated (30 days old)
   ☐ "Test card 123" - empty
   ☐ "Duplicate API design" - duplicate of #45
   
   [Select All] [Select None] [Approve Selected]
   ```
5. User approves 3 out of 5
6. Only approved deletions execute

---

### **Guardrail 3: Cost Estimation & Budgets**

```typescript
// lib/agents/runAgent.ts
export async function runAgent(
  agentType: 'cleanup' | 'branch' | 'summarize',
  workspaceId: string
) {
  // Estimate max cost before running
  const maxSteps = 10;
  const avgTokensPerStep = 2000;
  const estimatedCost = calculateCost(maxSteps * avgTokensPerStep, model);
  
  // Show user upfront
  const confirmed = await confirmAgentRun({
    agentType,
    maxSteps,
    estimatedCost, // e.g., "~$0.05"
  });
  
  if (!confirmed) return;
  
  // Run agent with budget tracking
  let totalTokens = 0;
  const BUDGET_LIMIT = 50000; // 50K tokens max
  
  agent.on('tool.call', (event) => {
    totalTokens += event.usage.tokens;
    
    if (totalTokens > BUDGET_LIMIT) {
      agent.stop();
      throw new Error('Agent exceeded token budget (50K)');
    }
  });
}
```

**UX:**
- User clicks "Clean up workspace"
- Dialog: "Agent will analyze workspace. Estimated cost: ~$0.05 (max 10 steps). Continue?"
- User approves
- Progress bar shows: "Step 3/10 | Tokens used: 6,200 / 50,000"
- ✅ Agent completes or 🛑 hits budget limit

---

### **Guardrail 4: Timeout Protection**

```typescript
// lib/agents/runAgent.ts
const AGENT_TIMEOUT = 60000; // 60 seconds max

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Agent timeout (60s)')), AGENT_TIMEOUT);
});

const agentPromise = agent.generate({ prompt });

const result = await Promise.race([agentPromise, timeoutPromise]);
```

**Why:**
- Prevents agents from running indefinitely
- User sees: "Agent stopped (timeout). Review partial results?"

---

### **Guardrail 5: Infinite Loop Detection**

```typescript
// lib/agents/loopDetection.ts
const toolCallHistory: Map<string, number> = new Map();

agent.on('tool.call', (event) => {
  const toolKey = `${event.name}:${JSON.stringify(event.params)}`;
  
  const callCount = toolCallHistory.get(toolKey) || 0;
  toolCallHistory.set(toolKey, callCount + 1);
  
  if (callCount > 3) {
    agent.stop();
    throw new Error(`Agent is stuck in loop (called ${event.name} 4 times)`);
  }
});
```

**Example:**
- Agent calls `renameCard(cardId: "abc123", newTitle: "Fix")` 
- Agent calls same tool with same params again
- Agent calls AGAIN (3rd time)
- Agent tries 4th time → 🛑 Stopped: "Agent appears stuck. Review actions?"
