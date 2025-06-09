/*
  # Clean up obsolete competition tables and update schema

  1. Drop obsolete tables
    - competition_editions
    - competition_format
    - competition_matches
    - competition_stages
    - competition_teams

  2. Add edition_id to new tables
    - Add edition_id to matches_league, matches_cup, matches_champions
    - Add edition_id to standings_league, standings_champions_groups
    - Add edition_id to stats_league, stats_cup, stats_champions

  3. Create editions table for managing multiple editions per type
    - Simple editions table with type and name

  4. Update functions and triggers
*/

-- Drop obsolete tables
DROP TABLE IF EXISTS competition_format CASCADE;
DROP TABLE IF EXISTS competition_matches CASCADE;
DROP TABLE IF EXISTS competition_stages CASCADE;
DROP TABLE IF EXISTS competition_teams CASCADE;
DROP TABLE IF EXISTS competition_editions CASCADE;

-- Create simple editions table
CREATE TABLE IF NOT EXISTS editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type competition_type NOT NULL,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Editions are viewable by everyone"
  ON editions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify editions"
  ON editions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add edition_id to existing tables if not exists
ALTER TABLE matches_league 
ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES editions(id) ON DELETE CASCADE;

ALTER TABLE matches_cup 
ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES editions(id) ON DELETE CASCADE;

ALTER TABLE matches_champions 
ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES editions(id) ON DELETE CASCADE;

ALTER TABLE standings_league 
ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES editions(id) ON DELETE CASCADE;

ALTER TABLE standings_champions_groups 
ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES editions(id) ON DELETE CASCADE;

ALTER TABLE stats_league 
ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES editions(id) ON DELETE CASCADE;

ALTER TABLE stats_cup 
ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES editions(id) ON DELETE CASCADE;

ALTER TABLE stats_champions 
ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES editions(id) ON DELETE CASCADE;

-- Update unique constraints to include edition_id
DROP INDEX IF EXISTS standings_league_edition_id_team_id_key;
CREATE UNIQUE INDEX standings_league_edition_id_team_id_key ON standings_league(edition_id, team_id);

DROP INDEX IF EXISTS standings_champions_groups_edition_id_group_name_team_id_key;
CREATE UNIQUE INDEX standings_champions_groups_edition_id_group_name_team_id_key ON standings_champions_groups(edition_id, group_name, team_id);

DROP INDEX IF EXISTS stats_league_edition_id_player_id_key;
CREATE UNIQUE INDEX stats_league_edition_id_player_id_key ON stats_league(edition_id, player_id);

DROP INDEX IF EXISTS stats_cup_edition_id_player_id_key;
CREATE UNIQUE INDEX stats_cup_edition_id_player_id_key ON stats_cup(edition_id, player_id);

DROP INDEX IF EXISTS stats_champions_edition_id_player_id_key;
CREATE UNIQUE INDEX stats_champions_edition_id_player_id_key ON stats_champions(edition_id, player_id);

-- Update functions to work with new schema
CREATE OR REPLACE FUNCTION get_competition_matches(
  p_competition_id uuid,
  p_competition_type competition_type
)
RETURNS TABLE (
  id uuid,
  home_team_id uuid,
  away_team_id uuid,
  home_team_name text,
  away_team_name text,
  home_score integer,
  away_score integer,
  scheduled_for timestamptz,
  match_day integer,
  approved boolean,
  round integer,
  leg integer,
  stage text,
  group_name text,
  bracket_position jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CASE p_competition_type
    WHEN 'league' THEN
      RETURN QUERY
      SELECT 
        ml.id,
        ml.home_team_id,
        ml.away_team_id,
        ht.name as home_team_name,
        at.name as away_team_name,
        ml.home_score,
        ml.away_score,
        ml.scheduled_for,
        ml.match_day,
        ml.approved,
        NULL::integer as round,
        NULL::integer as leg,
        NULL::text as stage,
        NULL::text as group_name,
        NULL::jsonb as bracket_position
      FROM matches_league ml
      JOIN teams ht ON ht.id = ml.home_team_id
      JOIN teams at ON at.id = ml.away_team_id
      WHERE ml.edition_id = p_competition_id;
      
    WHEN 'cup' THEN
      RETURN QUERY
      SELECT 
        mc.id,
        mc.home_team_id,
        mc.away_team_id,
        ht.name as home_team_name,
        at.name as away_team_name,
        mc.home_score,
        mc.away_score,
        mc.scheduled_for,
        NULL::integer as match_day,
        mc.approved,
        mc.round,
        mc.leg,
        NULL::text as stage,
        NULL::text as group_name,
        NULL::jsonb as bracket_position
      FROM matches_cup mc
      JOIN teams ht ON ht.id = mc.home_team_id
      JOIN teams at ON at.id = mc.away_team_id
      WHERE mc.edition_id = p_competition_id;
      
    WHEN 'champions' THEN
      RETURN QUERY
      SELECT 
        mch.id,
        mch.home_team_id,
        mch.away_team_id,
        ht.name as home_team_name,
        at.name as away_team_name,
        mch.home_score,
        mch.away_score,
        mch.scheduled_for,
        mch.match_day,
        mch.approved,
        NULL::integer as round,
        NULL::integer as leg,
        mch.stage,
        mch.group_name,
        NULL::jsonb as bracket_position
      FROM matches_champions mch
      JOIN teams ht ON ht.id = mch.home_team_id
      JOIN teams at ON at.id = mch.away_team_id
      WHERE mch.edition_id = p_competition_id;
  END CASE;
END;
$$;

-- Update standings functions
CREATE OR REPLACE FUNCTION get_competition_standings(
  p_competition_id uuid,
  p_competition_type competition_type
)
RETURNS TABLE (
  team_id uuid,
  team_name text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  group_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CASE p_competition_type
    WHEN 'league' THEN
      RETURN QUERY
      SELECT 
        sl.team_id,
        sl.team_name,
        sl.played,
        sl.won,
        sl.drawn,
        sl.lost,
        sl.goals_for,
        sl.goals_against,
        sl.goal_difference,
        sl.points,
        NULL::text as group_name
      FROM standings_league sl
      WHERE sl.edition_id = p_competition_id
      ORDER BY sl.points DESC, sl.goal_difference DESC, sl.goals_for DESC;
      
    WHEN 'champions' THEN
      RETURN QUERY
      SELECT 
        scg.team_id,
        scg.team_name,
        scg.played,
        scg.won,
        scg.drawn,
        scg.lost,
        scg.goals_for,
        scg.goals_against,
        scg.goal_difference,
        scg.points,
        scg.group_name
      FROM standings_champions_groups scg
      WHERE scg.edition_id = p_competition_id
      ORDER BY scg.group_name, scg.points DESC, scg.goal_difference DESC, scg.goals_for DESC;
      
    ELSE
      -- Cup competitions don't have standings
      RETURN;
  END CASE;
END;
$$;

-- Update stats functions
CREATE OR REPLACE FUNCTION get_competition_stats(
  p_competition_id uuid,
  p_competition_type competition_type
)
RETURNS TABLE (
  player_id uuid,
  player_name text,
  team_name text,
  goals integer,
  assists integer,
  matches_played integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CASE p_competition_type
    WHEN 'league' THEN
      RETURN QUERY
      SELECT 
        sl.player_id,
        p.username as player_name,
        t.name as team_name,
        sl.goals,
        sl.assists,
        sl.matches_played
      FROM stats_league sl
      JOIN profiles p ON p.id = sl.player_id
      JOIN teams t ON t.id = sl.team_id
      WHERE sl.edition_id = p_competition_id;
      
    WHEN 'cup' THEN
      RETURN QUERY
      SELECT 
        sc.player_id,
        p.username as player_name,
        t.name as team_name,
        sc.goals,
        sc.assists,
        sc.matches_played
      FROM stats_cup sc
      JOIN profiles p ON p.id = sc.player_id
      JOIN teams t ON t.id = sc.team_id
      WHERE sc.edition_id = p_competition_id;
      
    WHEN 'champions' THEN
      RETURN QUERY
      SELECT 
        sch.player_id,
        p.username as player_name,
        t.name as team_name,
        sch.goals,
        sch.assists,
        sch.matches_played
      FROM stats_champions sch
      JOIN profiles p ON p.id = sch.player_id
      JOIN teams t ON t.id = sch.team_id
      WHERE sch.edition_id = p_competition_id;
  END CASE;
END;
$$;

-- Drop obsolete functions
DROP FUNCTION IF EXISTS generate_swiss_matches(uuid, uuid);
DROP FUNCTION IF EXISTS generate_knockout_matches(uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS update_team_standings(uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS calculate_standings(uuid, uuid);
DROP FUNCTION IF EXISTS update_standings(uuid, uuid);
DROP FUNCTION IF EXISTS rebuild_standings(uuid);

-- Update the old standings table to be a view for backward compatibility
DROP TABLE IF EXISTS standings CASCADE;
CREATE VIEW standings AS
SELECT 
  sl.id,
  e.id as competition_id,
  sl.team_id,
  sl.team_name,
  sl.played,
  sl.won,
  sl.drawn,
  sl.lost,
  sl.goals_for,
  sl.goals_against,
  sl.goal_difference,
  sl.points,
  sl.updated_at
FROM standings_league sl
JOIN editions e ON e.id = sl.edition_id
UNION ALL
SELECT 
  scg.id,
  e.id as competition_id,
  scg.team_id,
  scg.team_name,
  scg.played,
  scg.won,
  scg.drawn,
  scg.lost,
  scg.goals_for,
  scg.goals_against,
  scg.goal_difference,
  scg.points,
  scg.updated_at
FROM standings_champions_groups scg
JOIN editions e ON e.id = scg.edition_id;