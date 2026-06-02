/*
  # Add Verified Badge System

  ## Changes
  1. Add is_verified column to profiles table
  2. Set @carlo58373 as verified
  3. Add policy to prevent users from verifying themselves

  ## Security
  - Only database admins can set is_verified = true
  - Users cannot update their own verification status
*/

-- Add is_verified column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Set @carlo58373 as verified
UPDATE profiles 
SET is_verified = true 
WHERE username = 'carlo58373';

-- Add policy preventing users from changing their own verification
CREATE POLICY "Users cannot update their own verification status"
  ON profiles FOR UPDATE
  TO authenticated
  WITH CHECK (
    is_verified = (SELECT is_verified FROM profiles WHERE id = auth.uid())
    OR is_verified = false
  );
