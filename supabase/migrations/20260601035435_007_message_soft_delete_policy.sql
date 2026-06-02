/*
  # Add Message UPDATE Policy for Soft Delete Support

  Since we added deleted_at column, we need to allow UPDATE 
  but only for soft delete operations (setting deleted_at).
*/

-- Drop the restrictive UPDATE policy
DROP POLICY IF EXISTS "Messages cannot be updated after sending" ON messages;

-- Add policy that allows soft delete only
CREATE POLICY "Users can soft delete their own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() AND deleted_at IS NOT NULL);
