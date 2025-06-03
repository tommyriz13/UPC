/*
  # Fix match result approval mechanism

  1. Changes
    - Drop existing triggers and functions
    - Create new, corrected versions that properly handle result approval
    - Update RLS policies to allow proper admin control

  2. Security
    - Maintains existing security model
    - Ensures proper admin control over result approval
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS before_match_result_approval ON match_results;
DROP TRIGGER IF EXISTS on_match_result_approved ON match_results;
DROP FUNCTION IF EXISTS prevent_multiple_approvals();
DROP FUNCTION IF EXISTS check_approved_result();

-- Create new function to check approved results
CREATE OR REPLACE FUNCTION check_approved_result(match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM matches
    WHERE id = match_id
    AND status = 'completed'
  );
END;
$$;

-- Create new function to handle match result approval
CREATE OR REPLACE FUNCTION handle_match_result_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update match status and scores
  UPDATE matches
  SET 
    status = 'completed',
    home_score = NEW.home_score,
    away_score = NEW.away_score,
    updated_at = now()
  WHERE id = NEW.match_id
  AND status != 'completed';  -- Only update if not already completed

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

-- Create new trigger for match result approval
CREATE OR REPLACE TRIGGER on_match_result_approved
  AFTER UPDATE OF status
  ON match_results
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION handle_match_result_approval();

-- Update RLS policies
DROP POLICY IF EXISTS "Team captains can submit match results" ON match_results;
CREATE POLICY "Team captains can submit match results"
  ON match_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = match_results.team_id
      AND teams.captain_id = auth.uid()
    )
    AND check_approved_result(match_id)
  );