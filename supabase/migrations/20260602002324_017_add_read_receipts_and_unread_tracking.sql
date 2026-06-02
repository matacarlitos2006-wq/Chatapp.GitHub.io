/*
  # Add read receipts and unread message tracking

  ## Changes
  1. Add `last_read_at` column to `conversation_participants` for tracking how far each user has read
  2. Create `message_status` table to track delivered/seen per message per recipient
    - `message_id` (uuid, FK to messages)
    - `user_id` (uuid, FK to profiles - the recipient)
    - `status` (text: 'sent', 'delivered', 'seen')
    - `delivered_at` (timestamptz)
    - `seen_at` (timestamptz)
  3. RLS policies for message_status

  ## Security
  - RLS enabled on message_status
  - Users can view statuses for messages in their conversations
  - Users can update their own status entries (mark as delivered/seen)
*/

-- Add last_read_at to conversation_participants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_participants' AND column_name = 'last_read_at'
  ) THEN
    ALTER TABLE conversation_participants ADD COLUMN last_read_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create message_status table
CREATE TABLE IF NOT EXISTS message_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'seen')),
  delivered_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE message_status ENABLE ROW LEVEL SECURITY;

-- Users can view message statuses for messages in their conversations
CREATE POLICY "message_status_select"
  ON message_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_status.message_id
        AND is_conversation_member(m.conversation_id, auth.uid())
    )
  );

-- Users can insert their own status entries (auto-created on message delivery)
CREATE POLICY "message_status_insert"
  ON message_status FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own status (to mark as seen)
CREATE POLICY "message_status_update"
  ON message_status FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_message_status_message_id ON message_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_status_user_id ON message_status(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_last_read ON conversation_participants(conversation_id, profile_id, last_read_at);
