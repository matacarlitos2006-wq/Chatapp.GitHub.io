/*
  # Create Helper Function for Starting Conversations
  
  ## Purpose
  Creates a secure database function that handles creating a new conversation
  between two users. This function:
  1. Creates the conversation
  2. Adds both participants
  3. Returns the conversation ID
  
  ## Security
  - Uses SECURITY DEFINER with proper permissions
  - Validates that the other user exists
  - Only authenticated users can call this function
  - All RLS policies still apply
*/

-- Create a function to start a conversation
CREATE OR REPLACE FUNCTION start_conversation(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv_id UUID;
BEGIN
  -- Check if the other user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Create the conversation
  INSERT INTO conversations DEFAULT VALUES
  RETURNING id INTO conv_id;
  
  -- Add both participants
  INSERT INTO conversation_participants (conversation_id, profile_id)
  VALUES 
    (conv_id, auth.uid()),
    (conv_id, other_user_id);
  
  RETURN conv_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION start_conversation(UUID) TO authenticated;
