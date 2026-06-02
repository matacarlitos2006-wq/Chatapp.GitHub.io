/*
  # Chat Application Schema

  This migration creates the core database structure for a chat application similar to Instagram DMs.

  ## New Tables

  1. **profiles**
     - Extends the built-in auth.users table
     - Stores user profile information (username, avatar, bio)
     - `id` references auth.users.id (one-to-one relationship)
     - Username must be unique across all users

  2. **conversations**
     - Stores conversation/chat room metadata
     - Tracks creation and last activity timestamps
     - Used to group messages between participants

  3. **conversation_participants**
     - Many-to-many junction table between profiles and conversations
     - Ensures a user can only be in a conversation once
     - Tracks when user joined the conversation

  4. **messages**
     - Stores individual chat messages
     - Links to conversation and sender (profile)
     - Includes content and timestamp
     - Ordered by creation time within conversations

  5. **contacts**
     - Stores user contact/friend relationships
     - Tracks request status (pending, accepted, blocked)
     - Unique constraint prevents duplicate contact requests

  ## Security

  All tables have Row Level Security (RLS) enabled with restrictive policies:
  - Users can only read/write their own data
  - Users can only view conversations they participate in
  - Messages are only visible to conversation participants
  - Contact requests require proper ownership

  ## Important Notes

  - RLS is RESTRICTIVE by default - no one can access data until policies are added
  - All policies verify authentication using auth.uid()
  - Policies check ownership or membership before granting access
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation participants (many-to-many)
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, profile_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contacts table (friend requests)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, recipient_id),
  CHECK (requester_id != recipient_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversation_participants_profile ON conversation_participants(profile_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_requester ON contacts(requester_id);
CREATE INDEX IF NOT EXISTS idx_contacts_recipient ON contacts(recipient_id);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Conversations policies
CREATE POLICY "Users can view conversations they participate in"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Conversation participants policies
CREATE POLICY "Users can view participants in their conversations"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can add themselves to conversations"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.profile_id = auth.uid()
    )
  );

-- Contacts policies
CREATE POLICY "Users can view their contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can create contact requests"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Users can update their contact requests"
  ON contacts FOR UPDATE
  TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid())
  WITH CHECK (requester_id = auth.uid() OR recipient_id = auth.uid());

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
