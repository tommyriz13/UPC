/*
  # Add match result submission improvements

  1. Changes
    - Add unique constraint to prevent duplicate team submissions
    - Add check constraint to prevent teams playing multiple times in same matchday
    - Add function to validate match submissions
    - Add trigger to prevent multiple submissions from same team

  2. Security
    - Maintains existing RLS policies
    - Adds additional validation for match submissions
*/

-- Add unique constraint to prevent duplicate submissions per team
ALTER TABLE match_results
ADD CONSTRAINT unique_team_submission UNIQUE (match_id, team_id);

-- Add function to check if a team is already playing in a matchday
CREATE OR REPLACE FUNCTION check_team_matchday_availability(
  p_competition_id uuid,
  p_match_day integer,
  p_home_team_id uuid,
  p_away_team_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM matches
    WHERE competition_id = p_competition_id
    AND match_day = p_match_day
    AND (
      home_team_id IN (p_home_team_id, p_away_team_id)
      OR away_team_id IN (p_home_team_id, p_away_team_id)
    )
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
END;
$$;

-- Add trigger to validate team availability in matchday
CREATE OR REPLACE FUNCTION validate_match_teams()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT check_team_matchday_availability(
    NEW.competition_id,
    NEW.match_day,
    NEW.home_team_id,
    NEW.away_team_id
  ) THEN
    RAISE EXCEPTION 'Team(s) already have a match scheduled for this matchday';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_match_teams
  BEFORE INSERT OR UPDATE
  ON matches
  FOR EACH ROW
  EXECUTE FUNCTION validate_match_teams();

-- Add function to check if a team has already submitted a result
CREATE OR REPLACE FUNCTION check_team_result_submission(
  p_match_id uuid,
  p_team_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM match_results
    WHERE match_id = p_match_id
    AND team_id = p_team_id
  );
END;
$$;

-- Add trigger to prevent multiple submissions from same team
CREATE OR REPLACE FUNCTION validate_result_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT check_team_result_submission(NEW.match_id, NEW.team_id) THEN
    RAISE EXCEPTION 'Team has already submitted a result for this match';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_result_submission
  BEFORE INSERT
  ON match_results
  FOR EACH ROW
  EXECUTE FUNCTION validate_result_submission();