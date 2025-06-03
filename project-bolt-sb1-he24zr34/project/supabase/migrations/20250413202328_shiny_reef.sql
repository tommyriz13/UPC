/*
  # Add position and game_id fields to profiles table

  1. Changes
    - Add position field to profiles table
    - Add game_id field to profiles table

  2. Security
    - Maintain existing RLS policies
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'position'
  ) THEN
    ALTER TABLE profiles ADD COLUMN position text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'game_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN game_id text;
  END IF;
END $$;