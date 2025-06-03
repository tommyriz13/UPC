/*
  # Fix match status update on approval

  1. Changes
    - Drop existing trigger first
    - Update handle_match_result_approval function
    - Recreate trigger
    - Add admin policy for match status updates

  2. Security
    - Maintains existing RLS policies
    - Adds specific policy for admin match updates
*/

-- First drop the trigger that depends on the function
DROP TRIGGER IF EXISTS on_match_result_approved ON match_results;

-- Now we can safely drop and recreate the function
DROP FUNCTION IF EXISTS handle_match_result_approval();

-- Recreate function with fixed status update
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
  WHERE id = NEW.match_id;

  -- Update team standings
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

-- Recreate the trigger
CREATE TRIGGER on_match_result_approved
  AFTER UPDATE OF status
  ON match_results
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION handle_match_result_approval();

-- Add policy to allow admins to update match status
DROP POLICY IF EXISTS "Admins can update match status" ON matches;

CREATE POLICY "Admins can update match status"
  ON matches
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );