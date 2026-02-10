# Credit System Implementation Guide

Quick reference for implementing the credit system components.

---

## 1. Preferences Store (State Management)

**File**: `src/stores/preferences-store.ts`

```typescript
// Add to PreferencesState interface
interface PreferencesState {
  // ... existing fields
  apiKeyMode: 'own' | 'credits';
  setApiKeyMode: (mode: 'own' | 'credits') => void;
}

// Add to store implementation
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      // ... existing state
      apiKeyMode: 'own',
      setApiKeyMode: (mode) => set({ apiKeyMode: mode }),
    }),
    {
      name: STORAGE_KEYS.PREFERENCES,
      // ... rest of persist config
    }
  )
);

// Selector
export const selectApiKeyMode = (s: PreferencesState) => s.apiKeyMode;
```

---

## 2. Database Utilities

**File**: `src/lib/credit-db.ts` (new file)

```typescript
import { sql } from '@vercel/postgres';

export interface CreditBalance {
  balance: number;
  lifetimeSpent: number;
}

export interface UsageRecord {
  provider: 'anthropic' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  conversationId?: string;
  source?: 'chat' | 'agent' | 'summarize' | 'embeddings';
}

/**
 * Get user's credit balance. Creates user record if doesn't exist.
 */
export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  // Ensure user exists
  await sql`
    INSERT INTO user_credits (user_id, balance_usd) 
    VALUES (${userId}, 0) 
    ON CONFLICT (user_id) DO NOTHING
  `;

  const result = await sql`
    SELECT balance_usd, lifetime_spent_usd 
    FROM user_credits 
    WHERE user_id = ${userId}
  `;

  const row = result.rows[0];
  return {
    balance: parseFloat(row.balance_usd),
    lifetimeSpent: parseFloat(row.lifetime_spent_usd),
  };
}

/**
 * Deduct credits after AI call. Throws if insufficient balance.
 */
export async function deductCredits(
  userId: string,
  costUsd: number,
  usage: UsageRecord
): Promise<void> {
  const client = await sql.connect();

  try {
    await client.query('BEGIN');

    // Deduct from balance (will fail if insufficient)
    const updateResult = await client.query(
      `UPDATE user_credits 
       SET balance_usd = balance_usd - $1,
           lifetime_spent_usd = lifetime_spent_usd + $1
       WHERE user_id = $2 AND balance_usd >= $1`,
      [costUsd, userId]
    );

    if (updateResult.rowCount === 0) {
      throw new Error('Insufficient credits');
    }

    // Record usage
    await client.query(
      `INSERT INTO usage_records (
        user_id, provider, model, input_tokens, output_tokens,
        cost_usd, conversation_id, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        usage.provider,
        usage.model,
        usage.inputTokens,
        usage.outputTokens,
        costUsd,
        usage.conversationId || null,
        usage.source || null,
      ]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Add credits from Stripe purchase
 */
export async function addCredits(
  userId: string,
  amountUsd: number,
  stripePaymentIntentId: string
): Promise<void> {
  const client = await sql.connect();

  try {
    await client.query('BEGIN');

    // Add to balance
    await client.query(
      `UPDATE user_credits 
       SET balance_usd = balance_usd + $1 
       WHERE user_id = $2`,
      [amountUsd, userId]
    );

    // Mark transaction as completed
    await client.query(
      `UPDATE credit_transactions 
       SET status = 'completed', completed_at = NOW() 
       WHERE stripe_payment_intent_id = $1`,
      [stripePaymentIntentId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## 3. Settings Panel UI

**File**: `src/components/SettingsPanel.tsx`

Add after the existing API keys section:

```tsx
// At the top with other imports
import { usePreferencesStore, selectApiKeyMode } from '@/stores/preferences-store';

// Inside the component
const apiKeyMode = usePreferencesStore(selectApiKeyMode);
const setApiKeyMode = usePreferencesStore((s) => s.setApiKeyMode);

// In the JSX, replace API Keys section with:
<div style={sectionStyles}>
  <div style={sectionTitleStyles}>
    <Key size={14} color={colors.accent.primary} />
    API Configuration
  </div>

  {/* Mode Toggle */}
  <div style={{ marginBottom: spacing[3] }}>
    <label style={labelStyles}>API Key Mode</label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
      <label style={checkboxLabelStyles}>
        <input
          type="radio"
          name="apiKeyMode"
          value="own"
          checked={apiKeyMode === 'own'}
          onChange={(e) => setApiKeyMode(e.target.value as 'own' | 'credits')}
        />
        <span>Use My Own API Keys</span>
      </label>
      <label style={checkboxLabelStyles}>
        <input
          type="radio"
          name="apiKeyMode"
          value="credits"
          checked={apiKeyMode === 'credits'}
          onChange={(e) => setApiKeyMode(e.target.value as 'own' | 'credits')}
        />
        <span>Buy Credits (Easier for Non-Technical Users)</span>
      </label>
    </div>
  </div>

  {/* Show API key inputs only if mode is 'own' */}
  {apiKeyMode === 'own' && (
    <>
      {/* Existing Anthropic API Key input */}
      {/* Existing OpenAI API Key input */}
      {/* ... */}
    </>
  )}

  {/* Show note if mode is 'credits' */}
  {apiKeyMode === 'credits' && (
    <div style={{
      padding: spacing[3],
      backgroundColor: colors.bg.inset,
      borderRadius: effects.border.radius.default,
      border: `1px solid ${colors.border.default}`,
    }}>
      <p style={{ 
        fontSize: typography.sizes.sm, 
        color: colors.fg.secondary,
        margin: 0,
      }}>
        You're using ProjectLoom credits. View your balance and purchase more credits in the Usage panel.
      </p>
    </div>
  )}
</div>
```

---

## 4. Credit Balance Component

**File**: `src/components/CreditBalance.tsx` (new file)

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { DollarSign, AlertCircle } from 'lucide-react';
import { colors, spacing, effects, typography } from '@/lib/design-tokens';
import { usePreferencesStore, selectApiKeyMode } from '@/stores/preferences-store';
import { formatUsd } from '@/stores/usage-store';

export function CreditBalance() {
  const apiKeyMode = usePreferencesStore(selectApiKeyMode);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (apiKeyMode === 'credits') {
      fetchBalance();
    }
  }, [apiKeyMode]);

  const fetchBalance = async () => {
    try {
      const res = await fetch('/api/credits/balance');
      const data = await res.json();
      setBalance(data.balance);
    } catch (error) {
      console.error('Failed to fetch credit balance', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCredits = async () => {
    try {
      // Redirect to Stripe Checkout
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 25 }), // Default $25
      });
      const { url } = await res.json();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to create checkout session', error);
    }
  };

  if (apiKeyMode !== 'credits') return null;

  return (
    <div style={{
      padding: spacing[3],
      backgroundColor: colors.bg.inset,
      borderRadius: effects.border.radius.default,
      border: `1px solid ${colors.border.default}`,
      marginBottom: spacing[4],
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[2],
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
        }}>
          <DollarSign size={16} color={colors.accent.primary} />
          <span style={{
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.semibold,
            color: colors.fg.primary,
          }}>
            Credit Balance
          </span>
        </div>
        {balance !== null && (
          <span style={{
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.bold,
            color: balance < 5 ? colors.status.error : colors.accent.primary,
          }}>
            {loading ? '...' : formatUsd(balance)}
          </span>
        )}
      </div>

      {balance !== null && balance < 5 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
          padding: spacing[2],
          backgroundColor: colors.status.errorBg,
          borderRadius: effects.border.radius.default,
          marginBottom: spacing[2],
        }}>
          <AlertCircle size={14} color={colors.status.error} />
          <span style={{
            fontSize: typography.sizes.xs,
            color: colors.status.error,
          }}>
            Low balance. Purchase more credits to continue using AI features.
          </span>
        </div>
      )}

      <button
        onClick={handleBuyCredits}
        style={{
          width: '100%',
          padding: `${spacing[2]} ${spacing[3]}`,
          backgroundColor: colors.accent.primary,
          color: 'white',
          border: 'none',
          borderRadius: effects.border.radius.default,
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          cursor: 'pointer',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        Buy More Credits
      </button>
    </div>
  );
}

export default CreditBalance;
```

**Usage**: Add to `UsageDisplay.tsx`:

```tsx
import { CreditBalance } from './CreditBalance';

export function UsageDisplay() {
  return (
    <div>
      <CreditBalance />
      {/* ... rest of existing usage display */}
    </div>
  );
}
```

---

## 5. API Routes

### Get Balance

**File**: `src/app/api/credits/balance/route.ts` (new)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs'; // or your auth provider
import { getCreditBalance } from '@/lib/credit-db';

export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const balance = await getCreditBalance(userId);
    return NextResponse.json(balance);
  } catch (error) {
    console.error('[Balance API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
```

### Create Stripe Checkout

**File**: `src/app/api/stripe/create-checkout/route.ts` (new)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const CREDIT_PACKAGES = [
  { amount: 10, bonus: 0 },
  { amount: 25, bonus: 2 },
  { amount: 50, bonus: 5 },
  { amount: 100, bonus: 15 },
];

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount } = await req.json();
    const pkg = CREDIT_PACKAGES.find((p) => p.amount === amount);
    if (!pkg) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const creditsToAdd = pkg.amount + pkg.bonus;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `ProjectLoom Credits ($${creditsToAdd})`,
              description: `$${pkg.amount} + $${pkg.bonus} bonus`,
            },
            unit_amount: pkg.amount * 100, // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?purchase=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?purchase=cancelled`,
      metadata: {
        userId,
        creditsToAdd: creditsToAdd.toString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe Checkout] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

### Stripe Webhook

**File**: `src/app/api/stripe/webhook/route.ts` (new)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits } from '@/lib/credit-db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('[Webhook] Signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const { userId, creditsToAdd } = paymentIntent.metadata;

    if (!userId || !creditsToAdd) {
      console.error('[Webhook] Missing metadata', paymentIntent.id);
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    try {
      await addCredits(userId, parseFloat(creditsToAdd), paymentIntent.id);
      console.log('[Webhook] Credits added', { userId, creditsToAdd });
    } catch (error) {
      console.error('[Webhook] Failed to add credits', error);
      // Don't return error - Stripe will retry
    }
  }

  return NextResponse.json({ received: true });
}
```

---

## 6. Middleware for API Routes

**File**: Update `src/app/api/chat/route.ts` (and similar for agent, summarize)

```typescript
// Add at the top
import { auth } from '@clerk/nextjs';
import { getCreditBalance, deductCredits } from '@/lib/credit-db';
import { usePreferencesStore } from '@/stores/preferences-store';

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get user preferences (you'll need to store this in DB too)
  const userPrefs = await getUserPreferences(userId); // Implement this
  const apiKeyMode = userPrefs.apiKeyMode;

  let apiKey: string;

  if (apiKeyMode === 'credits') {
    // Check balance before call
    const { balance } = await getCreditBalance(userId);
    if (balance < 0.10) {
      return Response.json(
        { error: 'Insufficient credits. Please purchase more.' },
        { status: 402 } // Payment Required
      );
    }

    // Use developer's API key
    apiKey = process.env.ANTHROPIC_API_KEY!;
  } else {
    // Existing BYOK flow
    apiKey = req.headers.get('x-anthropic-api-key') || '';
    if (!apiKey) {
      return new Response('Missing API key', { status: 400 });
    }
  }

  // ... rest of existing chat logic
  const result = streamText({
    // ... params with apiKey
  });

  // After call completes (in the stream completion handler)
  if (apiKeyMode === 'credits') {
    const cost = calculateCost(model, inputTokens, outputTokens);
    await deductCredits(userId, cost, {
      provider: 'anthropic',
      model,
      inputTokens,
      outputTokens,
      conversationId,
      source: 'chat',
    });
  }

  return result.toDataStreamResponse();
}
```

---

## Environment Variables

Add to `.env.local`:

```bash
# Clerk (or your auth provider)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Database (Neon/Vercel Postgres)
POSTGRES_URL=postgres://...
POSTGRES_PRISMA_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Developer API Keys (for credits mode)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## Testing Checklist

**Local Development**:
- [ ] User can toggle between "Own API Keys" and "Buy Credits" in Settings
- [ ] Credit balance displays correctly in Usage panel
- [ ] "Buy More Credits" button opens Stripe Checkout (test mode)
- [ ] Webhook receives payment events (use Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`)
- [ ] Credits are added to user balance after successful payment
- [ ] Chat/Agent calls work with credits mode
- [ ] Credits are deducted after AI calls
- [ ] Low balance warning shows when < $5
- [ ] Insufficient credits error shows before AI call if balance < $0.10

**Production**:
- [ ] Switch to Stripe production keys
- [ ] Configure webhook endpoint in Stripe dashboard
- [ ] Test with real payment (use $1 amount for testing)
- [ ] Monitor webhook logs for failures
- [ ] Set up alerts for failed credit deductions

---

## Next Steps

1. **Set up auth**: Install Clerk/NextAuth
2. **Set up database**: Create Neon account, run schema
3. **Set up Stripe**: Create account, get test keys, configure webhook
4. **Implement frontend**: Settings toggle + Credit balance component
5. **Implement backend**: Database utils + API routes
6. **Test end-to-end**: Purchase → Balance update → AI call → Deduction
7. **Launch**: Switch to production keys, deploy

---

## Questions?

- A) Need help with any specific component?
- B) Want me to start implementing Phase 1?
- C) Need clarification on any technical decision?
