# Credit System Architecture

**Version**: 1.0  
**Status**: Design Phase  
**Last Updated**: 2026-02-09

## Overview

Enable non-technical users to use ProjectLoom without managing their own API keys by:
- Purchasing credits through Stripe
- Using developer's API keys transparently
- Pass-through pricing (no markup on AI costs)
- Real-time credit balance tracking

---

## System Components

### 1. Authentication Layer
**Status**: Not implemented (required)

Users need accounts to track credit balances and purchase history.

**Options**:

| Solution | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Clerk** | Drop-in React components, webhook support, great DX | $25/mo after 10k MAU | ⭐ **Best for MVP** |
| **NextAuth v5** | Free, flexible, Next.js native | More setup, need to manage sessions | Good for long-term |
| **Supabase Auth** | Free tier generous, includes DB | Lock-in to Supabase ecosystem | Good if using Supabase |

**Recommendation**: **Clerk** for fastest launch. Switch to NextAuth v5 later if costs scale.

**Implementation Requirements**:
- Sign up / Sign in flows
- User profile management
- Session management with JWT
- Protected API routes
- Sign out functionality

---

### 2. Database Layer
**Status**: Not implemented (required)

Need to store: user credits, transactions, usage logs, API call history.

**Schema Design**:

```sql
-- Users table (managed by auth provider)
-- Clerk/NextAuth handles this

-- Credit Balance
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL UNIQUE,  -- From auth provider
  balance_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Credit Transactions (purchases)
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  amount_usd DECIMAL(10, 4) NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  status TEXT NOT NULL,  -- 'pending' | 'completed' | 'failed' | 'refunded'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usage Records (AI API calls)
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,  -- 'anthropic' | 'openai'
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  conversation_id TEXT,
  source TEXT,  -- 'chat' | 'agent' | 'summarize' | 'embeddings'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_usage_records_user_id_created ON usage_records(user_id, created_at DESC);
CREATE INDEX idx_stripe_payment_intent ON credit_transactions(stripe_payment_intent_id);
```

**Database Options**:

| Solution | Pros | Cons | Cost |
|----------|------|------|------|
| **Vercel Postgres** | Seamless Vercel integration, auto-scaling | Limited free tier (60h compute) | $20/mo for 100h |
| **Supabase** | Generous free tier, real-time, auth included | Separate service to manage | Free → $25/mo |
| **Neon** | Serverless Postgres, excellent free tier | Less ecosystem support | Free → $19/mo |
| **Railway** | Simple, Database + Redis + workers | No free tier anymore | $5/mo minimum |

**Recommendation**: **Neon** for development (best free tier), **Vercel Postgres** for production (simplest deployment).

---

### 3. Payment Processing (Stripe)

**Flow**:
1. User clicks "Buy Credits" → opens Stripe Checkout
2. User selects package ($10, $25, $50, $100)
3. Stripe processes payment → webhook fires
4. Backend receives webhook → credits user account
5. User sees updated balance immediately

**Credit Package Pricing**:
```typescript
const CREDIT_PACKAGES = [
  { amount: 10, bonus: 0 },    // $10 = $10 credits
  { amount: 25, bonus: 2 },    // $25 = $27 credits (8% bonus)
  { amount: 50, bonus: 5 },    // $50 = $55 credits (10% bonus)
  { amount: 100, bonus: 15 },  // $100 = $115 credits (15% bonus)
];
```

**Stripe Components Needed**:
- Stripe account + API keys (publishable + secret)
- Webhook endpoint (`/api/stripe/webhook`)
- Checkout Session creation (`/api/stripe/create-checkout`)
- Customer Portal for refunds/history (optional)

**Security**:
- Verify webhook signatures (prevent fraud)
- Idempotency keys (prevent double-crediting)
- Rate limiting on checkout creation

---

### 4. Credit Mode Toggle

**Preferences Store Changes**:
```typescript
interface PreferencesState {
  // ... existing fields
  apiKeyMode: 'own' | 'credits';  // NEW
  setApiKeyMode: (mode: 'own' | 'credits') => void;  // NEW
}
```

**Settings Panel UI**:
- Radio button group: "Use My Own API Keys" vs "Buy Credits"
- If `apiKeyMode === 'credits'`:
  - Hide API key inputs
  - Show note: "You're using ProjectLoom's AI credits"
- If `apiKeyMode === 'own'`:
  - Show existing API key inputs (Anthropic, OpenAI)

---

### 5. Usage Panel Enhancements

**When `apiKeyMode === 'credits'`**:

Show:
- Live credit balance (e.g., "$12.47 remaining")
- "Buy More Credits" button (→ Stripe Checkout)
- Usage breakdown (same as current)
- Low balance warning (< $5 remaining)

**When `apiKeyMode === 'own'`**:

Show:
- Current usage display (no changes)
- No credit balance or purchase button

---

### 6. API Route Middleware

**Credit Deduction Flow**:

```typescript
// Pseudocode for /api/chat, /api/agent, /api/summarize
export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session) return unauthorized();

  const user = await getUserPreferences(session.userId);

  let apiKey: string;
  
  if (user.apiKeyMode === 'credits') {
    // Use developer's API key
    apiKey = process.env.ANTHROPIC_API_KEY!;
    
    // Check balance BEFORE making call
    const balance = await getCreditBalance(session.userId);
    if (balance < 0.10) {  // Minimum $0.10 required
      return insufficientCredits();
    }
  } else {
    // Use user's API key (existing BYOK flow)
    apiKey = req.headers.get('x-anthropic-api-key')!;
    if (!apiKey) return missingApiKey();
  }

  // Make AI call with appropriate key
  const result = await streamText({ apiKey, ...params });

  // AFTER call completes, deduct credits
  if (user.apiKeyMode === 'credits') {
    const cost = calculateCost(model, inputTokens, outputTokens);
    await deductCredits(session.userId, cost, {
      provider, model, inputTokens, outputTokens, conversationId, source
    });
  }

  return result.toDataStreamResponse();
}
```

**Key Considerations**:
- **Atomic balance updates**: Use database transactions
- **Pre-flight balance check**: Prevent overdrafts
- **Post-call deduction**: Only charge for actual usage
- **Failure handling**: If deduction fails, log error but don't block user
- **Rate limiting**: Prevent abuse (e.g., 100 requests/min per user)

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal**: Set up auth + database

- [ ] Choose auth provider (Clerk recommended)
- [ ] Install Clerk SDK: `npm install @clerk/nextjs`
- [ ] Add sign-in/sign-up pages
- [ ] Protect API routes with auth middleware
- [ ] Set up Neon database (free tier for dev)
- [ ] Run schema migrations
- [ ] Create database utility functions (getBalance, deductCredits, etc.)

**Deliverables**: Users can sign in, database ready

---

### Phase 2: Stripe Integration (Week 2-3)
**Goal**: Users can purchase credits

- [ ] Create Stripe account + get API keys
- [ ] Install Stripe SDK: `npm install stripe @stripe/stripe-js`
- [ ] Create `/api/stripe/create-checkout` route
- [ ] Create `/api/stripe/webhook` route (handle `payment_intent.succeeded`)
- [ ] Add webhook signature verification
- [ ] Test purchases in Stripe test mode
- [ ] Implement idempotency (prevent double-credits)

**Deliverables**: Users can buy credits, balance updates correctly

---

### Phase 3: Frontend (Week 3-4)
**Goal**: UI for credit mode

- [ ] Add `apiKeyMode` to preferences store
- [ ] Update Settings Panel with mode toggle
- [ ] Create `CreditBalance` component for Usage Panel
- [ ] Add "Buy More Credits" button → opens Stripe Checkout
- [ ] Show low balance warning (< $5)
- [ ] Hide API key inputs when in credit mode
- [ ] Add loading states for balance fetching

**Deliverables**: Users can toggle mode, see balance, purchase credits

---

### Phase 4: API Proxy (Week 4-5)
**Goal**: Route AI calls through credit system

- [ ] Add auth check to `/api/chat` route
- [ ] Add auth check to `/api/agent` route
- [ ] Add auth check to `/api/summarize` route
- [ ] Add auth check to `/api/embeddings` route
- [ ] Implement pre-flight balance check
- [ ] Use developer API key when `apiKeyMode === 'credits'`
- [ ] Post-call credit deduction
- [ ] Error handling (insufficient credits, failed deduction)

**Deliverables**: Credit mode works end-to-end

---

### Phase 5: Polish & Launch (Week 5-6)
**Goal**: Production-ready

- [ ] Add rate limiting (Upstash Rate Limit or Vercel Edge Config)
- [ ] Set up Stripe production keys
- [ ] Switch to Vercel Postgres for production
- [ ] Add transaction history page
- [ ] Add email notifications (low balance, purchase confirmation)
- [ ] Write user documentation
- [ ] Load testing (simulate 100 concurrent users)
- [ ] Security audit (webhook verification, SQL injection, XSS)

**Deliverables**: Launch credit system to users

---

## Technical Decisions & Tradeoffs

### Why Clerk over NextAuth?
- **Faster MVP**: Drop-in components save 2-3 weeks
- **Better UX**: Pre-built sign-in/sign-up flows
- **Webhook support**: Easy Stripe integration
- **Migration path**: Can switch to NextAuth v5 later if costs scale

### Why Neon for Development?
- **Most generous free tier**: 10 databases, 3GB storage, 1GB transfer
- **Serverless**: Auto-scales, no connection pooling headaches
- **Postgres**: Standard SQL, easy migrations

### Why pass-through pricing?
- **Trust**: Users see exact AI costs, no hidden markup
- **Simplicity**: No complex pricing tiers
- **Competitive**: Undercuts competitors who mark up 50-100%
- **Volume play**: Profit from Stripe transaction fees (~2.9% + $0.30)

**Example**: User spends $100 on credits:
- Stripe fee: ~$3.20
- User gets: $100 in AI credits
- Your revenue: **$0** (but future upsells, user trust, larger TAM)

Alternative: 20% markup → user gets $80 credits, you keep $16.80 net of Stripe.

### Rate Limiting Strategy
Prevent abuse while keeping UX smooth:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/chat` | 60 req | 1 min |
| `/api/agent` | 20 req | 1 min |
| `/api/stripe/create-checkout` | 10 req | 1 hour |
| `/api/stripe/webhook` | Unlimited | (Stripe validates) |

Use Vercel Edge Config or Upstash Redis for distributed rate limiting.

---

## Cost Estimates

### Development Phase (Months 1-2)
- Clerk: **Free** (< 10k MAU)
- Neon DB: **Free** (< 0.5GB)
- Stripe: **$0** (test mode)
- Vercel: **Free** (hobby plan)
- **Total**: $0/month

### Production Phase (assuming 1,000 users, 500 paid users, $50 avg credit purchase)
- Clerk: **$25/mo** (10k-50k MAU tier)
- Vercel Postgres: **$20/mo** (100h compute)
- Stripe: **$725/mo** (2.9% + $0.30 × 500 transactions)
- Vercel: **$20/mo** (Pro plan for better limits)
- **Total**: ~$790/month
- **Revenue**: $25,000/month (500 users × $50)
- **AI Costs**: ~$20,000/month (assuming 80% of credits used)
- **Gross Margin**: $4,210/month (21%)

With 20% markup instead:
- **Revenue**: $25,000/month
- **Credits issued**: $20,000 ($25k / 1.25)
- **AI Costs**: $16,000 (80% utilization of $20k)
- **Gross Margin**: $8,210/month (41%)

---

## Security Checklist

- [ ] **Stripe Webhook Verification**: Always verify `stripe.webhooks.constructEvent()` signature
- [ ] **Idempotency Keys**: Use `stripe_payment_intent_id` to prevent double-credits
- [ ] **SQL Injection**: Use parameterized queries (Drizzle ORM recommended)
- [ ] **Rate Limiting**: Prevent API abuse and credit farming
- [ ] **API Key Protection**: Never expose developer API keys in client code
- [ ] **Auth Middleware**: All `/api/*` routes check valid session
- [ ] **Credit Balance Race Conditions**: Use database transactions for deductions
- [ ] **XSS Prevention**: Sanitize all user inputs in UI
- [ ] **CSRF Protection**: Use SameSite cookies + CSRF tokens

---

## Next Steps

1. **Decision**: Choose auth provider (Clerk recommended) ✅
2. **Decision**: Choose database (Neon for dev, Vercel Postgres for prod) ✅
3. **Decision**: Markup strategy (pass-through vs 20%)
4. **Setup**: Create Stripe account + get test keys
5. **Setup**: Create Neon account + provision database
6. **Development**: Start Phase 1 (auth + database)

Would you like me to:
- A) Start Phase 1 implementation (auth + database setup)
- B) Create detailed technical specs for any specific component
- C) Build a proof-of-concept for the credit deduction flow
- D) Something else?
