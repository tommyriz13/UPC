/*
  # Fix profiles and auth.users relationship

  1. Changes
    - Drop existing foreign key if it exists
    - Add proper foreign key constraint to link profiles with auth.users
    - Add cascade delete to maintain referential integrity

  2. Security
    - Maintains existing RLS policies
*/

-- First drop the existing constraint if it exists
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Add the foreign key constraint
ALTER TABLE profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- Verify the constraint exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey'
    AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'Foreign key constraint was not created successfully';
  END IF;
END $$;