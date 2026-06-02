/*
  # Feature expansion: scheduled messages, stories, badges, starred messages, threads

  ## New Tables
  - `scheduled_messages` - messages scheduled to be sent later
    - `id` (uuid, primary key)
    - `conversation_id` (uuid)
    - `sender_id` (uuid)
    - `content` (text)
    - `image_url` (text, nullable)
    - `scheduled_at` (timestamptz)
    - `sent` (boolean)
    - `created_at` (timestamptz)
  - `stories` - 24-hour disappearing status updates
    - `id` (uuid, primary key)
    - `user_id` (uuid)
    - `content` (text)
    - `image_url` (text, nullable)
    - `background_color` (text)
    - `expires_at` (timestamptz)
    - `created_at` (timestamptz)
  - `story_views` - who viewed a story
    - `id` (uuid, primary key)
    - `story_id` (uuid)
    - `viewer_id` (uuid)
    - `viewed_at` (timestamptz)
  - `user_badges` - achievements/badges earned
    - `id` (uuid, primary key)
    - `user_id` (uuid)
    - `badge_type` (text)
    - `earned_at` (timestamptz)
  - `starred_messages` - user's saved/starred messages
    - `id` (uuid, primary key)
    - `user_id` (uuid)
    - `message_id` (uuid)
    - `created_at` (timestamptz)
  - `custom_emojis` - user-uploaded custom emoji
    - `id` (uuid, primary key)
    - `uploaded_by` (uuid)
    - `name` (text)
    - `image_url` (text)
    - `created_at` (timestamptz)
  - `message_threads` - threaded reply metadata
    - `id` (uuid, primary key)
    - `parent_message_id` (uuid)
    - `reply_count` (int)
    - `last_reply_at` (timestamptz)

  ## Modified Tables
  - `messages` - add `thread_id` column

  ## Security
  - RLS on all new tables with proper policies
*/

-- scheduled_messages
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  image_url text,
  scheduled_at timestamptz NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_select_own" ON scheduled_messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid());
CREATE POLICY "scheduled_insert_own" ON scheduled_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "scheduled_update_own" ON scheduled_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "scheduled_delete_own" ON scheduled_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- stories
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  image_url text,
  background_color text NOT NULL DEFAULT '#3b82f6',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select" ON stories FOR SELECT TO authenticated
  USING (expires_at > now());
CREATE POLICY "stories_insert_own" ON stories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "stories_delete_own" ON stories FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- story_views
CREATE TABLE IF NOT EXISTS story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_views_select" ON story_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM stories WHERE stories.id = story_views.story_id AND stories.user_id = auth.uid()) OR viewer_id = auth.uid());
CREATE POLICY "story_views_insert" ON story_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

-- user_badges
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_type)
);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges_select" ON user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "badges_insert_own" ON user_badges FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- starred_messages
CREATE TABLE IF NOT EXISTS starred_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, message_id)
);
ALTER TABLE starred_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "starred_select_own" ON starred_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "starred_insert_own" ON starred_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "starred_delete_own" ON starred_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- custom_emojis
CREATE TABLE IF NOT EXISTS custom_emojis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE custom_emojis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_emojis_select" ON custom_emojis FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_emojis_insert" ON custom_emojis FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "custom_emojis_delete_own" ON custom_emojis FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

-- message_threads
CREATE TABLE IF NOT EXISTS message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE UNIQUE,
  reply_count int NOT NULL DEFAULT 0,
  last_reply_at timestamptz DEFAULT now()
);
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "threads_select" ON message_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "threads_insert" ON message_threads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "threads_update" ON message_threads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Add thread_id to messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'thread_id') THEN
    ALTER TABLE messages ADD COLUMN thread_id uuid REFERENCES message_threads(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_time ON scheduled_messages(scheduled_at) WHERE sent = false;
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_starred_user ON starred_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
