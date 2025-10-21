/*
  # Fix Competition Management System

  1. Clean up and recreate proper competition structure
  2. Fix RLS policies for proper access control
  3. Add missing functions for match management
  4. Ensure proper bracket position handling for Cup competitions
*/

-- Drop existing problematic views and tables
DROP VIEW IF EXISTS standings CASCADE;

-- Ensure editions table exists with proper structure
CREATE TABLE IF NOT EXISTS editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type competition_type NOT NULL,
  status text DEFAULT 'active',
  bracket_slots jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add bracket_position to matches_cup if not exists
ALTER TABLE matches_cup 
ADD COLUMN IF NOT EXISTS bracket_position jsonb;

-- Add match_day to matches_cup if not exists  
ALTER TABLE matches_cup 
ADD COLUMN IF NOT EXISTS match_day integer DEFAULT 1;

-- Ensure proper RLS policies exist
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_cup ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_champions ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_champions_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_cup ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_champions ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to avoid conflicts
DO $$ 
DECLARE
    pol record;
BEGIN
    -- Drop all policies on editions
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'editions' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON editions';
    END LOOP;
    
    -- Drop all policies on matches tables
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'matches_league' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON matches_league';
    END LOOP;
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'matches_cup' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON matches_cup';
    END LOOP;
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'matches_champions' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON matches_champions';
    END LOOP;
    
    -- Drop all policies on standings tables
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'standings_league' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON standings_league';
    END LOOP;
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'standings_champions_groups' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON standings_champions_groups';
    END LOOP;
    
    -- Drop all policies on stats tables
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'stats_league' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON stats_league';
    END LOOP;
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'stats_cup' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON stats_cup';
    END LOOP;
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'stats_champions' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON stats_champions';
    END LOOP;
END $$;

-- Create new policies for editions
CREATE POLICY "editions_select_all" ON editions FOR SELECT USING (true);
CREATE POLICY "editions_admin_all" ON editions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create new policies for matches_league
CREATE POLICY "matches_league_select_all" ON matches_league FOR SELECT USING (true);
CREATE POLICY "matches_league_admin_all" ON matches_league FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create new policies for matches_cup
CREATE POLICY "matches_cup_select_all" ON matches_cup FOR SELECT USING (true);
CREATE POLICY "matches_cup_admin_all" ON matches_cup FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create new policies for matches_champions
CREATE POLICY "matches_champions_select_all" ON matches_champions FOR SELECT USING (true);
CREATE POLICY "matches_champions_admin_all" ON matches_champions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create new policies for standings_league
CREATE POLICY "standings_league_select_all" ON standings_league FOR SELECT USING (true);
CREATE POLICY "standings_league_admin_all" ON standings_league FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create new policies for standings_champions_groups
CREATE POLICY "standings_champions_groups_select_all" ON standings_champions_groups FOR SELECT USING (true);
CREATE POLICY "standings_champions_groups_admin_all" ON standings_champions_groups FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create new policies for stats_league
CREATE POLICY "stats_league_select_all" ON stats_league FOR SELECT USING (true);
CREATE POLICY "stats_league_admin_all" ON stats_league FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create new policies for stats_cup
CREATE POLICY "stats_cup_select_all" ON stats_cup FOR SELECT USING (true);
CREATE POLICY "stats_cup_admin_all" ON stats_cup FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create new policies for stats_champions
CREATE POLICY "stats_champions_select_all" ON stats_champions FOR SELECT USING (true);
CREATE POLICY "stats_champions_admin_all" ON stats_champions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Fix match result submission policies
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on match result tables
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'match_results' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON match_results';
    END LOOP;
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'match_lineups' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON match_lineups';
    END LOOP;
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'match_proofs' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON match_proofs';
    END LOOP;
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'match_player_stats' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON match_player_stats';
    END LOOP;
END $$;

-- Create policies for match_results
CREATE POLICY "match_results_select_all" ON match_results FOR SELECT USING (true);
CREATE POLICY "match_results_captain_insert" ON match_results FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM teams t
    JOIN matches m ON (m.home_team_id = t.id OR m.away_team_id = t.id)
    WHERE m.id = match_id
    AND t.captain_id = auth.uid()
    AND t.id = team_id
  )
);
CREATE POLICY "match_results_admin_all" ON match_results FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create policies for match_lineups
CREATE POLICY "match_lineups_select_all" ON match_lineups FOR SELECT USING (true);
CREATE POLICY "match_lineups_captain_all" ON match_lineups FOR ALL USING (
  EXISTS (
    SELECT 1 FROM teams
    WHERE teams.id = team_id
    AND teams.captain_id = auth.uid()
  )
);

-- Create policies for match_proofs
CREATE POLICY "match_proofs_select_all" ON match_proofs FOR SELECT USING (true);
CREATE POLICY "match_proofs_captain_all" ON match_proofs FOR ALL USING (
  EXISTS (
    SELECT 1 FROM teams
    WHERE teams.id = team_id
    AND teams.captain_id = auth.uid()
  )
);

-- Create policies for match_player_stats
CREATE POLICY "match_player_stats_select_all" ON match_player_stats FOR SELECT USING (true);
CREATE POLICY "match_player_stats_captain_all" ON match_player_stats FOR ALL USING (
  EXISTS (
    SELECT 1 FROM teams
    WHERE teams.id = team_id
    AND teams.captain_id = auth.uid()
  )
);

-- Function to get matches for any competition type
CREATE OR REPLACE FUNCTION get_edition_matches(
  p_edition_id uuid,
  p_edition_type competition_type
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
  CASE p_edition_type
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
      WHERE ml.edition_id = p_edition_id
      ORDER BY ml.match_day, ml.scheduled_for;
      
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
        mc.match_day,
        mc.approved,
        mc.round,
        mc.leg,
        NULL::text as stage,
        NULL::text as group_name,
        mc.bracket_position
      FROM matches_cup mc
      JOIN teams ht ON ht.id = mc.home_team_id
      JOIN teams at ON at.id = mc.away_team_id
      WHERE mc.edition_id = p_edition_id
      ORDER BY mc.round, mc.leg, mc.scheduled_for;
      
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
      WHERE mch.edition_id = p_edition_id
      ORDER BY mch.match_day, mch.scheduled_for;
  END CASE;
END;
$$;

-- Function to update standings after match approval
CREATE OR REPLACE FUNCTION update_edition_standings(
  p_edition_id uuid,
  p_edition_type competition_type,
  p_home_team_id uuid,
  p_away_team_id uuid,
  p_home_score integer,
  p_away_score integer,
  p_group_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_home_team_name text;
  v_away_team_name text;
BEGIN
  -- Get team names
  SELECT name INTO v_home_team_name FROM teams WHERE id = p_home_team_id;
  SELECT name INTO v_away_team_name FROM teams WHERE id = p_away_team_id;

  CASE p_edition_type
    WHEN 'league' THEN
      -- Update home team standings
      INSERT INTO standings_league (
        edition_id, team_id, team_name, played, won, drawn, lost,
        goals_for, goals_against, goal_difference, points
      )
      VALUES (
        p_edition_id, p_home_team_id, v_home_team_name, 1,
        CASE WHEN p_home_score > p_away_score THEN 1 ELSE 0 END,
        CASE WHEN p_home_score = p_away_score THEN 1 ELSE 0 END,
        CASE WHEN p_home_score < p_away_score THEN 1 ELSE 0 END,
        p_home_score, p_away_score, p_home_score - p_away_score,
        CASE WHEN p_home_score > p_away_score THEN 3
             WHEN p_home_score = p_away_score THEN 1 ELSE 0 END
      )
      ON CONFLICT (edition_id, team_id) DO UPDATE SET
        played = standings_league.played + 1,
        won = standings_league.won + CASE WHEN p_home_score > p_away_score THEN 1 ELSE 0 END,
        drawn = standings_league.drawn + CASE WHEN p_home_score = p_away_score THEN 1 ELSE 0 END,
        lost = standings_league.lost + CASE WHEN p_home_score < p_away_score THEN 1 ELSE 0 END,
        goals_for = standings_league.goals_for + p_home_score,
        goals_against = standings_league.goals_against + p_away_score,
        goal_difference = (standings_league.goals_for + p_home_score) - (standings_league.goals_against + p_away_score),
        points = standings_league.points + CASE WHEN p_home_score > p_away_score THEN 3
                                               WHEN p_home_score = p_away_score THEN 1 ELSE 0 END;

      -- Update away team standings
      INSERT INTO standings_league (
        edition_id, team_id, team_name, played, won, drawn, lost,
        goals_for, goals_against, goal_difference, points
      )
      VALUES (
        p_edition_id, p_away_team_id, v_away_team_name, 1,
        CASE WHEN p_away_score > p_home_score THEN 1 ELSE 0 END,
        CASE WHEN p_away_score = p_home_score THEN 1 ELSE 0 END,
        CASE WHEN p_away_score < p_home_score THEN 1 ELSE 0 END,
        p_away_score, p_home_score, p_away_score - p_home_score,
        CASE WHEN p_away_score > p_home_score THEN 3
             WHEN p_away_score = p_home_score THEN 1 ELSE 0 END
      )
      ON CONFLICT (edition_id, team_id) DO UPDATE SET
        played = standings_league.played + 1,
        won = standings_league.won + CASE WHEN p_away_score > p_home_score THEN 1 ELSE 0 END,
        drawn = standings_league.drawn + CASE WHEN p_away_score = p_home_score THEN 1 ELSE 0 END,
        lost = standings_league.lost + CASE WHEN p_away_score < p_home_score THEN 1 ELSE 0 END,
        goals_for = standings_league.goals_for + p_away_score,
        goals_against = standings_league.goals_against + p_home_score,
        goal_difference = (standings_league.goals_for + p_away_score) - (standings_league.goals_against + p_home_score),
        points = standings_league.points + CASE WHEN p_away_score > p_home_score THEN 3
                                               WHEN p_away_score = p_home_score THEN 1 ELSE 0 END;

    WHEN 'champions' THEN
      -- Update home team standings for champions groups
      INSERT INTO standings_champions_groups (
        edition_id, group_name, team_id, team_name, played, won, drawn, lost,
        goals_for, goals_against, goal_difference, points
      )
      VALUES (
        p_edition_id, p_group_name, p_home_team_id, v_home_team_name, 1,
        CASE WHEN p_home_score > p_away_score THEN 1 ELSE 0 END,
        CASE WHEN p_home_score = p_away_score THEN 1 ELSE 0 END,
        CASE WHEN p_home_score < p_away_score THEN 1 ELSE 0 END,
        p_home_score, p_away_score, p_home_score - p_away_score,
        CASE WHEN p_home_score > p_away_score THEN 3
             WHEN p_home_score = p_away_score THEN 1 ELSE 0 END
      )
      ON CONFLICT (edition_id, group_name, team_id) DO UPDATE SET
        played = standings_champions_groups.played + 1,
        won = standings_champions_groups.won + CASE WHEN p_home_score > p_away_score THEN 1 ELSE 0 END,
        drawn = standings_champions_groups.drawn + CASE WHEN p_home_score = p_away_score THEN 1 ELSE 0 END,
        lost = standings_champions_groups.lost + CASE WHEN p_home_score < p_away_score THEN 1 ELSE 0 END,
        goals_for = standings_champions_groups.goals_for + p_home_score,
        goals_against = standings_champions_groups.goals_against + p_away_score,
        goal_difference = (standings_champions_groups.goals_for + p_home_score) - (standings_champions_groups.goals_against + p_away_score),
        points = standings_champions_groups.points + CASE WHEN p_home_score > p_away_score THEN 3
                                                          WHEN p_home_score = p_away_score THEN 1 ELSE 0 END;

      -- Update away team standings for champions groups
      INSERT INTO standings_champions_groups (
        edition_id, group_name, team_id, team_name, played, won, drawn, lost,
        goals_for, goals_against, goal_difference, points
      )
      VALUES (
        p_edition_id, p_group_name, p_away_team_id, v_away_team_name, 1,
        CASE WHEN p_away_score > p_home_score THEN 1 ELSE 0 END,
        CASE WHEN p_away_score = p_home_score THEN 1 ELSE 0 END,
        CASE WHEN p_away_score < p_home_score THEN 1 ELSE 0 END,
        p_away_score, p_home_score, p_away_score - p_home_score,
        CASE WHEN p_away_score > p_home_score THEN 3
             WHEN p_away_score = p_home_score THEN 1 ELSE 0 END
      )
      ON CONFLICT (edition_id, group_name, team_id) DO UPDATE SET
        played = standings_champions_groups.played + 1,
        won = standings_champions_groups.won + CASE WHEN p_away_score > p_home_score THEN 1 ELSE 0 END,
        drawn = standings_champions_groups.drawn + CASE WHEN p_away_score = p_home_score THEN 1 ELSE 0 END,
        lost = standings_champions_groups.lost + CASE WHEN p_away_score < p_home_score THEN 1 ELSE 0 END,
        goals_for = standings_champions_groups.goals_for + p_away_score,
        goals_against = standings_champions_groups.goals_against + p_home_score,
        goal_difference = (standings_champions_groups.goals_for + p_away_score) - (standings_champions_groups.goals_against + p_home_score),
        points = standings_champions_groups.points + CASE WHEN p_away_score > p_home_score THEN 3
                                                          WHEN p_away_score = p_home_score THEN 1 ELSE 0 END;
    -- Cup competitions don't have standings
    ELSE
      NULL;
  END CASE;
END;
$$;

-- Function to handle match result approval and standings update
CREATE OR REPLACE FUNCTION approve_match_result(
  p_match_id uuid,
  p_edition_type competition_type,
  p_home_score integer,
  p_away_score integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_edition_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_group_name text;
BEGIN
  CASE p_edition_type
    WHEN 'league' THEN
      -- Get match details from league table
      SELECT edition_id, home_team_id, away_team_id
      INTO v_edition_id, v_home_team_id, v_away_team_id
      FROM matches_league
      WHERE id = p_match_id;

      -- Update match with scores and approval
      UPDATE matches_league
      SET home_score = p_home_score,
          away_score = p_away_score,
          approved = true,
          status = 'completed'
      WHERE id = p_match_id;

    WHEN 'cup' THEN
      -- Get match details from cup table
      SELECT edition_id, home_team_id, away_team_id
      INTO v_edition_id, v_home_team_id, v_away_team_id
      FROM matches_cup
      WHERE id = p_match_id;

      -- Update match with scores and approval
      UPDATE matches_cup
      SET home_score = p_home_score,
          away_score = p_away_score,
          approved = true,
          status = 'completed'
      WHERE id = p_match_id;

    WHEN 'champions' THEN
      -- Get match details from champions table
      SELECT edition_id, home_team_id, away_team_id, group_name
      INTO v_edition_id, v_home_team_id, v_away_team_id, v_group_name
      FROM matches_champions
      WHERE id = p_match_id;

      -- Update match with scores and approval
      UPDATE matches_champions
      SET home_score = p_home_score,
          away_score = p_away_score,
          approved = true,
          status = 'completed'
      WHERE id = p_match_id;
  END CASE;

  -- Update standings
  PERFORM update_edition_standings(
    v_edition_id,
    p_edition_type,
    v_home_team_id,
    v_away_team_id,
    p_home_score,
    p_away_score,
    v_group_name
  );
END;
$$;

-- Create view for backward compatibility
CREATE VIEW standings AS
SELECT 
  id,
  edition_id as competition_id,
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
FROM standings_league
UNION ALL
SELECT 
  id,
  edition_id as competition_id,
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
FROM standings_champions_groups;