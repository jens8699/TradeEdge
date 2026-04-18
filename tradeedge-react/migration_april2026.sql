-- ============================================================================
-- TradeEdge DB Migration — April 2026 (v2 — Social share_trades)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ── 1. Add theme column to profiles ─────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';

-- ── 2. Social schema ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- ── 3. Friendships table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- ── 4. Profile columns for social ───────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stats_public BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#E8724A';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_trades BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trade_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS win_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_pnl NUMERIC(12,2) DEFAULT 0;

-- ── 5. RLS policies — follows ────────────────────────────────────────────────
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'follows_select_all') THEN
    CREATE POLICY follows_select_all ON follows FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'follows_insert_own') THEN
    CREATE POLICY follows_insert_own ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'follows_delete_own') THEN
    CREATE POLICY follows_delete_own ON follows FOR DELETE USING (auth.uid() = follower_id);
  END IF;
END $$;

-- ── 6. RLS policies — friendships ───────────────────────────────────────────
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'friendships_select_own') THEN
    CREATE POLICY friendships_select_own ON friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'friendships_insert_own') THEN
    CREATE POLICY friendships_insert_own ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'friendships_update_own') THEN
    CREATE POLICY friendships_update_own ON friendships FOR UPDATE USING (auth.uid() = friend_id);
  END IF;
END $$;

-- ── 7. RLS policy — trades feed (followers can read shared trades) ────────────
-- Allow users to read their own trades, OR trades from traders who have
-- share_trades=true and is_public=true AND the viewer follows them.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'trades_public_feed') THEN
    CREATE POLICY trades_public_feed ON trades FOR SELECT
    USING (
      auth.uid() = user_id
      OR (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = trades.user_id
            AND profiles.share_trades = true
            AND profiles.is_public = true
        )
        AND EXISTS (
          SELECT 1 FROM follows
          WHERE follows.follower_id = auth.uid()
            AND follows.following_id = trades.user_id
        )
      )
    );
  END IF;
END $$;
