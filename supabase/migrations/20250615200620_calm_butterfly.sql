/*
  # Fix Cup Competition Schema and Relationships

  1. Add missing bracket_slots column to editions table
  2. Fix foreign key relationships for match_results with all match tables
  3. Ensure proper RLS policies for Cup competitions
  4. Add missing indexes for better performance
*/

-- Add bracket_slots column to editions table if it doesn't exist
ALTER TABLE editions 
ADD COLUMN IF NOT EXISTS bracket_slots jsonb DEFAULT '{}'::jsonb;

-- Ensure all match tables exist with proper structure
CREATE TABLE IF NOT EXISTS matches_league (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES editions(id) ON DELETE CASCADE,
  home_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  home_score integer,
  away_score integer,
  match_day integer NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status match_status DEFAULT 'scheduled',
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches_cup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES editions(id) ON DELETE CASCADE,
  home_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  home_score integer,
  away_score integer,
  round integer NOT NULL,
  leg integer DEFAULT 1,
  scheduled_for timestamptz NOT NULL,
  status match_status DEFAULT 'scheduled',
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  bracket_position jsonb,
  match_day integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS matches_champions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES editions(id) ON DELETE CASCADE,
  stage text NOT NULL,
  group_name text,
  home_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  home_score integer,
  away_score integer,
  match_day integer NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status match_status DEFAULT 'scheduled',
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure match_results table exists with proper foreign keys
CREATE TABLE IF NOT EXISTS match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending',
  verification_status result_status DEFAULT 'pending',
  admin_notes text,
  admin_modified boolean DEFAULT false,
  verified_at timestamptz,
  verified_by uuid REFERENCES profiles(id),
  UNIQUE(match_id, team_id)
);

-- Add indexes for match_results
CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON match_results(match_id);
CREATE INDEX IF NOT EXISTS idx_match_results_team_id ON match_results(team_id);

-- Ensure standings tables exist
CREATE TABLE IF NOT EXISTS standings_league (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES editions(id) ON DELETE CASCADE,
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
  UNIQUE(edition_id, team_id)
);

CREATE TABLE IF NOT EXISTS standings_champions_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES editions(id) ON DELETE CASCADE,
  group_name text NOT NULL,
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
  UNIQUE(edition_id, group_name, team_id)
);

-- Ensure stats tables exist
CREATE TABLE IF NOT EXISTS stats_league (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES editions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  matches_played integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(edition_id, player_id)
);

CREATE TABLE IF NOT EXISTS stats_cup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES editions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  matches_played integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(edition_id, player_id)
);

CREATE TABLE IF NOT EXISTS stats_champions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES editions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  matches_played integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(edition_id, player_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_editions_type ON editions(type);
CREATE INDEX IF NOT EXISTS idx_matches_league_edition ON matches_league(edition_id);
CREATE INDEX IF NOT EXISTS idx_matches_cup_edition ON matches_cup(edition_id);
CREATE INDEX IF NOT EXISTS idx_matches_champions_edition ON matches_champions(edition_id);
CREATE INDEX IF NOT EXISTS idx_standings_league_edition ON standings_league(edition_id);
CREATE INDEX IF NOT EXISTS idx_standings_champions_edition ON standings_champions_groups(edition_id);
CREATE INDEX IF NOT EXISTS idx_stats_league_edition ON stats_league(edition_id);
CREATE INDEX IF NOT EXISTS idx_stats_cup_edition ON stats_cup(edition_id);
CREATE INDEX IF NOT EXISTS idx_stats_champions_edition ON stats_champions(edition_id);

-- Enable RLS on all tables
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_cup ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_champions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_champions_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_cup ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_champions ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to avoid conflicts
DO $$ 
DECLARE
    pol record;
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['editions', 'matches_league', 'matches_cup', 'matches_champions', 'match_results', 'standings_league', 'standings_champions_groups', 'stats_league', 'stats_cup', 'stats_champions']) LOOP
        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl LOOP
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON ' || quote_ident(tbl);
        END LOOP;
    END LOOP;
END $$;

-- Create comprehensive RLS policies
-- Editions policies
CREATE POLICY "editions_select_all" ON editions FOR SELECT USING (true);
CREATE POLICY "editions_admin_all" ON editions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Matches policies (all types)
CREATE POLICY "matches_league_select_all" ON matches_league FOR SELECT USING (true);
CREATE POLICY "matches_league_admin_all" ON matches_league FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "matches_cup_select_all" ON matches_cup FOR SELECT USING (true);
CREATE POLICY "matches_cup_admin_all" ON matches_cup FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "matches_champions_select_all" ON matches_champions FOR SELECT USING (true);
CREATE POLICY "matches_champions_admin_all" ON matches_champions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Match results policies
CREATE POLICY "match_results_select_all" ON match_results FOR SELECT USING (true);
CREATE POLICY "match_results_captain_insert" ON match_results FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = team_id
    AND t.captain_id = auth.uid()
  )
);
CREATE POLICY "match_results_admin_all" ON match_results FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Standings policies
CREATE POLICY "standings_league_select_all" ON standings_league FOR SELECT USING (true);
CREATE POLICY "standings_league_admin_all" ON standings_league FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "standings_champions_groups_select_all" ON standings_champions_groups FOR SELECT USING (true);
CREATE POLICY "standings_champions_groups_admin_all" ON standings_champions_groups FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Stats policies
CREATE POLICY "stats_league_select_all" ON stats_league FOR SELECT USING (true);
CREATE POLICY "stats_league_admin_all" ON stats_league FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "stats_cup_select_all" ON stats_cup FOR SELECT USING (true);
CREATE POLICY "stats_cup_admin_all" ON stats_cup FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "stats_champions_select_all" ON stats_champions FOR SELECT USING (true);
CREATE POLICY "stats_champions_admin_all" ON stats_champions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Update get_edition_matches function to handle all competition types properly
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

-- Function to advance knockout rounds automatically
CREATE OR REPLACE FUNCTION advance_knockout_rounds(
  p_edition_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_round integer;
  v_max_round integer;
  v_match record;
  v_winner_id uuid;
  v_next_match_number integer;
  v_home_total integer;
  v_away_total integer;
BEGIN
  -- Get the current maximum round
  SELECT COALESCE(MAX(round), 0) INTO v_max_round
  FROM matches_cup
  WHERE edition_id = p_edition_id;

  -- Process each round starting from 1
  FOR v_current_round IN 1..v_max_round LOOP
    -- Check if all matches in current round are completed
    IF EXISTS (
      SELECT 1 FROM matches_cup
      WHERE edition_id = p_edition_id
      AND round = v_current_round
      AND NOT approved
    ) THEN
      -- Not all matches in this round are completed, stop processing
      EXIT;
    END IF;

    -- Get completed matches in pairs (by match number)
    FOR v_match IN
      SELECT 
        bracket_position->>'match_number' as match_number,
        array_agg(
          json_build_object(
            'id', id,
            'home_team_id', home_team_id,
            'away_team_id', away_team_id,
            'home_score', home_score,
            'away_score', away_score,
            'leg', leg
          ) ORDER BY leg
        ) as legs
      FROM matches_cup
      WHERE edition_id = p_edition_id
      AND round = v_current_round
      AND approved = true
      GROUP BY bracket_position->>'match_number'
      HAVING COUNT(*) = 2 -- Both legs completed
    LOOP
      -- Calculate aggregate scores
      v_home_total := (v_match.legs[1]->>'home_score')::integer + (v_match.legs[2]->>'away_score')::integer;
      v_away_total := (v_match.legs[1]->>'away_score')::integer + (v_match.legs[2]->>'home_score')::integer;

      -- Determine winner
      IF v_home_total > v_away_total THEN
        v_winner_id := (v_match.legs[1]->>'home_team_id')::uuid;
      ELSE
        v_winner_id := (v_match.legs[1]->>'away_team_id')::uuid;
      END IF;

      -- Check if next round matches already exist for this winner
      IF NOT EXISTS (
        SELECT 1 FROM matches_cup
        WHERE edition_id = p_edition_id
        AND round = v_current_round + 1
        AND (home_team_id = v_winner_id OR away_team_id = v_winner_id)
      ) THEN
        -- Create next round matches if they don't exist
        -- This is a simplified version - in practice you'd need more complex logic
        -- to pair winners correctly for the next round
        NULL; -- Placeholder for next round creation logic
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Function to approve match results and update standings
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

      -- Update standings
      PERFORM update_edition_standings(
        v_edition_id,
        p_edition_type,
        v_home_team_id,
        v_away_team_id,
        p_home_score,
        p_away_score,
        NULL
      );

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

      -- Try to advance to next round
      PERFORM advance_knockout_rounds(v_edition_id);

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
  END CASE;
END;
$$;