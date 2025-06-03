/*
  # Fix match statistics type consistency

  1. Changes
    - Update column types to use integer consistently
    - Update function return types
    - Maintain data integrity during conversion

  2. Security
    - Maintains existing RLS policies
*/

-- Update matches table
ALTER TABLE matches
ALTER COLUMN home_score TYPE integer USING home_score::integer,
ALTER COLUMN away_score TYPE integer USING away_score::integer;

-- Update match_results table
ALTER TABLE match_results
ALTER COLUMN home_score TYPE integer USING home_score::integer,
ALTER COLUMN away_score TYPE integer USING away_score::integer;

-- Update match_player_stats table
ALTER TABLE match_player_stats
ALTER COLUMN goals TYPE integer USING goals::integer,
ALTER COLUMN assists TYPE integer USING assists::integer;

-- Update standings table
ALTER TABLE standings
ALTER COLUMN played TYPE integer USING played::integer,
ALTER COLUMN won TYPE integer USING won::integer,
ALTER COLUMN drawn TYPE integer USING drawn::integer,
ALTER COLUMN lost TYPE integer USING lost::integer,
ALTER COLUMN goals_for TYPE integer USING goals_for::integer,
ALTER COLUMN goals_against TYPE integer USING goals_against::integer,
ALTER COLUMN goal_difference TYPE integer USING goal_difference::integer,
ALTER COLUMN points TYPE integer USING points::integer;

-- Update competition_teams table
ALTER TABLE competition_teams
ALTER COLUMN points TYPE integer USING points::integer,
ALTER COLUMN matches_played TYPE integer USING matches_played::integer,
ALTER COLUMN wins TYPE integer USING wins::integer,
ALTER COLUMN draws TYPE integer USING draws::integer,
ALTER COLUMN losses TYPE integer USING losses::integer,
ALTER COLUMN goals_for TYPE integer USING goals_for::integer,
ALTER COLUMN goals_against TYPE integer USING goals_against::integer;

-- Update function return types
CREATE OR REPLACE FUNCTION calculate_standings(
  p_competition_id uuid,
  p_team_id uuid
)
RETURNS TABLE (
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats record;
BEGIN
  -- Calculate stats from completed matches
  SELECT 
    COUNT(*)::integer as played,
    COUNT(*) FILTER (WHERE 
      (home_team_id = p_team_id AND home_score > away_score) OR
      (away_team_id = p_team_id AND away_score > home_score)
    )::integer as won,
    COUNT(*) FILTER (WHERE home_score = away_score)::integer as drawn,
    COUNT(*) FILTER (WHERE 
      (home_team_id = p_team_id AND home_score < away_score) OR
      (away_team_id = p_team_id AND away_score < home_score)
    )::integer as lost,
    COALESCE(SUM(CASE 
      WHEN home_team_id = p_team_id THEN home_score
      ELSE away_score
    END), 0)::integer as goals_for,
    COALESCE(SUM(CASE 
      WHEN home_team_id = p_team_id THEN away_score
      ELSE home_score
    END), 0)::integer as goals_against
  INTO v_stats
  FROM matches
  WHERE competition_id = p_competition_id
  AND status = 'completed'
  AND approved = true
  AND (home_team_id = p_team_id OR away_team_id = p_team_id);

  RETURN QUERY
  SELECT
    COALESCE(v_stats.played, 0)::integer,
    COALESCE(v_stats.won, 0)::integer,
    COALESCE(v_stats.drawn, 0)::integer,
    COALESCE(v_stats.lost, 0)::integer,
    COALESCE(v_stats.goals_for, 0)::integer,
    COALESCE(v_stats.goals_against, 0)::integer,
    COALESCE(v_stats.goals_for - v_stats.goals_against, 0)::integer,
    COALESCE(v_stats.won * 3 + v_stats.drawn, 0)::integer;
END;
$$;