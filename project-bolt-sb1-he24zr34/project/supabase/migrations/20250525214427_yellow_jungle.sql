-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_match_result_approved ON match_results;
DROP FUNCTION IF EXISTS handle_match_result_approval();

-- Create new function with fixed status update
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
  PERFORM update_team_standings(
    (SELECT competition_id FROM matches WHERE id = NEW.match_id),
    NEW.match_id,
    NEW.home_score,
    NEW.away_score
  );

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

-- Add policy for admin match updates if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'matches' 
    AND policyname = 'Admins can update match status'
  ) THEN
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
  END IF;
END $$;