Where should canvas-level instructions/knowledge base be stored for Phase 2? (Impacts migrations and file size limits.) LocalStorage or IndexedDB?

**IndexedDB** - no question.

## Why IndexedDB

**File Storage:**
- LocalStorage: 5-10MB total limit
- IndexedDB: 50MB+ (often hundreds of MB)

**Math:**
- 10 files × 500KB = 5MB just for knowledge base
- Plus canvas data, conversation history, etc.
- LocalStorage would hit limits immediately

**Performance:**
- LocalStorage is synchronous (blocks UI)
- IndexedDB is asynchronous (no blocking)

## Implementation

```typescript
// Store structure
{
  canvases: Canvas[], // LocalStorage OK (metadata)
  files: Map<fileId, Blob> // IndexedDB (binary content)
}
```

**Hybrid approach:**
- Canvas settings metadata → LocalStorage (fast, small)
- File contents → IndexedDB (large, async)

## Migration Impact

**Clean:** New schema for Phase 2 since no users yet. Just add IndexedDB alongside existing LocalStorage.

**Later migrations:** If we add cloud storage in Phase 3, IndexedDB serves as local cache.

---

For Phase 2, should we implement full PDF/DOCX extraction now or limit to text/markdown/code and store unsupported files with a warning?

**Limit to text/markdown/code for Phase 2.**

## Reasoning

**Scope creep:** PDF/DOCX extraction adds:
- New dependencies (`pdf-lib`, `mammoth.js`)
- Edge cases (corrupted files, images in PDFs, complex formatting)
- Testing burden
- More ways to fail

**Pragmatic path:**
1. Phase 2: `.txt`, `.md`, code files (zero dependencies, always works)
2. Phase 3: Add PDF/DOCX extraction when you have users asking for it

## Implementation

```typescript
const SUPPORTED_FORMATS = ['.txt', '.md', '.js', '.tsx', '.py', /* etc */];

function validateFile(file: File) {
  const ext = file.name.split('.').pop();
  if (!SUPPORTED_FORMATS.includes(`.${ext}`)) {
    throw new Error(
      `Unsupported format. Supported: text, markdown, code files.`
    );
  }
}
```

**UX:** Clear error message on upload: "PDF support coming soon. Currently: .txt, .md, code files"

**Benefit:** Ship Phase 2 faster, add PDF/DOCX only if users actually need it.

---

When knowledge base changes, should it apply only to new messages, or should ongoing conversations/threads be updated immediately?

**New messages only.**

## Why

**Predictable UX:**
- Existing conversations stay stable
- Users know what context their messages had
- No surprise changes to past responses

**Matches ChatGPT/Claude:**
- Both apply settings changes only to new messages
- Past conversations maintain their original context

**Technical simplicity:**
- No need to track "context version" per message
- No re-processing old messages
- Clear cutoff point

## Implementation

```typescript
// Message stores snapshot of context at send time
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  contextSnapshot?: {
    instructions: string;
    knowledgeBaseFileIds: string[];
  }; // Optional: for debugging/history
}
```

**When settings change:**
- Next message uses new settings
- Previous messages unchanged
- User sees updated behavior immediately on next send

**User mental model:** "Updating instructions affects new conversations from this point forward."

---

Should the KB be injected as a separate system message (e.g., 'Knowledge Base: ...') or appended to the same system prompt as instructions?

**Separate system message.**

## Why

**Clarity in prompt structure:**
```typescript
messages: [
  { role: 'system', content: canvas.settings.instructions },
  { role: 'system', content: `Knowledge Base:\n\n${knowledgeBaseContent}` },
  ...conversationHistory
]
```

**Benefits:**
- Instructions stay clean and user-readable
- Easy to toggle knowledge base on/off for debugging
- Clear separation of user instructions vs. reference material
- Matches how RAG systems typically inject retrieved content

**Alternative (appended):**
```typescript
system: `${instructions}\n\nKnowledge Base:\n${files}`
```
Works too, but mixes user intent with reference data.

**Recommendation:** Separate system messages. Cleaner architecture, easier to evolve to RAG in Phase 3.

---

