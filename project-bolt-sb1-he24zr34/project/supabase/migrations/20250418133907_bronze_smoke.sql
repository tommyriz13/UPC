/*
  # Add competitions management schema

  1. New Tables
    - `competitions`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `image_url` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `competition_teams`
      - `competition_id` (uuid, references competitions)
      - `team_id` (uuid, references teams)
      - `points` (integer, default 0)
      - `matches_played` (integer, default 0)
      - `wins` (integer, default 0)
      - `draws` (integer, default 0)
      - `losses` (integer, default 0)
      - `goals_for` (integer, default 0)
      - `goals_against` (integer, default 0)
      - `joined_at` (timestamptz)

    - `matches`
      - `id` (uuid, primary key)
      - `competition_id` (uuid, references competitions)
      - `home_team_id` (uuid, references teams)
      - `away_team_id` (uuid, references teams)
      - `home_score` (integer, nullable)
      - `away_score` (integer, nullable)
      - `match_day` (integer, not null)
      - `scheduled_for` (timestamptz, not null)
      - `status` (match_status, default 'scheduled')

    - `match_stats`
      - `id` (uuid, primary key)
      - `match_id` (uuid, references matches)
      - `player_id` (uuid, references profiles)
      - `goals` (integer, default 0)
      - `assists` (integer, default 0)

  2. Security
    - Enable RLS on all tables
    - Add policies for appropriate access control
*/

-- Create match status enum
CREATE TYPE match_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Create competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create competition_teams table
CREATE TABLE IF NOT EXISTS competition_teams (
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  points integer DEFAULT 0,
  matches_played integer DEFAULT 0,
  wins integer DEFAULT 0,
  draws integer DEFAULT 0,
  losses integer DEFAULT 0,
  goals_for integer DEFAULT 0,
  goals_against integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (competition_id, team_id)
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  home_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  home_score integer,
  away_score integer,
  match_day integer NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status match_status DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create match_stats table
CREATE TABLE IF NOT EXISTS match_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_stats ENABLE ROW LEVEL SECURITY;

-- Policies for competitions
CREATE POLICY "Competitions are viewable by everyone"
  ON competitions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify competitions"
  ON competitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for competition_teams
CREATE POLICY "Competition teams are viewable by everyone"
  ON competition_teams FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify competition teams"
  ON competition_teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for matches
CREATE POLICY "Matches are viewable by everyone"
  ON matches FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify matches"
  ON matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for match_stats
CREATE POLICY "Match stats are viewable by everyone"
  ON match_stats FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify match stats"
  ON match_stats FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );