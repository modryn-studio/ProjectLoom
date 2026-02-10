# Credit System: Quick Start Guide

**Goal**: Enable users to buy credits and use ProjectLoom without managing API keys

---

## Decision Matrix

Make these 4 key decisions before starting:

### 1. Auth Provider
| Provider | Time to MVP | Cost | Complexity | Recommendation |
|----------|-------------|------|------------|----------------|
| **Clerk** | 2-3 days | $25/mo after 10k users | ⭐ Low | **Best for quick launch** |
| NextAuth v5 | 5-7 days | Free | ⭐⭐ Medium | Best for long-term |
| Supabase Auth | 3-4 days | Free tier generous | ⭐⭐ Medium | If using Supabase DB |

**→ Recommendation: Clerk** (fastest, great DX, easy migration path later)

---

### 2. Database
| Provider | Free Tier | Latency | Ease of Use | Recommendation |
|----------|-----------|---------|-------------|----------------|
| **Neon** | 10 DBs, 3GB | ~50ms | ⭐⭐⭐ Excellent | **Best for dev** |
| Vercel Postgres | 60h/mo compute | ~20ms | ⭐⭐ Good | Best for prod |
| Supabase | 500MB, 2 projects | ~80ms | ⭐⭐ Good | If using Supabase Auth |

**→ Recommendation: Neon for dev, Vercel Postgres for production**

---

### 3. Pricing Strategy
| Model | User Trust | Your Revenue | Complexity | Recommendation |
|-------|------------|--------------|------------|----------------|
| **Pass-through** | ⭐⭐⭐ High | $0 per transaction | ⭐ Low | **Best for MVP** |
| 20% markup | ⭐⭐ Medium | ~$4/user/mo | ⭐ Low | Good for revenue |
| Tiered plans | ⭐ Low | Higher margins | ⭐⭐⭐ High | Revisit after PMF |

**→ Recommendation: Pass-through for MVP** (builds trust, simpler, larger TAM)

---

### 4. Scope for Week 1
| Approach | Time | Risk | User Value | Recommendation |
|----------|------|------|------------|----------------|
| **Full implementation** | 5-6 weeks | High | ⭐⭐⭐ High | If committed |
| Auth + DB only | 1-2 weeks | Low | ⭐ Low | Foundation first |
| **Proof of concept** | 3-4 days | Low | ⭐⭐ Medium | **Best for validation** |

**→ Recommendation: Start with PoC** (validate demand before full build)

---

## Proof of Concept (3-4 Days)

Build minimal version to validate user interest:

### Day 1: Auth Setup
- [ ] Create Clerk account (free): https://clerk.com
- [ ] Install: `npm install @clerk/nextjs`
- [ ] Follow quickstart: https://clerk.com/docs/quickstarts/nextjs
- [ ] Add sign-in button to Settings Panel
- [ ] Protect one API route with `auth()` middleware
- [ ] **Test**: Can sign in and make authenticated API call

### Day 2: Database Setup
- [ ] Create Neon account (free): https://neon.tech
- [ ] Create database, copy connection string
- [ ] Add to `.env.local`: `POSTGRES_URL=postgres://...`
- [ ] Install: `npm install @vercel/postgres`
- [ ] Run schema from `docs/credit-system/database-schema.sql`
- [ ] Create `src/lib/credit-db.ts` with `getCreditBalance()` function
- [ ] **Test**: Can query balance from database

### Day 3: Stripe Setup
- [ ] Create Stripe account (free): https://stripe.com
- [ ] Get test API keys from Dashboard
- [ ] Add to `.env.local`: `STRIPE_SECRET_KEY=sk_test_...`
- [ ] Install: `npm install stripe @stripe/stripe-js`
- [ ] Create `/api/stripe/create-checkout` route
- [ ] Create simple "Buy $10 Credits" button in Settings
- [ ] **Test**: Button redirects to Stripe Checkout (test mode)

### Day 4: Webhook + Polish
- [ ] Install Stripe CLI: `stripe login`, `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- [ ] Create `/api/stripe/webhook` route
- [ ] Test webhook with test payment
- [ ] Add credit balance display in Usage panel
- [ ] **Test**: Purchase $10 → balance updates to $10.00

**Success Criteria**: User can sign in, purchase credits, see balance update

---

## Full Implementation (5-6 Weeks)

Once PoC validated, build production version:

### Phase 1: Foundation (Week 1-2)
- [ ] Complete auth setup (sign-up flow, profile page)
- [ ] Complete database (all tables, indexes, functions)
- [ ] Implement `credit-db.ts` utils (get, add, deduct)
- [ ] Add error handling and logging
- [ ] Write database tests

### Phase 2: Payments (Week 2-3)
- [ ] Multiple credit packages ($10, $25, $50, $100)
- [ ] Bonus credits for larger purchases
- [ ] Stripe webhook signature verification
- [ ] Idempotency to prevent double-credits
- [ ] Transaction history page

### Phase 3: UI (Week 3-4)
- [ ] Settings Panel: toggle "Own API Keys" vs "Buy Credits"
- [ ] Usage Panel: credit balance + "Buy More" button
- [ ] Low balance warning (< $5)
- [ ] Loading states and error messages
- [ ] Purchase confirmation toast

### Phase 4: API Proxy (Week 4-5)
- [ ] Store `apiKeyMode` preference in database
- [ ] Update `/api/chat` to check mode and use appropriate key
- [ ] Update `/api/agent` 
- [ ] Update `/api/summarize`
- [ ] Update `/api/embeddings`
- [ ] Pre-flight balance check
- [ ] Post-call credit deduction
- [ ] Handle errors (insufficient credits, deduction failures)

### Phase 5: Production (Week 5-6)
- [ ] Rate limiting (Upstash or Vercel Edge Config)
- [ ] Switch to Stripe production keys
- [ ] Configure webhook in Stripe Dashboard
- [ ] Migrate to Vercel Postgres for production
- [ ] Email notifications (low balance, purchase confirmation)
- [ ] Monitoring and alerts (Sentry, Vercel Analytics)
- [ ] Load testing (100 concurrent users)
- [ ] Security audit
- [ ] User documentation

---

## Immediate Next Steps (Choose One)

### Option A: Full Commitment (5-6 weeks)
**If you're certain about this feature and have time:**

1. **Today**: Create Clerk + Neon accounts, get API keys
2. **Tomorrow**: Install packages, run schema, protect first API route
3. **This week**: Complete auth + database foundation
4. **Next 4 weeks**: Follow full implementation roadmap

**Best for**: Validated demand, committed to feature, have development time

---

### Option B: Quick PoC (3-4 days)
**If you want to test waters first:**

1. **Today**: Create accounts (Clerk, Neon, Stripe test mode)
2. **Day 1-2**: Auth + simple balance display
3. **Day 3**: Stripe checkout flow
4. **Day 4**: Webhook + test purchase

**Best for**: Uncertain about demand, want to validate concept quickly

---

### Option C: Just Planning (Now)
**If you need more time to decide:**

- Review all documentation in `docs/credit-system/`
- Calculate expected costs at target user volume
- Survey users about interest in credit system
- Decide on auth/database/pricing strategy
- Come back when ready to implement

**Best for**: Early stage, not sure about timing, gathering requirements

---

## What I Can Help With

Once you choose an option:

**Option A** - I can:
- Generate complete auth setup code (Clerk + protected routes)
- Generate all database utility functions
- Generate all API routes (balance, checkout, webhook, deductions)
- Generate all UI components (balance display, buy button, mode toggle)
- Help debug issues during implementation

**Option B** - I can:
- Build PoC in one session (3-4 hour pair programming)
- Generate minimal working version
- Help validate with test payments

**Option C** - I can:
- Answer specific technical questions
- Help calculate cost projections
- Review alternative approaches
- Design custom pricing strategy

---

## Cost Calculator

**At 1,000 monthly active users (MAU), 500 paying:**

| Expense | Amount |
|---------|--------|
| Clerk | $25/mo |
| Vercel Postgres | $20/mo |
| Stripe (2.9% + $0.30 × 500) | ~$725/mo |
| Vercel Pro | $20/mo |
| **Total Overhead** | **$790/mo** |

| Revenue Model | Gross Revenue | Net Margin |
|---------------|---------------|------------|
| Pass-through (0% markup) | $25,000 | $4,210 (21%) |
| 20% markup | $25,000 | $8,210 (41%) |

**Break-even**: ~200 paying users at $50 avg purchase

---

## Questions Before Starting?

1. **Which option?** A (full), B (PoC), or C (planning)?
2. **Pricing strategy?** Pass-through or markup?
3. **Timeline?** When do you want this live?
4. **Blockers?** Any concerns or unknowns?

Let me know and I'll help with next steps! 🚀
