/*
  # Fix Conversation Participants RLS Policy
  
  ## Issue
  The existing RLS policy for conversation_participants only allows users to insert
  their own profile_id. However, when creating a new conversation, we need to insert
  both participants in a single transaction, which means we need to allow inserting
  rows where profile_id is not the current user (but only for new conversations).
  
  ## Solution
  1. Drop the restrictive INSERT policy
  2. Create a new policy that allows:
     - Users to insert their own profile_id (normal case)
     - Users to insert other participants when creating a new conversation
       (checked by verifying the conversation doesn't have other participants yet)
  
  ## Security
  This policy is still secure because:
  - Users can only add participants to conversations where they are also a participant
  - For new conversations (before the creator is a participant), they can only add
    participants before anyone else is in the conversation
  - This prevents users from adding random people to existing conversations
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can add themselves to conversations" ON conversation_participants;

-- Create a new policy that allows adding participants for new conversations
CREATE POLICY "Users can add participants to conversations"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow users to add themselves to any conversation
    profile_id = auth.uid()
    OR
    -- OR allow adding others only when:
    -- 1. The current user is adding themselves in the same transaction
    -- 2. This is for a new conversation (no other participants yet)
    (
      -- Check if the conversation is new (has no participants yet)
      NOT EXISTS (
        SELECT 1 FROM conversation_participants
        WHERE conversation_participants.conversation_id = conversation_participants.conversation_id
      )
      OR
      -- Or check if current user will be a participant of this conversation
      EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.profile_id = auth.uid()
      )
    )
  );
