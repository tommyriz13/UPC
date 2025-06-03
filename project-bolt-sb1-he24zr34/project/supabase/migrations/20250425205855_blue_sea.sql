/*
  # Add match approval tracking

  1. Changes
    - Add approved field to matches table
    - Update match result submission validation
    - Add function to check if a match result can be submitted

  2. Security
    - Maintains existing RLS policies
    - Ensures data integrity with proper validation
*/

-- Add approved field to matches table if it doesn't exist
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;

-- Update the validate_result_submission function to check approval status
CREATE OR REPLACE FUNCTION validate_result_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if match is already approved
  IF EXISTS (
    SELECT 1 FROM matches
    WHERE id = NEW.match_id
    AND approved = true
  ) THEN
    RAISE EXCEPTION 'Cannot submit result for an approved match';
  END IF;

  -- Check if team has already submitted a result
  IF EXISTS (
    SELECT 1 FROM match_results
    WHERE match_id = NEW.match_id
    AND team_id = NEW.team_id
  ) THEN
    RAISE EXCEPTION 'Team has already submitted a result for this match';
  END IF;

  -- Check if team is involved in the match
  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE id = NEW.match_id
    AND (home_team_id = NEW.team_id OR away_team_id = NEW.team_id)
  ) THEN
    RAISE EXCEPTION 'Team is not involved in this match';
  END IF;

  -- Check if match date is in the past
  IF EXISTS (
    SELECT 1 FROM matches
    WHERE id = NEW.match_id
    AND scheduled_for > now()
  ) THEN
    RAISE EXCEPTION 'Cannot submit result for future matches';
  END IF;

  RETURN NEW;
END;
$$;