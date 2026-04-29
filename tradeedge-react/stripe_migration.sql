-- TradeEdge Stripe Migration
-- Run this in your Supabase SQL Editor before enabling Stripe Checkout.
-- Idempotent — safe to re-run.

-- 1. Profile columns the webhook writes to
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS has_backtesting        BOOLEAN DEFAULT false;

-- 2. Index for fast customer-id lookup (used by the portal endpoint)
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- 3. Note on the existing `plan` column:
-- The webhook writes 'pro' on subscribe, 'free' on cancel/lapse.
-- If `plan` doesn't exist yet on your profiles table, uncomment this:
-- ALTER TABLE profiles
--   ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
