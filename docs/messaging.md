# ProjectLoom — Messaging Guide

Single source of truth for all user-facing copy. Every surface (landing page,
README, OG tags, social, video) should pull from these tiers.

**Audience reminder:** Our users are researchers, strategists, writers, and
indie hackers — not developers. They don't know what "Git," "API key," or
"BYOK" means. Write for them.

---

## Messaging Hierarchy

### 1. Tagline

> **Explore every angle. Never start over.**

Used in: landing page hero headline, social bios, video titles, ads.

### 2. Descriptor (SEO-friendly)

> **Branching AI conversations on an infinite canvas**

Used in: page `<title>`, OG title, README header, search result titles.
This is the phrase we want to rank for — it's a *search term*, not a pitch.

### 3. One-liner pitch

> Split any AI conversation into different directions, explore them side by
> side, and combine the best parts — all on one visual canvas.

Used in: OG description, README subtitle, landing page hero subtitle,
anywhere you need one explanatory sentence.

### 4. Pain hook

> **Your conversations deserve more than a scroll bar.**

Used in: social posts, video intros, cold outreach, marketing hooks. Names
the pain before the solution
(see [marketing-principles.md](marketing-principles.md)).

### 5. Privacy line

> **Your data stays in your browser. Always.**

Used in: footer, settings, anywhere trust matters. Replaces all
references to "BYOK" in user-facing copy.

---

## Retired phrases — do not use in user-facing copy

| Phrase | Why |
|--------|-----|
| "BYOK" / "Bring Your Own Key" | Users don't know what this means |
| "Git branches, but for your thinking" | Users don't know what Git is |
| "API key" (without explanation) | Users don't know what an API key is |
| "DAG" / "directed acyclic graph" | Jargon |
| "Visual canvas for AI conversations" | Too generic — replaced by the descriptor |

When you *must* reference API keys (e.g., settings UI, docs for technical
users), explain them: "Your AI provider account key — this goes directly
from your browser to Anthropic or OpenAI. We never see it."

---

## Where each tier appears

| Surface | Tier | Current status |
|---------|------|---------------|
| Landing hero `<h1>` | 1 — Tagline | ✅ Aligned |
| Landing hero `<p>` | 3 — One-liner | ✅ Aligned |
| Landing final CTA heading | 4 — Pain hook | ✅ Aligned |
| Landing footer | 5 — Privacy line | ✅ Aligned |
| `layout.tsx` `<title>` | 2 — Descriptor | ✅ Aligned |
| `layout.tsx` OG description | 3 — One-liner + 5 | ✅ Updated |
| `layout.tsx` OG image alt | 2 — Descriptor | ✅ Updated |
| README tagline | 2 — Descriptor | ✅ Updated |
| README subtitle | 3 — One-liner | ✅ Updated |
| `package.json` description | 2 — Descriptor | ✅ Added |
