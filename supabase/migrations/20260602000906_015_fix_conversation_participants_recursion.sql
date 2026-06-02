/*
  # Fix infinite recursion in conversation_participants RLS policies

  ## Root Cause
  The conversation_participants SELECT policy queries conversation_participants itself,
  and the conversations SELECT policy queries conversation_participants, which then
  triggers the conversation_participants SELECT policy again — infinite recursion.

  ## Fix
  Use a SECURITY DEFINER helper function that bypasses RLS to check membership.
  All policies then call this function instead of directly querying the tables.
*/

-- Drop ALL existing policies on both tables to start clean
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can remove themselves or admins can remove anyone" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations or public groups" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Participants and creators can update conversations" ON conversations;

-- Security definer function: checks membership without triggering RLS
CREATE OR REPLACE FUNCTION is_conversation_member(conv_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conv_id
      AND profile_id = uid
  );
$$;

-- Security definer function: checks if conversation is public group
CREATE OR REPLACE FUNCTION is_public_group(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = conv_id
      AND is_group = true
      AND is_public = true
  );
$$;

-- Security definer function: checks if user created the conversation
CREATE OR REPLACE FUNCTION is_conversation_creator(conv_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = conv_id
      AND created_by = uid
  );
$$;

-- ───────────────────────────────────────────────
-- conversations policies
-- ───────────────────────────────────────────────
CREATE POLICY "conversations_select"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    is_conversation_member(id, auth.uid())
    OR created_by = auth.uid()
    OR (is_group = true AND is_public = true)
  );

CREATE POLICY "conversations_insert"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE POLICY "conversations_update"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR is_conversation_member(id, auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR is_conversation_member(id, auth.uid())
  );

-- ───────────────────────────────────────────────
-- conversation_participants policies (NO self-reference)
-- ───────────────────────────────────────────────
CREATE POLICY "participants_select"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    is_conversation_member(conversation_id, auth.uid())
    OR is_conversation_creator(conversation_id, auth.uid())
    OR is_public_group(conversation_id)
  );

CREATE POLICY "participants_insert"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR is_conversation_creator(conversation_id, auth.uid())
    OR is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY "participants_delete"
  ON conversation_participants FOR DELETE
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR is_conversation_creator(conversation_id, auth.uid())
  );
