-- TradeEdge UTM Attribution Migration
-- Date: 2026-05-13
-- Run this in Supabase SQL Editor (one-time).
--
-- Adds attribution columns to profiles so we can tell which platform / ad /
-- character drove each signup during the May 18 launch.
--
-- Captured on first landing (URL params + referrer) via App.jsx, persisted to
-- localStorage as first-touch (a later UTM-tagged click upgrades a prior
-- direct/referrer-only visit; UTM never overwrites UTM), and written to
-- profiles at signup time from RegisterPanel.submit.
--
-- All columns nullable. Existing rows unaffected (no backfill needed —
-- pre-launch signups predate the tracking).
--
-- Idempotent: re-running is safe.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS utm_source     TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium     TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign   TEXT,
  ADD COLUMN IF NOT EXISTS utm_content    TEXT,
  ADD COLUMN IF NOT EXISTS utm_term       TEXT,
  ADD COLUMN IF NOT EXISTS referrer       TEXT,
  ADD COLUMN IF NOT EXISTS landing_path   TEXT,
  ADD COLUMN IF NOT EXISTS attribution_captured_at TIMESTAMPTZ;

-- Index utm_campaign for fast launch-campaign queries (we'll be slicing
-- "signups where utm_campaign = 'launch_v1'" all day during the May 18 push).
CREATE INDEX IF NOT EXISTS idx_profiles_utm_campaign
  ON profiles (utm_campaign)
  WHERE utm_campaign IS NOT NULL;

-- Index utm_content (the per-ad slug like 'ad_07') so we can rank ads quickly.
CREATE INDEX IF NOT EXISTS idx_profiles_utm_content
  ON profiles (utm_content)
  WHERE utm_content IS NOT NULL;
