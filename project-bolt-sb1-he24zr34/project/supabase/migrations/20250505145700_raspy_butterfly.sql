/*
  # Add match report flow schema

  1. New Tables
    - `match_formations` - Store available formations
    - `match_lineups` - Store match lineup details
    - `match_proofs` - Store match proof images and stream links

  2. Changes
    - Add formation and lineup validation to match results
    - Add proof requirements before match approval

  3. Security
    - Enable RLS
    - Add appropriate policies for team captains and admins
*/

-- Create formations enum
CREATE TYPE formation_type AS ENUM (
  '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '5-4-1'
);

-- Create match_lineups table
CREATE TABLE IF NOT EXISTS match_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  formation formation_type NOT NULL,
  player_positions jsonb NOT NULL, -- Stores player IDs and their positions
  created_at timestamptz DEFAULT now(),
  UNIQUE(match_id, team_id)
);

-- Create match_proofs table
CREATE TABLE IF NOT EXISTS match_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  player_list_url text NOT NULL,
  result_url text NOT NULL,
  stats_url text NOT NULL,
  stream_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(match_id, team_id)
);

-- Enable RLS
ALTER TABLE match_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_proofs ENABLE ROW LEVEL SECURITY;

-- Policies for match_lineups
CREATE POLICY "Team captains can manage lineups"
  ON match_lineups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = match_lineups.team_id
      AND teams.captain_id = auth.uid()
    )
  );

CREATE POLICY "Everyone can view lineups"
  ON match_lineups
  FOR SELECT
  USING (true);

-- Policies for match_proofs
CREATE POLICY "Team captains can manage proofs"
  ON match_proofs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = match_proofs.team_id
      AND teams.captain_id = auth.uid()
    )
  );

CREATE POLICY "Everyone can view proofs"
  ON match_proofs
  FOR SELECT
  USING (true);

-- Update match result validation
CREATE OR REPLACE FUNCTION validate_result_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if match is already approved
  IF EXISTS (
    SELECT 1 FROM matches
    WHERE id = NEW.match_id
    AND approved = true
  ) THEN
    RAISE EXCEPTION 'Cannot submit result for an approved match';
  END IF;

  -- Check if team has already submitted a result
  IF EXISTS (
    SELECT 1 FROM match_results
    WHERE match_id = NEW.match_id
    AND team_id = NEW.team_id
  ) THEN
    RAISE EXCEPTION 'Team has already submitted a result for this match';
  END IF;

  -- Check if team is involved in the match
  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE id = NEW.match_id
    AND (home_team_id = NEW.team_id OR away_team_id = NEW.team_id)
  ) THEN
    RAISE EXCEPTION 'Team is not involved in this match';
  END IF;

  -- Check if match date is in the past
  IF EXISTS (
    SELECT 1 FROM matches
    WHERE id = NEW.match_id
    AND scheduled_for > now()
  ) THEN
    RAISE EXCEPTION 'Cannot submit result for future matches';
  END IF;

  -- Check if lineup and proofs exist
  IF NOT EXISTS (
    SELECT 1 FROM match_lineups
    WHERE match_id = NEW.match_id
    AND team_id = NEW.team_id
  ) THEN
    RAISE EXCEPTION 'Must submit lineup before result';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM match_proofs
    WHERE match_id = NEW.match_id
    AND team_id = NEW.team_id
  ) THEN
    RAISE EXCEPTION 'Must submit match proofs before result';
  END IF;

  RETURN NEW;
END;
$$;