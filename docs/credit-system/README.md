# Credit System Documentation

**Status**: Design Phase  
**Version**: 1.0  
**Last Updated**: 2026-02-09

---

## Overview

This folder contains complete architecture and implementation documentation for adding a credit-based payment system to ProjectLoom, allowing non-technical users to use the app without managing their own AI API keys.

---

## Documents

### 📋 [architecture.md](./architecture.md)
**Comprehensive system design**

- System components (auth, database, payments, UI)
- Database schema with all tables and relationships
- Technology recommendations (Clerk, Neon, Stripe)
- 6-phase implementation roadmap
- Security checklist and best practices
- Cost projections and break-even analysis
- Technical decisions and tradeoffs

**Read this first** to understand the complete system.

---

### 💾 [database-schema.sql](./database-schema.sql)
**PostgreSQL schema**

- All table definitions with constraints
- Indexes for performance
- Triggers for auto-updates
- Sample queries for common operations
- GDPR-compliant cleanup procedures
- Seed data for testing

**Use this** to set up your Neon/Vercel Postgres database.

---

### 🛠️ [implementation-guide.md](./implementation-guide.md)
**Step-by-step code guide**

- Preferences store modifications
- Database utility functions (getCreditBalance, deductCredits, addCredits)
- Settings Panel UI updates (mode toggle)
- Credit Balance component (new)
- API routes (balance, checkout, webhook)
- Middleware for credit deduction
- Environment variables setup
- Testing checklist

**Use this** to actually build the features.

---

### 🚀 [quick-start.md](./quick-start.md)
**Decision matrix and next actions**

- Decision matrix (auth, database, pricing, scope)
- Proof-of-concept guide (3-4 days)
- Full implementation timeline (5-6 weeks)
- Cost calculator
- Immediate next steps for each path

**Use this** to decide how to proceed and get started.

---

## Quick Navigation

**I want to...**

- **Understand the system** → Read [architecture.md](./architecture.md)
- **Set up the database** → Use [database-schema.sql](./database-schema.sql)
- **Start coding** → Follow [implementation-guide.md](./implementation-guide.md)
- **Decide next steps** → Review [quick-start.md](./quick-start.md)

---

## Key Decisions Made

✅ **Auth**: Clerk (fastest MVP, great DX)  
✅ **Database**: Neon for dev, Vercel Postgres for prod  
✅ **Payments**: Stripe (industry standard)  
⏳ **Pricing**: TBD (pass-through vs 20% markup)  
⏳ **Scope**: TBD (PoC vs full implementation)

---

## Tech Stack

```
Frontend:
- React + Next.js 15 (existing)
- Zustand (state management)
- Stripe.js (payment UI)

Backend:
- Next.js API routes
- Clerk (authentication)
- Vercel Postgres / Neon (database)
- Stripe (payment processing)

Infrastructure:
- Vercel (hosting)
- Neon/Vercel Postgres (database)
- Stripe (payments + webhooks)
```

---

## Estimated Effort

| Approach | Time | Complexity | Risk |
|----------|------|------------|------|
| Proof of Concept | 3-4 days | Low | Low |
| Full Implementation | 5-6 weeks | Medium | Medium |
| Production Ready | 6-8 weeks | High | Medium |

---

## Open Questions

1. **Pricing strategy**: Pass-through (0% markup) or 20% markup?
2. **Credit packages**: What denominations? ($10, $25, $50, $100?)
3. **Bonus credits**: Offer incentives for larger purchases?
4. **Rate limits**: How many API calls per minute per user?
5. **Free tier**: Offer $1-5 free credits for new users?
6. **Refund policy**: How to handle refunds/disputes?

---

## Next Steps

1. **Review** [quick-start.md](./quick-start.md) to choose approach (PoC vs Full)
2. **Decide** on pricing strategy (pass-through vs markup)
3. **Create accounts** (Clerk, Neon, Stripe)
4. **Start Phase 1** (auth + database) or **Build PoC** (3-4 days)

---

## Get Help

If you need assistance with:
- Specific implementation questions
- Technology choice validation
- Cost calculations for your use case
- Security/compliance review
- Performance optimization

Just ask! This documentation should cover 90% of what you need to build the system.

---

## Version History

- **v1.0** (2026-02-09): Initial architecture and implementation guide
