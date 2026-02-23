# SEO & Messaging Setup — Reference Guide

A simple checklist for launching a new web project with proper SEO and
consistent marketing messaging. Based on work done for ProjectLoom.

---

## 1. Messaging

Before touching any code, define your messaging hierarchy. Every surface
should pull from the same source.

**The 5 tiers:**

| Tier | Purpose | Used in |
|------|---------|---------|
| **Tagline** | Emotional hook, memorable | Hero headline, social bios |
| **Descriptor** | SEO-friendly, what it is | Page `<title>`, OG title, README |
| **One-liner** | One sentence explanation | OG description, hero subtitle |
| **Pain hook** | Names the problem | Social posts, video intros |
| **Privacy / trust line** | Builds trust | Footer, settings |

**Rules:**
- Write for your actual users — avoid jargon they won't know
- Keep a `docs/messaging.md` as the single source of truth
- Audit all surfaces (README, OG tags, landing page, docs) for consistency

---

## 2. Code changes (Next.js App Router)

### `src/app/layout.tsx`
- Set `title`, `description`, `metadataBase`
- Add `openGraph` block: title, description, image (1200×630 or close), alt
- Add `twitter` block: `summary_large_image` card
- Add `manifest: '/manifest.json'`
- Add JSON-LD structured data script (`SoftwareApplication` schema)

**OG character limits:**
- Title: 50–60 characters
- Description: 110–160 characters
- Image: 1200×630px (1.91:1 ratio) — use a dedicated `og-image.png`, not your README banner

### `src/app/sitemap.ts`
- Next.js generates `/sitemap.xml` automatically from this file
- List every public route with `changeFrequency` and `priority`

### `public/robots.txt`
```
User-agent: *
Allow: /
Sitemap: https://yourdomain.com/sitemap.xml
```

### `public/manifest.json`
- Basic PWA manifest: name, description, start_url, theme_color, icons
- Link it in `layout.tsx` via `manifest: '/manifest.json'`

### `package.json`
- Add a `description` field matching the descriptor tier

---

## 3. OG image

- **File:** `public/og-image.png` (separate from README banner)
- **Size:** 1200×630px recommended (1103×630 also acceptable)
- **Content:** Tagline headline + product visual + domain
- Keep `banner.png` for GitHub README — it uses a wide format (1280×320)

---

## 4. Search engine registration

### Google Search Console
1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Add property → Domain → enter your domain
3. Verify via DNS TXT record (see below)
4. After verification → Sitemaps → submit `https://yourdomain.com/sitemap.xml`

### Adding a DNS TXT record on Vercel
1. Vercel dashboard → click your **team name** (not a project)
2. Left nav → **Domains**
3. Click the domain → **Advanced Settings** → **Add Record**
4. Type: TXT, Name: @, Value: `google-site-verification=...`, TTL: 60
5. Wait 5–30 min, then verify in Search Console

### Bing Webmaster Tools
1. Go to [bing.com/webmasters](https://www.bing.com/webmasters)
2. Sign in with a Microsoft account
3. **Import from Google Search Console** — pulls your site + sitemap automatically
4. Done (also covers Yahoo/DuckDuckGo which use Bing's index)

---

## 5. Validation tools

| Tool | What it checks |
|------|---------------|
| [opengraph.xyz](https://opengraph.xyz) | OG title, description, image preview |
| [search.google.com/test/rich-results](https://search.google.com/test/rich-results) | JSON-LD structured data |
| [whatsmydns.net](https://www.whatsmydns.net) | DNS propagation status |

**What "good" looks like:**
- opengraph.xyz: title 50–60 chars, description 110–160 chars, image 1200×630
- Rich Results Test: "1 valid item detected" — ignore optional fields like `aggregateRating`

---

## 6. Checklist for future projects

- [ ] Write `docs/messaging.md` with 5-tier hierarchy before writing any copy
- [ ] Audit README, OG tags, landing page, and any internal docs for consistency
- [ ] `layout.tsx` — title, description, OG block, Twitter block, manifest, JSON-LD
- [ ] `public/robots.txt` — allow all, reference sitemap
- [ ] `src/app/sitemap.ts` — list all public routes
- [ ] `public/manifest.json` — basic PWA manifest
- [ ] `public/og-image.png` — 1200×630, separate from README banner
- [ ] `package.json` — add description field
- [ ] Register in Google Search Console + submit sitemap
- [ ] Import to Bing Webmaster Tools
- [ ] Validate with opengraph.xyz and Rich Results Test
