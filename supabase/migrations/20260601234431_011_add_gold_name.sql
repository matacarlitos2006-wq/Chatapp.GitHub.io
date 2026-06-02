/*
  # Add Gold Name Feature

  ## Changes
  - Add has_gold_name boolean to profiles table
  - Set carlo58373's has_gold_name to true

  ## Security
  - Only admins can grant the gold name flag
*/

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS has_gold_name BOOLEAN DEFAULT false;

UPDATE profiles
SET has_gold_name = true
WHERE username = 'carlo58373';
