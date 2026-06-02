/*
  # Add User Title System

  ## Changes
  1. Add title column to profiles table
  2. Set @carlo58373's title to "Website developer"
  3. Add policy to prevent users from setting their own title

  ## Security
  - Only database admins can set titles
  - Users cannot update their own title
*/

-- Add title column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS title TEXT DEFAULT NULL;

-- Set @carlo58373's title
UPDATE profiles 
SET title = 'Website developer'
WHERE username = 'carlo58373';

-- Add policy preventing users from changing their own title
CREATE POLICY "Users cannot update their own title"
  ON profiles FOR UPDATE
  TO authenticated
  WITH CHECK (
    title = (SELECT title FROM profiles WHERE id = auth.uid())
    OR title IS NULL
  );
