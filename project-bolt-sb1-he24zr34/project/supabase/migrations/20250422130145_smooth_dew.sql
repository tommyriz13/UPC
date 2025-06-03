/*
  # Fix match validation and creation

  1. Changes
    - Fix match teams validation function to properly handle NEW record
    - Add validation to prevent duplicate team matchups in same matchday
    - Remove unnecessary reference to NEW in check_team_matchday_availability

  2. Security
    - Maintains existing RLS policies
    - Ensures data integrity with proper validation
*/

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS check_match_teams ON matches;
DROP FUNCTION IF EXISTS validate_match_teams();
DROP FUNCTION IF EXISTS check_team_matchday_availability();

-- Create new function to check team availability in matchday
CREATE OR REPLACE FUNCTION check_team_matchday_availability(
  p_competition_id uuid,
  p_match_day integer,
  p_home_team_id uuid,
  p_away_team_id uuid,
  p_match_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM matches
    WHERE competition_id = p_competition_id
    AND match_day = p_match_day
    AND id != COALESCE(p_match_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      home_team_id IN (p_home_team_id, p_away_team_id)
      OR away_team_id IN (p_home_team_id, p_away_team_id)
    )
  );
END;
$$;

-- Create new match validation function
CREATE OR REPLACE FUNCTION validate_match_teams()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if teams are different
  IF NEW.home_team_id = NEW.away_team_id THEN
    RAISE EXCEPTION 'Home and away teams must be different';
  END IF;

  -- Check if teams are available for this matchday
  IF NOT check_team_matchday_availability(
    NEW.competition_id,
    NEW.match_day,
    NEW.home_team_id,
    NEW.away_team_id,
    NEW.id
  ) THEN
    RAISE EXCEPTION 'One or both teams already have a match scheduled for this matchday';
  END IF;

  -- Check if both teams are part of the competition
  IF NOT EXISTS (
    SELECT 1 FROM competition_teams
    WHERE competition_id = NEW.competition_id
    AND team_id = NEW.home_team_id
  ) OR NOT EXISTS (
    SELECT 1 FROM competition_teams
    WHERE competition_id = NEW.competition_id
    AND team_id = NEW.away_team_id
  ) THEN
    RAISE EXCEPTION 'Both teams must be part of the competition';
  END IF;

  RETURN NEW;
END;
$$;

-- Create new trigger
CREATE TRIGGER check_match_teams
  BEFORE INSERT OR UPDATE
  ON matches
  FOR EACH ROW
  EXECUTE FUNCTION validate_match_teams();