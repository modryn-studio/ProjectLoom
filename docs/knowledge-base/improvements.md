# Knowledge Base — Future Improvements

Research date: February 18, 2026  
Reference: comparison against ChatGPT Projects and Claude Projects

---

## Current Architecture (as of Feb 2026)

| Property | Value |
|---|---|
| Storage | IndexedDB (`projectloom-kb`) + Zustand/localStorage metadata |
| Max files | 10 |
| Max file size | 500 KB |
| Max total size | 5 MB |
| Supported formats | `.txt`, `.md`, `.markdown`, `.js`, `.jsx`, code files |
| Chunk size | 1,400 chars with 200-char overlap |
| **Hard chunk cap** | **200 total chunks across all files (silent drop beyond)** |
| Retrieval per request | Top 6 chunks, min score 0.15, max 5,000 chars injected into system prompt |
| Scoring method | TF-IDF; optional cosine similarity if in-browser embeddings are ready |
| Embedding compute | In-browser via `transformers.js` (`transformers-embeddings.ts`) |
| Max instructions | 1,500 chars |

Relevant files: `src/lib/rag-utils.ts`, `src/lib/knowledge-base-db.ts`, `src/lib/transformers-embeddings.ts`, `src/components/CanvasContextModal.tsx`, `src/components/ChatPanel.tsx`.

---

## Gap Analysis vs. ChatGPT Projects / Claude Projects

### 1. Silent chunk truncation (highest priority)
**Problem**: When total chunks across all uploaded files exceeds 200, content beyond that cap is silently dropped. The user has no indication that part of their KB is unreachable.  
**ChatGPT/Claude**: No silent drops. Claude auto-activates RAG and shows a visual indicator. ChatGPT scales server-side.  
**Fix**: Add a warning in `CanvasContextModal` when the total chunk count approaches or exceeds the cap. Show which files are partially or fully excluded. Consider raising or removing the cap.  
_Constants to change: `maxTotalChunks` in `DEFAULT_BUILD_OPTIONS` in `rag-utils.ts`._

### 2. No retrieval feedback
**Problem**: If a query scores below `minScore` (0.15), zero KB context is injected with no indication to the user. Similarly, if the KB is large and most of it is truncated (issue #1), the user has no visibility.  
**Claude**: Shows a "project knowledge search" tool call in the UI when RAG is active.  
**Fix**: Surface a subtle indicator in the chat UI when KB context was (or wasn't) successfully retrieved for a given message. Could be as simple as a tooltip on a KB icon in the message header.

### 3. In-browser embedding compute
**Problem**: `transformers.js` runs the embedding model in the browser. First load downloads ~100MB+ of model weights, is slow, and can fail silently. If embeddings fail, retrieval falls back to TF-IDF (keyword-only), which degrades quality for semantic queries.  
**ChatGPT/Claude**: Server-side embedding — fast, consistent, no client-side download.  
**Fix (server-side)**: Move embedding generation to an API route. Use the AI provider's embedding endpoint (e.g., `text-embedding-3-small` via OpenAI API, or a lightweight hosted model) at file-upload time, store vectors in IndexedDB alongside chunks.  
**Fix (short-term)**: At minimum, show a loading/error state in `CanvasContextModal` when the embedding model is initializing or failed.

### 4. No PDF / DOCX support
**Problem**: Only plain text and code files are accepted. Users cannot upload PDFs, Word docs, or spreadsheets.  
**ChatGPT/Claude**: Both support PDF, DOCX, images, spreadsheets natively.  
**Fix**: Integrate a client-side parser:
- PDF: [`pdf.js`](https://mozilla.github.io/pdf.js/) (Mozilla, well-maintained)
- DOCX: [`mammoth.js`](https://github.com/mwilliamson/mammoth.js)  
Extract text at upload time and store as plain text in IndexedDB. No change to the retrieval pipeline.

### 5. Local-only storage
**Problem**: KB files live in the browser's IndexedDB. Clearing the browser or switching devices loses all KB data.  
**ChatGPT/Claude**: Files stored server-side, accessible from any device.  
**Fix**: Sync KB file content to the backend (e.g., Supabase storage or a simple `/api/kb` endpoint). This pairs naturally with any future multi-device or collaboration features. IndexedDB can remain as a local cache.

### 6. Retrieval quality with many documents
**Problem**: TF-IDF scores dilute as the corpus grows. With 10 files and a 200-chunk cap, later files may see consistently lower scores and essentially never be retrieved.  
**Fix**: Once server-side embeddings are available (see #3), switch retrieval to cosine similarity on dense vectors, which scales much better across large corpora than TF-IDF.

### 7. No feedback on which KB content was used
**Problem**: The user cannot see which documents or chunks contributed to a response.  
**Fix**: Return source metadata from the RAG retrieval step (filename, chunk index) and optionally surface it as collapsible "sources" at the bottom of the AI response — similar to how Perplexity shows web citations.

---

## Suggested Priority Order

1. **Silent chunk truncation warning** — low effort, high user impact, no architecture change  
2. **PDF/DOCX support** — medium effort, highly visible feature gap  
3. **Server-side embeddings** — medium-high effort, fixes reliability + quality  
4. **Retrieval feedback / source attribution** — medium effort, good UX signal  
5. **Server-side storage** — larger effort, prerequisite for multi-device/collab  
6. **TF-IDF → dense vector retrieval** — deferred until server-side embeddings land  
