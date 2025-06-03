/*
  # Add match result approval and locking mechanism

  1. Changes
    - Add trigger to update competition_teams standings when match results are approved
    - Add trigger to update match status when results are approved
    - Add function to calculate and update team standings
    - Add function to validate match result submissions

  2. Security
    - Maintains existing RLS policies
    - Adds additional validation for result submissions
*/

-- Function to calculate and update team standings
CREATE OR REPLACE FUNCTION update_team_standings(
  p_competition_id uuid,
  p_match_id uuid,
  p_home_score integer,
  p_away_score integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_home_team_id uuid;
  v_away_team_id uuid;
BEGIN
  -- Get the teams involved
  SELECT home_team_id, away_team_id
  INTO v_home_team_id, v_away_team_id
  FROM matches
  WHERE id = p_match_id;

  -- Update home team stats
  UPDATE competition_teams
  SET 
    matches_played = matches_played + 1,
    wins = wins + CASE WHEN p_home_score > p_away_score THEN 1 ELSE 0 END,
    draws = draws + CASE WHEN p_home_score = p_away_score THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN p_home_score < p_away_score THEN 1 ELSE 0 END,
    goals_for = goals_for + p_home_score,
    goals_against = goals_against + p_away_score,
    points = points + 
      CASE 
        WHEN p_home_score > p_away_score THEN 3
        WHEN p_home_score = p_away_score THEN 1
        ELSE 0
      END
  WHERE competition_id = p_competition_id AND team_id = v_home_team_id;

  -- Update away team stats
  UPDATE competition_teams
  SET 
    matches_played = matches_played + 1,
    wins = wins + CASE WHEN p_away_score > p_home_score THEN 1 ELSE 0 END,
    draws = draws + CASE WHEN p_away_score = p_home_score THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN p_away_score < p_home_score THEN 1 ELSE 0 END,
    goals_for = goals_for + p_away_score,
    goals_against = goals_against + p_home_score,
    points = points + 
      CASE 
        WHEN p_away_score > p_home_score THEN 3
        WHEN p_away_score = p_home_score THEN 1
        ELSE 0
      END
  WHERE competition_id = p_competition_id AND team_id = v_away_team_id;
END;
$$;

-- Function to handle match result approval
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

-- Function to check if a match already has an approved result
CREATE OR REPLACE FUNCTION check_approved_result(match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  approved_count integer;
BEGIN
  SELECT COUNT(*)
  INTO approved_count
  FROM match_results
  WHERE match_results.match_id = check_approved_result.match_id
  AND status = 'approved';
  
  RETURN approved_count = 0;
END;
$$;

-- Create trigger for match result approval
CREATE OR REPLACE TRIGGER on_match_result_approved
  AFTER UPDATE OF status
  ON match_results
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION handle_match_result_approval();

-- Create trigger to prevent multiple approved results
CREATE OR REPLACE FUNCTION prevent_multiple_approvals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'approved' AND NOT check_approved_result(NEW.match_id) THEN
    RAISE EXCEPTION 'Match already has an approved result';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER before_match_result_approval
  BEFORE INSERT OR UPDATE OF status
  ON match_results
  FOR EACH ROW
  EXECUTE FUNCTION prevent_multiple_approvals();

-- Update RLS policies to prevent submissions for approved matches
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