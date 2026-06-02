/*
  # Add role column to conversation_participants

  ## Changes
  - Add `role` column (owner/admin/member) to conversation_participants
  - Set existing creators as owners
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_participants' AND column_name = 'role') THEN
    ALTER TABLE conversation_participants ADD COLUMN role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member'));
  END IF;
END $$;

-- Set existing conversation creators as owners
UPDATE conversation_participants cp
SET role = 'owner'
FROM conversations c
WHERE cp.conversation_id = c.id
  AND cp.profile_id = c.created_by
  AND cp.role = 'member';
