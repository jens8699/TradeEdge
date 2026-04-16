-- TradeEdge Social Migration
-- Run this in Supabase SQL Editor

-- 1. Add social columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username     TEXT,
  ADD COLUMN IF NOT EXISTS bio          TEXT,
  ADD COLUMN IF NOT EXISTS is_public    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#E8724A',
  ADD COLUMN IF NOT EXISTS trade_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS win_rate     NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pnl    NUMERIC(12,2) DEFAULT 0;

-- 2. Unique index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON profiles (LOWER(username))
  WHERE username IS NOT NULL;

-- 3. Create follows table
CREATE TABLE IF NOT EXISTS follows (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- 4. Enable RLS on follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- 5. RLS: users can see their own follow rows
CREATE POLICY "follows_select" ON follows
  FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- 6. RLS: users can insert their own follows
CREATE POLICY "follows_insert" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- 7. RLS: users can delete their own follows
CREATE POLICY "follows_delete" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- 8. RLS on profiles: allow reading public profiles
-- (add this only if profiles table already has RLS enabled)
CREATE POLICY "profiles_read_public" ON profiles
  FOR SELECT USING (is_public = true OR auth.uid() = id);
