/*
  # Fix match result validation for all competition types

  1. Database Functions
    - Update validate_match_id function to check all match tables
    - Update validate_result_submission function to validate team participation across all tables
    - Create helper function to check team participation

  2. Security
    - Ensure validation works across matches_league, matches_cup, matches_champions tables
    - Maintain existing RLS policies
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS validate_match_id(uuid);
DROP FUNCTION IF EXISTS validate_result_submission();
DROP FUNCTION IF EXISTS check_team_in_match(uuid, uuid);

-- Create helper function to check if a team is involved in a match
CREATE OR REPLACE FUNCTION check_team_in_match(p_match_id uuid, p_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check in matches_league table
  IF EXISTS (
    SELECT 1 FROM matches_league 
    WHERE id = p_match_id 
    AND (home_team_id = p_team_id OR away_team_id = p_team_id)
  ) THEN
    RETURN true;
  END IF;

  -- Check in matches_cup table
  IF EXISTS (
    SELECT 1 FROM matches_cup 
    WHERE id = p_match_id 
    AND (home_team_id = p_team_id OR away_team_id = p_team_id)
  ) THEN
    RETURN true;
  END IF;

  -- Check in matches_champions table
  IF EXISTS (
    SELECT 1 FROM matches_champions 
    WHERE id = p_match_id 
    AND (home_team_id = p_team_id OR away_team_id = p_team_id)
  ) THEN
    RETURN true;
  END IF;

  -- Check in legacy matches table (if still used)
  IF EXISTS (
    SELECT 1 FROM matches 
    WHERE id = p_match_id 
    AND (home_team_id = p_team_id OR away_team_id = p_team_id)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Create updated validate_match_id function
CREATE OR REPLACE FUNCTION validate_match_id(p_match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if match exists in any of the match tables
  IF EXISTS (SELECT 1 FROM matches_league WHERE id = p_match_id) THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM matches_cup WHERE id = p_match_id) THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM matches_champions WHERE id = p_match_id) THEN
    RETURN true;
  END IF;

  -- Check legacy matches table
  IF EXISTS (SELECT 1 FROM matches WHERE id = p_match_id) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Create updated validate_result_submission function
CREATE OR REPLACE FUNCTION validate_result_submission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the match exists
  IF NOT validate_match_id(NEW.match_id) THEN
    RAISE EXCEPTION 'Match does not exist';
  END IF;

  -- Check if the team is involved in this match
  IF NOT check_team_in_match(NEW.match_id, NEW.team_id) THEN
    RAISE EXCEPTION 'Team is not involved in this match';
  END IF;

  -- Check if team has already submitted a result for this match
  IF EXISTS (
    SELECT 1 FROM match_results 
    WHERE match_id = NEW.match_id 
    AND team_id = NEW.team_id 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Team has already submitted a result for this match';
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS check_result_submission ON match_results;
CREATE TRIGGER check_result_submission
  BEFORE INSERT OR UPDATE ON match_results
  FOR EACH ROW
  EXECUTE FUNCTION validate_result_submission();

-- Update the check constraint to use the new function
ALTER TABLE match_results DROP CONSTRAINT IF EXISTS match_results_valid_match_id;
ALTER TABLE match_results ADD CONSTRAINT match_results_valid_match_id 
  CHECK (validate_match_id(match_id));

-- Update similar constraints on other tables that reference match_id
ALTER TABLE match_stats DROP CONSTRAINT IF EXISTS match_stats_valid_match_id;
ALTER TABLE match_stats ADD CONSTRAINT match_stats_valid_match_id 
  CHECK (validate_match_id(match_id));

ALTER TABLE match_player_stats DROP CONSTRAINT IF EXISTS match_player_stats_valid_match_id;
ALTER TABLE match_player_stats ADD CONSTRAINT match_player_stats_valid_match_id 
  CHECK (validate_match_id(match_id));

ALTER TABLE match_chats DROP CONSTRAINT IF EXISTS match_chats_valid_match_id;
ALTER TABLE match_chats ADD CONSTRAINT match_chats_valid_match_id 
  CHECK (validate_match_id(match_id));

ALTER TABLE match_lineups DROP CONSTRAINT IF EXISTS match_lineups_valid_match_id;
ALTER TABLE match_lineups ADD CONSTRAINT match_lineups_valid_match_id 
  CHECK (validate_match_id(match_id));

ALTER TABLE match_proofs DROP CONSTRAINT IF EXISTS match_proofs_valid_match_id;
ALTER TABLE match_proofs ADD CONSTRAINT match_proofs_valid_match_id 
  CHECK (validate_match_id(match_id));