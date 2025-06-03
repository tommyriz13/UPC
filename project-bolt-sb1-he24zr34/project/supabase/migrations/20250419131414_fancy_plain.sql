/*
  # Add match results and validation schema

  1. New Tables
    - `match_results`
      - `id` (uuid, primary key)
      - `match_id` (uuid, references matches)
      - `team_id` (uuid, references teams)
      - `submitted_by` (uuid, references profiles)
      - `home_score` (integer)
      - `away_score` (integer)
      - `created_at` (timestamptz)
      - `status` (text, default 'pending')

    - `match_player_stats`
      - `id` (uuid, primary key) 
      - `match_id` (uuid, references matches)
      - `player_id` (uuid, references profiles)
      - `team_id` (uuid, references teams)
      - `goals` (integer, default 0)
      - `assists` (integer, default 0)
      - `submitted_by` (uuid, references profiles)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for team captains to submit results
    - Add policies for admins to manage results
*/

-- Create match_results table
CREATE TABLE IF NOT EXISTS match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending',
  UNIQUE(match_id, team_id)
);

-- Create match_player_stats table
CREATE TABLE IF NOT EXISTS match_player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  submitted_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(match_id, player_id)
);

-- Enable RLS
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;

-- Policies for match_results
CREATE POLICY "Team captains can submit match results"
  ON match_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = match_results.team_id
      AND teams.captain_id = auth.uid()
    )
  );

CREATE POLICY "Team captains can view their submitted results"
  ON match_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = match_results.team_id
      AND teams.captain_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for match_player_stats
CREATE POLICY "Team captains can submit player stats"
  ON match_player_stats FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = match_player_stats.team_id
      AND teams.captain_id = auth.uid()
    )
  );

CREATE POLICY "Team captains can view their team's player stats"
  ON match_player_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = match_player_stats.team_id
      AND teams.captain_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add helper function to check if a match can be updated
CREATE OR REPLACE FUNCTION can_submit_match_result(match_id uuid, team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM matches m
    JOIN teams t ON (t.id = team_id AND (t.id = m.home_team_id OR t.id = m.away_team_id))
    WHERE m.id = match_id
    AND m.scheduled_for <= now()
    AND t.captain_id = auth.uid()
  );
END;
$$;