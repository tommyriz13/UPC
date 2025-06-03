/*
  # Add standings table and management

  1. New Tables
    - `standings`
      - `id` (uuid, primary key)
      - `competition_id` (uuid, references competitions)
      - `team_id` (uuid, references teams)
      - `team_name` (text)
      - `played` (integer)
      - `won` (integer)
      - `drawn` (integer)
      - `lost` (integer)
      - `goals_for` (integer)
      - `goals_against` (integer)
      - `goal_difference` (integer)
      - `points` (integer)
      - `updated_at` (timestamptz)

  2. Functions
    - `update_standings` - Updates standings for a team after match completion
    - `rebuild_standings` - Rebuilds entire standings table from match history
    - `calculate_standings` - Calculates standings for a specific team

  3. Triggers
    - Automatically update standings when match is completed
*/

-- Create standings table
CREATE TABLE IF NOT EXISTS standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  played integer DEFAULT 0,
  won integer DEFAULT 0,
  drawn integer DEFAULT 0,
  lost integer DEFAULT 0,
  goals_for integer DEFAULT 0,
  goals_against integer DEFAULT 0,
  goal_difference integer DEFAULT 0,
  points integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(competition_id, team_id)
);

-- Enable RLS
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Standings are viewable by everyone"
  ON standings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify standings"
  ON standings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to calculate standings for a team
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
    COUNT(*) as played,
    COUNT(*) FILTER (WHERE 
      (home_team_id = p_team_id AND home_score > away_score) OR
      (away_team_id = p_team_id AND away_score > home_score)
    ) as won,
    COUNT(*) FILTER (WHERE home_score = away_score) as drawn,
    COUNT(*) FILTER (WHERE 
      (home_team_id = p_team_id AND home_score < away_score) OR
      (away_team_id = p_team_id AND away_score < home_score)
    ) as lost,
    SUM(CASE 
      WHEN home_team_id = p_team_id THEN home_score
      ELSE away_score
    END) as goals_for,
    SUM(CASE 
      WHEN home_team_id = p_team_id THEN away_score
      ELSE home_score
    END) as goals_against
  INTO v_stats
  FROM matches
  WHERE competition_id = p_competition_id
  AND status = 'completed'
  AND approved = true
  AND (home_team_id = p_team_id OR away_team_id = p_team_id);

  RETURN QUERY
  SELECT
    COALESCE(v_stats.played, 0),
    COALESCE(v_stats.won, 0),
    COALESCE(v_stats.drawn, 0),
    COALESCE(v_stats.lost, 0),
    COALESCE(v_stats.goals_for, 0),
    COALESCE(v_stats.goals_against, 0),
    COALESCE(v_stats.goals_for - v_stats.goals_against, 0),
    COALESCE(v_stats.won * 3 + v_stats.drawn, 0);
END;
$$;

-- Function to update standings for a team
CREATE OR REPLACE FUNCTION update_standings(
  p_competition_id uuid,
  p_team_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_name text;
  v_stats record;
BEGIN
  -- Get team name
  SELECT name INTO v_team_name
  FROM teams
  WHERE id = p_team_id;

  -- Calculate current stats
  SELECT * INTO v_stats
  FROM calculate_standings(p_competition_id, p_team_id);

  -- Update or insert standings
  INSERT INTO standings (
    competition_id,
    team_id,
    team_name,
    played,
    won,
    drawn,
    lost,
    goals_for,
    goals_against,
    goal_difference,
    points,
    updated_at
  )
  VALUES (
    p_competition_id,
    p_team_id,
    v_team_name,
    v_stats.played,
    v_stats.won,
    v_stats.drawn,
    v_stats.lost,
    v_stats.goals_for,
    v_stats.goals_against,
    v_stats.goal_difference,
    v_stats.points,
    now()
  )
  ON CONFLICT (competition_id, team_id) DO UPDATE
  SET
    team_name = EXCLUDED.team_name,
    played = EXCLUDED.played,
    won = EXCLUDED.won,
    drawn = EXCLUDED.drawn,
    lost = EXCLUDED.lost,
    goals_for = EXCLUDED.goals_for,
    goals_against = EXCLUDED.goals_against,
    goal_difference = EXCLUDED.goal_difference,
    points = EXCLUDED.points,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- Function to rebuild all standings
CREATE OR REPLACE FUNCTION rebuild_standings(
  p_competition_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  -- Delete existing standings for this competition
  DELETE FROM standings
  WHERE competition_id = p_competition_id;

  -- Get all teams in the competition
  FOR v_team_id IN
    SELECT team_id
    FROM competition_teams
    WHERE competition_id = p_competition_id
  LOOP
    -- Update standings for each team
    PERFORM update_standings(p_competition_id, v_team_id);
  END LOOP;
END;
$$;

-- Update the handle_match_result_approval function to use the new standings system
CREATE OR REPLACE FUNCTION handle_match_result_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_competition_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
BEGIN
  -- Get match details
  SELECT 
    competition_id,
    home_team_id,
    away_team_id
  INTO
    v_competition_id,
    v_home_team_id,
    v_away_team_id
  FROM matches
  WHERE id = NEW.match_id;

  -- Update match status
  UPDATE matches
  SET 
    status = 'completed'::match_status,
    home_score = NEW.home_score,
    away_score = NEW.away_score,
    approved = true,
    updated_at = now()
  WHERE id = NEW.match_id;

  -- Update standings for both teams
  PERFORM update_standings(v_competition_id, v_home_team_id);
  PERFORM update_standings(v_competition_id, v_away_team_id);

  RETURN NEW;
END;
$$;