/*
  # Fix Conversation Participants RLS - Use Helper Function
  
  ## Issue
  The RLS policy on conversation_participants has circular references causing 500 errors.
  
  ## Solution
  Use a SECURITY DEFINER function to check participation status, which bypasses
  the RLS recursion issue.
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view participants if they are in the conversation" ON conversation_participants;

-- Create a helper function to check if user is in a conversation
CREATE OR REPLACE FUNCTION is_user_in_conversation(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conv_id
    AND profile_id = auth.uid()
  );
END;
$$;

-- Create policy using the helper function
CREATE POLICY "Users can view participants in their conversations"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (is_user_in_conversation(conversation_id));
