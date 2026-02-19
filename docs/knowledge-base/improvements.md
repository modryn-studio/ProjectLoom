# Knowledge Base — Architecture & Improvements

Last updated: February 19, 2026

---

## Current Architecture

| Property | Value |
|---|---|
| Storage | IndexedDB (`projectloom-kb`) + Zustand/localStorage metadata |
| Max files | 10 per workspace |
| Max file size | 500 KB |
| Supported formats | `.txt`, `.md`, `.js`, `.tsx`, `.py`, ~30 code extensions |
| Injection method | **Full-context** — all file contents sent in system prompt |
| Fallback | TF-IDF chunked retrieval (only if KB exceeds ~100K tokens / 400K chars) |
| Max instructions | 1,500 chars |

**Key files**: `src/lib/knowledge-base-db.ts`, `src/lib/rag-utils.ts`, `src/components/CanvasContextModal.tsx`, `src/components/ChatPanel.tsx`

**How it works**: On workspace load, `ChatPanel` reads all KB files from IndexedDB and formats them as `## filename\n\ncontent`. This full string is sent as a `## Knowledge Base Context` section in the system prompt. Per Anthropic's recommendation, KBs under 200K tokens (~500 pages) should use full-context injection, not RAG. Typical workspace KBs are 2K–20K tokens.

If the KB exceeds ~100K tokens, `ChatPanel` falls back to TF-IDF keyword retrieval via `rag-utils.ts` (top chunks by relevance score).

---

## Improvements (vs. ChatGPT Projects / Claude Projects)

### 1. No retrieval feedback
User has no visibility into whether KB content was included in a message's context. Add a subtle icon/tooltip in the chat UI.

### 2. No PDF/DOCX support
Only text and code files accepted. Add `pdf.js` (Mozilla) and `mammoth.js` for client-side extraction at upload time.

### 3. Local-only storage
KB lives in browser IndexedDB only. Clearing browser or switching devices loses data. Sync to backend when server-side features are added.

### 4. No source attribution
User can't see which KB files contributed to a response. Surface filenames as collapsible "sources" in the AI response.
