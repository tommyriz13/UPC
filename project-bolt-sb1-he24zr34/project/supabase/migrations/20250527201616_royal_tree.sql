/*
  # Add player banning functionality

  1. Changes
    - Add is_banned column to profiles table
    - Update RLS policies to block banned users
    - Add function to check if user is banned

  2. Security
    - Maintains existing RLS policies
    - Adds additional security for banned users
*/

-- Add is_banned column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

-- Create function to check if user is banned
CREATE OR REPLACE FUNCTION is_user_banned(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND is_banned = true
  );
END;
$$;

-- Update existing RLS policies to block banned users
CREATE OR REPLACE FUNCTION can_access_chat(chat_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First check if user is banned
  IF is_user_banned(auth.uid()) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM match_chats mc
    JOIN matches m ON m.id = mc.match_id
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    WHERE mc.id = chat_id
    AND mc.active = true
    AND (
      ht.captain_id = auth.uid()
      OR at.captain_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );
END;
$$;