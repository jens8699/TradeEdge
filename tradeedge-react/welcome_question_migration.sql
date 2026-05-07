-- TradeEdge Welcome Question Migration
-- Date: 2026-05-07
-- Run this in Supabase SQL Editor (one-time).
--
-- Adds `expectation` column to profiles. Captured during the onboarding
-- modal — answer to "What are you hoping TradeEdge solves for you?".
-- This is the same customer-dev question we send via email Day 1, but
-- captured in-app from EVERY signup (not just email-clickers). Highest
-- direct signal for product roadmap decisions.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS expectation TEXT,
  ADD COLUMN IF NOT EXISTS expectation_at TIMESTAMPTZ;
