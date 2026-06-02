/*
  # Add Profile Image Fields

  ## Changes
  1. Add avatar_url column to profiles for custom profile pictures
  2. Add background_image_url column to profiles for custom background images

  ## Notes
  - Both fields are optional (nullable)
  - Users can update their own avatar and background images
*/

-- Add avatar_url column for profile pictures
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- Add background_image_url column for profile backgrounds
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS background_image_url TEXT DEFAULT NULL;
