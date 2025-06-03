/*
  # Fix match player stats relationships

  1. Changes
    - Drop existing foreign key constraints on match_player_stats
    - Recreate foreign key constraints with proper names
    - Add explicit relationship names for better query support

  2. Security
    - Maintains existing RLS policies
*/

-- Drop existing foreign key constraints
ALTER TABLE match_player_stats
DROP CONSTRAINT IF EXISTS match_player_stats_player_id_fkey,
DROP CONSTRAINT IF EXISTS match_player_stats_submitted_by_fkey;

-- Recreate foreign key constraints with explicit names
ALTER TABLE match_player_stats
ADD CONSTRAINT match_player_stats_player_profiles_fkey 
  FOREIGN KEY (player_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE,
ADD CONSTRAINT match_player_stats_submitter_profiles_fkey 
  FOREIGN KEY (submitted_by) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;