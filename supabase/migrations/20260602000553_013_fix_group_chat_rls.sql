/*
  # Fix Group Chat RLS Policies

  ## Problems Fixed
  1. conversations INSERT + SELECT race: creator can't read back their new conversation before participants are inserted
  2. conversation_participants INSERT policy has a self-referencing bug
  3. No UPDATE policy on conversations (updated_at writes were silently failing)
  4. Public groups not visible to all authenticated users

  ## Strategy
  - Allow the conversation creator (created_by) to always SELECT their own conversations
  - Allow all authenticated users to SELECT public group conversations
  - Fix participant INSERT policy so group creators can add all initial members
  - Add UPDATE policy for conversation owners and participants
*/

-- Drop old broken policies
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Users can add participants to conversations" ON conversation_participants;

-- ───────────────────────────────────────────────
-- conversations SELECT
-- ───────────────────────────────────────────────
CREATE POLICY "Users can view their conversations or public groups"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    -- user is a participant
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.profile_id = auth.uid()
    )
    -- OR they created it (so creator can read back immediately after insert)
    OR created_by = auth.uid()
    -- OR it is a public group (visible to all)
    OR (is_group = true AND is_public = true)
  );

-- ───────────────────────────────────────────────
-- conversations INSERT
-- ───────────────────────────────────────────────
CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    -- creator must match the auth user when provided
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- ───────────────────────────────────────────────
-- conversations UPDATE
-- ───────────────────────────────────────────────
CREATE POLICY "Participants and creators can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.profile_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────
-- conversation_participants INSERT (fixed)
-- ───────────────────────────────────────────────
CREATE POLICY "Users can add participants to conversations"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    -- adding yourself
    profile_id = auth.uid()
    -- OR you are the creator of the conversation
    OR EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
        AND conversations.created_by = auth.uid()
    )
    -- OR you are already a participant (adding others)
    OR EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.profile_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────
-- conversation_participants DELETE (for kick)
-- ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can leave conversations" ON conversation_participants;

CREATE POLICY "Users can remove themselves or admins can remove anyone"
  ON conversation_participants FOR DELETE
  TO authenticated
  USING (
    -- removing yourself
    profile_id = auth.uid()
    -- OR you are the creator of the conversation
    OR EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
        AND conversations.created_by = auth.uid()
    )
  );

-- ───────────────────────────────────────────────
-- conversation_participants SELECT (keep existing but ensure it works for public groups)
-- ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;

CREATE POLICY "Users can view participants in their conversations"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    -- user is in the conversation
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.profile_id = auth.uid()
    )
    -- OR user created the conversation
    OR EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_participants.conversation_id
        AND conversations.created_by = auth.uid()
    )
    -- OR it is a public group
    OR EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_participants.conversation_id
        AND conversations.is_group = true
        AND conversations.is_public = true
    )
  );
