/*
  # Add message editing support

  ## Changes
  - Add `is_edited` boolean column to messages to flag edited messages
  - Update the UPDATE policy to allow users to edit their own message content (not just soft-delete)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_edited'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_edited boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Drop the restrictive soft-delete-only UPDATE policy
DROP POLICY IF EXISTS "Users can soft delete their own messages" ON messages;

-- New policy: users can update their own messages (edit content or soft-delete)
CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
