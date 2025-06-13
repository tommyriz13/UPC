/*
  # Create new editions system with proper competition management

  1. New Tables
    - `editions`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `type` (competition_type, not null)
      - `status` (text, default 'active')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `matches_league`
      - `id` (uuid, primary key)
      - `edition_id` (uuid, references editions)
      - `home_team_id` (uuid, references teams)
      - `away_team_id` (uuid, references teams)
      - `home_score` (integer)
      - `away_score` (integer)
      - `match_day` (integer)
      - `scheduled_for` (timestamptz)
      - `status` (match_status)
      - `approved` (boolean)

    - `matches_cup`
      - Similar to matches_league but with round and leg fields

    - `matches_champions`
      - Similar to matches_league but with stage and group_name fields

    - `standings_league`
      - Team standings for league competitions

    - `standings_champions_groups`
      - Team standings for champions league groups

    - `stats_league`, `stats_cup`, `stats_champions`
      - Player statistics for each competition type

  2. Security
    - Enable RLS on all tables
    - Add policies for appropriate access control
*/

-- Drop existing standings view if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'standings') THEN
    DROP VIEW standings;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'standings') THEN
    DROP TABLE standings;
  END IF;
END $$;

-- Create editions table
CREATE TABLE IF NOT EXISTS editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type competition_type NOT NULL,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create matches_league table
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

-- Create matches_cup table
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
  updated_at timestamptz DEFAULT now()
);

-- Create matches_champions table
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

-- Create standings_league table
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

-- Create standings_champions_groups table
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

-- Create stats_league table
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

-- Create stats_cup table
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

-- Create stats_champions table
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

-- Enable RLS
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_cup ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_champions ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_champions_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_cup ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_champions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist before creating new ones
DROP POLICY IF EXISTS "Editions are viewable by everyone" ON editions;
DROP POLICY IF EXISTS "Only admins can modify editions" ON editions;

-- Policies for editions
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

-- Drop existing policies for matches tables if they exist
DROP POLICY IF EXISTS "Viewable by everyone" ON matches_league;
DROP POLICY IF EXISTS "Only admins can modify" ON matches_league;
DROP POLICY IF EXISTS "Viewable by everyone" ON matches_cup;
DROP POLICY IF EXISTS "Only admins can modify" ON matches_cup;
DROP POLICY IF EXISTS "Viewable by everyone" ON matches_champions;
DROP POLICY IF EXISTS "Only admins can modify" ON matches_champions;

-- Policies for matches_league
CREATE POLICY "Viewable by everyone"
  ON matches_league FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify"
  ON matches_league FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for matches_cup
CREATE POLICY "Viewable by everyone"
  ON matches_cup FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify"
  ON matches_cup FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for matches_champions
CREATE POLICY "Viewable by everyone"
  ON matches_champions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify"
  ON matches_champions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Drop existing policies for standings tables if they exist
DROP POLICY IF EXISTS "Viewable by everyone" ON standings_league;
DROP POLICY IF EXISTS "Only admins can modify" ON standings_league;
DROP POLICY IF EXISTS "Viewable by everyone" ON standings_champions_groups;
DROP POLICY IF EXISTS "Only admins can modify" ON standings_champions_groups;

-- Policies for standings_league
CREATE POLICY "Viewable by everyone"
  ON standings_league FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify"
  ON standings_league FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for standings_champions_groups
CREATE POLICY "Viewable by everyone"
  ON standings_champions_groups FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify"
  ON standings_champions_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Drop existing policies for stats tables if they exist
DROP POLICY IF EXISTS "Viewable by everyone" ON stats_league;
DROP POLICY IF EXISTS "Only admins can modify" ON stats_league;
DROP POLICY IF EXISTS "Viewable by everyone" ON stats_cup;
DROP POLICY IF EXISTS "Only admins can modify" ON stats_cup;
DROP POLICY IF EXISTS "Viewable by everyone" ON stats_champions;
DROP POLICY IF EXISTS "Only admins can modify" ON stats_champions;

-- Policies for stats_league
CREATE POLICY "Viewable by everyone"
  ON stats_league FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify"
  ON stats_league FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for stats_cup
CREATE POLICY "Viewable by everyone"
  ON stats_cup FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify"
  ON stats_cup FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for stats_champions
CREATE POLICY "Viewable by everyone"
  ON stats_champions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify"
  ON stats_champions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_matches_league_edition ON matches_league(edition_id);
CREATE INDEX IF NOT EXISTS idx_matches_cup_edition ON matches_cup(edition_id);
CREATE INDEX IF NOT EXISTS idx_matches_champions_edition ON matches_champions(edition_id);
CREATE INDEX IF NOT EXISTS idx_standings_league_edition ON standings_league(edition_id);
CREATE INDEX IF NOT EXISTS idx_standings_champions_edition ON standings_champions_groups(edition_id);
CREATE INDEX IF NOT EXISTS idx_stats_league_edition ON stats_league(edition_id);
CREATE INDEX IF NOT EXISTS idx_stats_cup_edition ON stats_cup(edition_id);
CREATE INDEX IF NOT EXISTS idx_stats_champions_edition ON stats_champions(edition_id);

-- Create a view that combines all standings for backward compatibility
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