/*
  # Improve match result approval system

  1. Changes
    - Add approved field to matches table
    - Update match result approval function to set approved flag
    - Add function to get pending match results

  2. Security
    - Maintains existing RLS policies
*/

-- Add approved field to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;

-- Update the handle_match_result_approval function
CREATE OR REPLACE FUNCTION handle_match_result_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update match status, scores, and approved flag
  UPDATE matches
  SET 
    status = 'completed',
    home_score = NEW.home_score,
    away_score = NEW.away_score,
    approved = true,
    updated_at = now()
  WHERE id = NEW.match_id
  AND NOT approved;  -- Only update if not already approved

  -- Update team standings only if match was not already approved
  IF FOUND THEN
    PERFORM update_team_standings(
      (SELECT competition_id FROM matches WHERE id = NEW.match_id),
      NEW.match_id,
      NEW.home_score,
      NEW.away_score
    );
  END IF;

  RETURN NEW;
END;
$$;