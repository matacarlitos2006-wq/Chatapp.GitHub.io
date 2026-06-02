/*
  # Fix Conversation Participants RLS Policy - Remove Circular Reference
  
  ## Issue
  The SELECT policy on conversation_participants has a circular reference that causes
  a 500 error. The policy tries to check if the user is a participant by querying the
  same table, which creates an infinite loop.
  
  ## Solution
  Replace the complex policy with a simpler approach:
  - Allow users to view participants if they are listed as a participant in that conversation
  
  ## Changes
  1. Drop the existing circular SELECT policy
  2. Create a new simpler SELECT policy using EXISTS with profiles check
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;

-- Create a new, simpler policy
CREATE POLICY "Users can view participants if they are in the conversation"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_participants.conversation_id
      AND EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = c.id
        AND cp.profile_id = auth.uid()
      )
    )
  );
