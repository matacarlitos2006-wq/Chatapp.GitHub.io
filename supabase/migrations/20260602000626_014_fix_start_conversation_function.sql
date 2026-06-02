/*
  # Fix start_conversation function to set created_by

  The function was inserting DEFAULT VALUES which leaves created_by NULL,
  which fails the updated INSERT policy check.
*/

CREATE OR REPLACE FUNCTION start_conversation(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO conversations (created_by)
  VALUES (auth.uid())
  RETURNING id INTO conv_id;

  INSERT INTO conversation_participants (conversation_id, profile_id)
  VALUES
    (conv_id, auth.uid()),
    (conv_id, other_user_id);

  RETURN conv_id;
END;
$$;
