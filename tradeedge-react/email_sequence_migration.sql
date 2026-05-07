-- TradeEdge Email Sequence Migration
-- Date: 2026-05-06
-- Run this in Supabase SQL Editor (one-time).
--
-- Adds:
--   1. email_sequence_log — one row per email actually sent. UNIQUE on
--      (user_id, step) prevents the cron tick from sending the same step twice
--      even if it runs concurrently.
--   2. profiles.unsubscribed_at — soft unsubscribe; cron tick skips users
--      with this set.
--
-- Both tables use service-role-only access (no RLS policies for end users
-- because end users never write to these directly — only the Cloudflare Pages
-- Function does, with the Supabase service role key that bypasses RLS).

-- ────────────────────────────────────────────────────────────────────────────
-- 1. email_sequence_log
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_sequence_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step        TEXT NOT NULL,                -- e.g. 'day_0_welcome', 'day_6_trial_end'
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_id   TEXT,                         -- Resend's email ID for traceability
  UNIQUE (user_id, step)
);

CREATE INDEX IF NOT EXISTS email_sequence_log_user_id_idx
  ON email_sequence_log (user_id);

-- RLS on so users can't read each other's logs (they shouldn't read theirs
-- either, but defense in depth). Service role bypasses RLS, which is what
-- the Pages Function uses.
ALTER TABLE email_sequence_log ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. profiles.unsubscribed_at
-- ────────────────────────────────────────────────────────────────────────────
-- Set when a user clicks the unsubscribe link in any of our emails.
-- The cron tick filters out users with this set.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- Done. Email sequence Cloudflare Pages Function reads from auth.users +
-- profiles + email_sequence_log to decide who's due for which email.
