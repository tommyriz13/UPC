/*
  # Add competition types and formats

  1. Changes
    - Add competition_type enum
    - Add competition_format table for storing format-specific settings
    - Add competition_stages table for knockout stages
    - Add competition_matches table for advanced match scheduling
    - Update competitions table with new fields

  2. Security
    - Maintain existing RLS policies
    - Add new policies for format management
*/

-- Create competition type enum
CREATE TYPE competition_type AS ENUM ('league', 'champions', 'cup');

-- Add type column to competitions
ALTER TABLE competitions
ADD COLUMN IF NOT EXISTS type competition_type DEFAULT 'league';

-- Create competition_format table
CREATE TABLE IF NOT EXISTS competition_format (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create competition_stages table
CREATE TABLE IF NOT EXISTS competition_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL, -- 'group', 'playoff', 'knockout'
  round integer NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create competition_matches table
CREATE TABLE IF NOT EXISTS competition_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES competition_stages(id) ON DELETE CASCADE,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  round integer NOT NULL,
  leg integer DEFAULT 1,
  bracket_position jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE competition_format ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_matches ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Competition format viewable by everyone"
  ON competition_format FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify competition format"
  ON competition_format FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Competition stages viewable by everyone"
  ON competition_stages FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify competition stages"
  ON competition_stages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Competition matches viewable by everyone"
  ON competition_matches FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify competition matches"
  ON competition_matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add functions for competition management
CREATE OR REPLACE FUNCTION generate_swiss_matches(
  competition_id uuid,
  stage_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  team_ids uuid[];
  total_teams integer;
  matches_per_team integer := 6;
  current_round integer := 1;
  team1_idx integer;
  team2_idx integer;
  team1_id uuid;
  team2_id uuid;
  match_id uuid;
  played_pairs text[];
BEGIN
  -- Get participating teams
  SELECT array_agg(team_id)
  INTO team_ids
  FROM competition_teams
  WHERE competition_teams.competition_id = generate_swiss_matches.competition_id;

  total_teams := array_length(team_ids, 1);

  -- Validate team count
  IF total_teams != 16 THEN
    RAISE EXCEPTION 'Swiss format requires exactly 16 teams';
  END IF;

  -- Generate matches for each round
  WHILE current_round <= matches_per_team LOOP
    -- Shuffle teams for random pairing
    team_ids := array(
      SELECT team_ids[i]
      FROM generate_series(1, array_length(team_ids, 1)) i
      ORDER BY random()
    );

    -- Create matches ensuring no team plays twice in a round
    FOR i IN 1..total_teams/2 LOOP
      team1_id := team_ids[2*i-1];
      team2_id := team_ids[2*i];

      -- Create match
      INSERT INTO matches (
        competition_id,
        home_team_id,
        away_team_id,
        match_day,
        scheduled_for,
        status
      )
      VALUES (
        competition_id,
        team1_id,
        team2_id,
        current_round,
        now() + (current_round || ' days')::interval,
        'scheduled'
      )
      RETURNING id INTO match_id;

      -- Link match to stage
      INSERT INTO competition_matches (
        competition_id,
        stage_id,
        match_id,
        round,
        leg
      )
      VALUES (
        competition_id,
        stage_id,
        match_id,
        current_round,
        1
      );
    END LOOP;

    current_round := current_round + 1;
  END LOOP;
END;
$$;

-- Function to generate knockout matches
CREATE OR REPLACE FUNCTION generate_knockout_matches(
  competition_id uuid,
  stage_id uuid,
  num_teams integer,
  legs integer DEFAULT 2
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  team_ids uuid[];
  total_teams integer;
  matches_in_round integer;
  current_round integer := 1;
  match_id uuid;
BEGIN
  -- Get participating teams
  SELECT array_agg(team_id)
  INTO team_ids
  FROM competition_teams
  WHERE competition_teams.competition_id = generate_knockout_matches.competition_id;

  total_teams := array_length(team_ids, 1);

  -- Validate team count
  IF total_teams != num_teams THEN
    RAISE EXCEPTION 'Invalid number of teams for knockout stage';
  END IF;

  -- Shuffle teams for random pairing
  team_ids := array(
    SELECT team_ids[i]
    FROM generate_series(1, array_length(team_ids, 1)) i
    ORDER BY random()
  );

  matches_in_round := total_teams / 2;

  -- Create matches
  FOR i IN 1..matches_in_round LOOP
    -- First leg
    INSERT INTO matches (
      competition_id,
      home_team_id,
      away_team_id,
      match_day,
      scheduled_for,
      status
    )
    VALUES (
      competition_id,
      team_ids[2*i-1],
      team_ids[2*i],
      current_round,
      now() + (current_round || ' days')::interval,
      'scheduled'
    )
    RETURNING id INTO match_id;

    -- Link match to stage
    INSERT INTO competition_matches (
      competition_id,
      stage_id,
      match_id,
      round,
      leg,
      bracket_position
    )
    VALUES (
      competition_id,
      stage_id,
      match_id,
      current_round,
      1,
      jsonb_build_object(
        'match_number', i,
        'round', current_round
      )
    );

    -- Second leg if needed
    IF legs = 2 THEN
      INSERT INTO matches (
        competition_id,
        home_team_id,
        away_team_id,
        match_day,
        scheduled_for,
        status
      )
      VALUES (
        competition_id,
        team_ids[2*i],
        team_ids[2*i-1],
        current_round,
        now() + ((current_round + 1) || ' days')::interval,
        'scheduled'
      )
      RETURNING id INTO match_id;

      -- Link match to stage
      INSERT INTO competition_matches (
        competition_id,
        stage_id,
        match_id,
        round,
        leg,
        bracket_position
      )
      VALUES (
        competition_id,
        stage_id,
        match_id,
        current_round,
        2,
        jsonb_build_object(
          'match_number', i,
          'round', current_round
        )
      );
    END IF;
  END LOOP;
END;
$$;