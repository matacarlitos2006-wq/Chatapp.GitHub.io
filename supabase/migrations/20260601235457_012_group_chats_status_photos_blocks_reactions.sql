/*
  # Group Chats, Status, Photos, Blocks, Reactions

  ## New Tables
  - `conversations`: add is_group, name, description, created_by, is_public columns
  - `user_status`: track online/away/offline per user with last_seen
  - `message_reactions`: emoji reactions on messages
  - `user_blocks`: track who has blocked whom (admin-only kick/ban)

  ## Changes
  - messages: add image_url column for photo sharing
  - profiles: add is_banned column

  ## Security
  - RLS on all new tables
*/

-- Add group/public fields to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Add image_url to messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- Add is_banned to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- User status table
CREATE TABLE IF NOT EXISTS user_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  last_seen TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all statuses"
  ON user_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own status"
  ON user_status FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own status"
  ON user_status FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reactions"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add own reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- User blocks table (used by admin to block/ban)
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocked_user_id, blocked_by)
);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view blocks"
  ON user_blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocked_by);

CREATE POLICY "Admin can insert blocks"
  ON user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocked_by);

CREATE POLICY "Admin can delete blocks"
  ON user_blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocked_by);

-- Index for fast status lookups
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_conversations_is_public ON conversations(is_public);
