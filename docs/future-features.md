# Future Features

Last updated: February 22, 2026

> Items tracked as GitHub issues are marked with their issue number.

---

## High Priority

### Tiered Context System
Auto-summarize historical messages when inherited context exceeds token limits. Currently all messages are sent in full — works for typical conversations but can hit limits with deep branch chains or 5-parent merges with long histories. Approach: keep most recent N messages as-is, AI-summarize older ones on demand.

### PDF/DOCX Knowledge Base Support
Only plain text and code files accepted currently. Add client-side parsing via `pdf.js` (Mozilla) and `mammoth.js` for DOCX. Extract text at upload time, store as plain text in IndexedDB. No change to retrieval pipeline.

### KB Retrieval Feedback
No UI indication when KB context is or isn't injected into a message. Add a subtle indicator (icon/tooltip) in the chat showing whether KB content was included and which files contributed.

---

## Medium Priority

### Edge Virtualization
Only render edges for cards visible in viewport. Needed when canvas grows to 100+ cards and 150+ edges.

### Level of Detail (LOD)
Simplify card and edge rendering when zoomed out (e.g., hide message previews, thin edges, no animations below 0.5x zoom).

### Credit System (Hosted Mode)
Allow non-technical users to use the app without their own API keys via a credit-based payment system. Stack: Clerk (auth) + Stripe (payments) + Neon/Vercel Postgres (database). Users buy credits, app proxies API calls and deducts balance. BYOK mode remains for power users. *(See GitHub issue #17)*

### Server-Side KB Storage
Currently KB lives only in browser IndexedDB. Sync to backend for multi-device access. IndexedDB remains as local cache.

---

## Low Priority

### Collaborative Features
Multi-user editing with real-time presence, card-level locks, merge conflict resolution, activity feed.

### Advanced Merge Algorithms
Smart context selection: auto-detect most relevant parent messages via semantic similarity, suggest which parents to include/exclude, adaptive summarization.

### Cross-Workspace References
Allow linking cards across workspaces without full branching/merging.

### Conversation Export
Export workspace or individual conversations as markdown, JSON, or PDF.

### Mobile-Responsive Canvas
Touch-friendly canvas interaction, mobile-optimized layout, swipe navigation. *(See GitHub issue #16)*

### Product Analytics
Instrument key user actions (branch, merge, onboarding completion, session length) for data-driven decisions. *(See GitHub issue #18)*