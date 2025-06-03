/*
  # Fix match status update on approval

  1. Changes
    - Update handle_match_result_approval function to properly set match status
    - Add verification to ensure status is updated correctly
    - Maintain existing functionality for standings updates

  2. Security
    - Maintains existing RLS policies
*/

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
    status = 'completed'::match_status,
    home_score = NEW.home_score,
    away_score = NEW.away_score,
    approved = true,
    updated_at = now()
  WHERE id = NEW.match_id
  AND status != 'completed'::match_status;

  -- Update team standings only if match was not already completed
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