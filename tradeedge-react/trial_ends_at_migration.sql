-- TradeEdge: trial_ends_at on profiles
-- Run in Supabase SQL Editor. Idempotent — safe to re-run.
--
-- Webhook writes this column from Stripe's sub.trial_end. The frontend
-- reads it to show the "Pro trial ends in X days" banner.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
