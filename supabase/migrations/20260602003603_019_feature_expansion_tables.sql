/*
  # Major feature expansion: typing, voice, replies, pins, polls, invites, mute, archive, reports, notifications

  ## New Tables
  - typing_indicators, pinned_messages, polls, poll_votes, group_invite_links,
    conversation_settings, user_reports, notifications

  ## Modified Tables
  - messages: add reply_to_id, voice_url, voice_duration, mentions

  ## Security
  - RLS enabled and policies for all new tables
*/

-- Add columns to messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'reply_to_id') THEN
    ALTER TABLE messages ADD COLUMN reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'voice_url') THEN
    ALTER TABLE messages ADD COLUMN voice_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'voice_duration') THEN
    ALTER TABLE messages ADD COLUMN voice_duration int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'mentions') THEN
    ALTER TABLE messages ADD COLUMN mentions jsonb DEFAULT '[]';
  END IF;
END $$;

-- typing_indicators
CREATE TABLE IF NOT EXISTS typing_indicators (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "typing_select" ON typing_indicators FOR SELECT TO authenticated
  USING (is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "typing_insert" ON typing_indicators FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "typing_update" ON typing_indicators FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- pinned_messages
CREATE TABLE IF NOT EXISTS pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pinned_at timestamptz DEFAULT now(),
  UNIQUE(message_id)
);
ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pinned_select" ON pinned_messages FOR SELECT TO authenticated
  USING (is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "pinned_insert" ON pinned_messages FOR INSERT TO authenticated
  WITH CHECK (is_conversation_member(conversation_id, auth.uid()) AND pinned_by = auth.uid());
CREATE POLICY "pinned_delete" ON pinned_messages FOR DELETE TO authenticated
  USING (pinned_by = auth.uid() OR EXISTS (
    SELECT 1 FROM conversation_participants WHERE conversation_id = pinned_messages.conversation_id
    AND profile_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- polls
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  expires_at timestamptz,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "polls_select" ON polls FOR SELECT TO authenticated
  USING (is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "polls_insert" ON polls FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND is_conversation_member(conversation_id, auth.uid()));

-- poll_votes
CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  option_index int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, user_id)
);
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poll_votes_select" ON poll_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM polls WHERE polls.id = poll_votes.poll_id AND is_conversation_member(polls.conversation_id, auth.uid())));
CREATE POLICY "poll_votes_insert" ON poll_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "poll_votes_update" ON poll_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- group_invite_links
CREATE TABLE IF NOT EXISTS group_invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz,
  max_uses int,
  use_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE group_invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_links_select" ON group_invite_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "invite_links_insert" ON group_invite_links FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM conversation_participants WHERE conversation_id = group_invite_links.conversation_id
    AND profile_id = auth.uid() AND role IN ('owner', 'admin')
  ));
CREATE POLICY "invite_links_delete" ON group_invite_links FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- conversation_settings
CREATE TABLE IF NOT EXISTS conversation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_muted boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  disappearing_duration int,
  wallpaper_url text,
  accent_color text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
ALTER TABLE conversation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_settings_select" ON conversation_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "conv_settings_insert" ON conversation_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "conv_settings_update" ON conversation_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- user_reports
CREATE TABLE IF NOT EXISTS user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert" ON user_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports_select_own" ON user_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  data jsonb DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_typing_conversation ON typing_indicators(conversation_id);
CREATE INDEX IF NOT EXISTS idx_pinned_conversation ON pinned_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_polls_conversation ON polls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_conv_settings_user ON conversation_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id);
