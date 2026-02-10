-- Credit System Database Schema
-- PostgreSQL (compatible with Neon, Vercel Postgres, Supabase)
-- Version: 1.0

-- ============================================================================
-- TABLES
-- ============================================================================

-- User Credit Balance (one row per user)
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL UNIQUE,
  balance_usd DECIMAL(10, 4) NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
  lifetime_spent_usd DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Purchases (Stripe transactions)
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  amount_usd DECIMAL(10, 4) NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- AI Usage Records (deductions from credit balance)
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  cost_usd DECIMAL(10, 6) NOT NULL CHECK (cost_usd >= 0),
  conversation_id TEXT,
  source TEXT CHECK (source IN ('chat', 'agent', 'summarize', 'embeddings')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Low Balance Notifications (prevent spam)
CREATE TABLE low_balance_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  balance_at_notification DECIMAL(10, 4) NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_stripe_intent ON credit_transactions(stripe_payment_intent_id);
CREATE INDEX idx_usage_records_user_created ON usage_records(user_id, created_at DESC);
CREATE INDEX idx_usage_records_conversation ON usage_records(conversation_id);
CREATE INDEX idx_low_balance_notifications_user ON low_balance_notifications(user_id, notified_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get user balance
-- Usage: SELECT balance_usd FROM user_credits WHERE user_id = $1;

-- Check if user exists, create if not
-- Usage: 
-- INSERT INTO user_credits (user_id, balance_usd) 
-- VALUES ($1, 0) 
-- ON CONFLICT (user_id) DO NOTHING;

-- Add credits (from Stripe purchase) - ATOMIC
-- Usage:
-- BEGIN;
--   UPDATE user_credits 
--   SET balance_usd = balance_usd + $2 
--   WHERE user_id = $1;
--   
--   UPDATE credit_transactions 
--   SET status = 'completed', completed_at = NOW() 
--   WHERE stripe_payment_intent_id = $3;
-- COMMIT;

-- Deduct credits (after AI call) - ATOMIC with balance check
-- Usage:
-- BEGIN;
--   UPDATE user_credits 
--   SET 
--     balance_usd = balance_usd - $2,
--     lifetime_spent_usd = lifetime_spent_usd + $2
--   WHERE user_id = $1 AND balance_usd >= $2;
--   
--   -- Check if update affected any rows (balance was sufficient)
--   -- If GET DIAGNOSTICS row_count = 0, then ROLLBACK
--   
--   INSERT INTO usage_records (
--     user_id, provider, model, input_tokens, output_tokens, 
--     cost_usd, conversation_id, source
--   ) VALUES ($1, $3, $4, $5, $6, $2, $7, $8);
-- COMMIT;

-- Get usage breakdown (last 30 days)
-- Usage:
-- SELECT 
--   provider,
--   model,
--   SUM(input_tokens) as total_input_tokens,
--   SUM(output_tokens) as total_output_tokens,
--   SUM(cost_usd) as total_cost_usd,
--   COUNT(*) as call_count
-- FROM usage_records
-- WHERE user_id = $1 
--   AND created_at >= NOW() - INTERVAL '30 days'
-- GROUP BY provider, model
-- ORDER BY total_cost_usd DESC;

-- Get transaction history
-- Usage:
-- SELECT 
--   amount_usd,
--   status,
--   created_at,
--   completed_at
-- FROM credit_transactions
-- WHERE user_id = $1
-- ORDER BY created_at DESC
-- LIMIT 50;

-- Check if low balance notification was sent recently (within 24h)
-- Usage:
-- SELECT EXISTS (
--   SELECT 1 
--   FROM low_balance_notifications
--   WHERE user_id = $1 
--     AND notified_at >= NOW() - INTERVAL '24 hours'
-- );

-- ============================================================================
-- CLEANUP / MAINTENANCE
-- ============================================================================

-- Delete old usage records (GDPR compliance - keep 1 year)
-- Schedule this as a cron job (weekly)
-- DELETE FROM usage_records 
-- WHERE created_at < NOW() - INTERVAL '1 year';

-- Archive old transactions (optional - keep 2 years)
-- CREATE TABLE credit_transactions_archive AS 
-- SELECT * FROM credit_transactions 
-- WHERE completed_at < NOW() - INTERVAL '2 years';
-- 
-- DELETE FROM credit_transactions 
-- WHERE completed_at < NOW() - INTERVAL '2 years';

-- ============================================================================
-- SEED DATA (for testing)
-- ============================================================================

-- Create test user with $10 balance
-- INSERT INTO user_credits (user_id, balance_usd) 
-- VALUES ('user_test123', 10.0000);

-- Simulate purchase
-- INSERT INTO credit_transactions (
--   user_id, amount_usd, stripe_payment_intent_id, 
--   stripe_customer_id, status
-- ) VALUES (
--   'user_test123', 10.0000, 'pi_test_123456', 
--   'cus_test_123', 'completed'
-- );

-- Simulate usage
-- INSERT INTO usage_records (
--   user_id, provider, model, input_tokens, output_tokens, 
--   cost_usd, conversation_id, source
-- ) VALUES (
--   'user_test123', 'anthropic', 'claude-3-5-sonnet-20241022', 
--   1000, 500, 0.0195, 'conv_abc123', 'chat'
-- );
