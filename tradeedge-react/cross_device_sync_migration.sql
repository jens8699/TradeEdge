-- TradeEdge Cross-Device Sync Migration
-- Date: 2026-05-06
-- Run this in the Supabase SQL Editor (one-time).
--
-- Purpose: Move prop firm accounts and trade↔account tags from localStorage
-- to Supabase so users get the same data across devices and browsers.
--
-- Two tables:
--   1. prop_firm_accounts — the user's roster of prop firm accounts
--      (TopStep $50k, Apex $100k, etc.). Was localStorage `te_prop_firm_accounts`.
--   2. trade_account_tags — side table mapping a trade to the account it was
--      taken on. Was localStorage `te_trade_accounts`.
--
-- Both use string `id` keys generated client-side (matches existing data shape
-- so the migration from localStorage is a straight copy — no ID rewrites).

-- ────────────────────────────────────────────────────────────────────────────
-- 1. prop_firm_accounts
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prop_firm_accounts (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm         TEXT NOT NULL,
  name         TEXT,
  account_size NUMERIC(12,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'eval',
  dd_max       NUMERIC(12,2) NOT NULL DEFAULT 0,
  payout_pct   NUMERIC(5,2)  NOT NULL DEFAULT 0,
  cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prop_firm_accounts_user_id_idx
  ON prop_firm_accounts (user_id);

ALTER TABLE prop_firm_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prop_firm_accounts_select_own" ON prop_firm_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "prop_firm_accounts_insert_own" ON prop_firm_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prop_firm_accounts_update_own" ON prop_firm_accounts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prop_firm_accounts_delete_own" ON prop_firm_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. trade_account_tags
-- ────────────────────────────────────────────────────────────────────────────
-- One row per tagged trade. trade_id is the PK because a trade belongs to
-- exactly one account at a time. Tag deleted by deleting the row.

CREATE TABLE IF NOT EXISTS trade_account_tags (
  trade_id    TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_account_tags_user_id_idx
  ON trade_account_tags (user_id);

CREATE INDEX IF NOT EXISTS trade_account_tags_account_id_idx
  ON trade_account_tags (account_id);

ALTER TABLE trade_account_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_account_tags_select_own" ON trade_account_tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "trade_account_tags_insert_own" ON trade_account_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trade_account_tags_update_own" ON trade_account_tags
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trade_account_tags_delete_own" ON trade_account_tags
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Done. The client app handles the one-time copy from localStorage to these
-- tables on first load after this migration runs.
-- ────────────────────────────────────────────────────────────────────────────
