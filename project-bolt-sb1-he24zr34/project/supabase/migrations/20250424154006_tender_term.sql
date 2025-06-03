/*
  # Update team policies to allow captain updates

  1. Changes
    - Drop existing team policies
    - Add new policies that allow:
      - Everyone to view teams
      - Admins to manage all teams
      - Team captains to update their own teams

  2. Security
    - Maintains secure access control while allowing captain updates
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Teams are viewable by everyone" ON teams;
DROP POLICY IF EXISTS "Only admins can modify teams" ON teams;

-- Create new policies
CREATE POLICY "Teams are viewable by everyone"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "Team captains can update their own teams"
  ON teams FOR UPDATE
  USING (captain_id = auth.uid());

CREATE POLICY "Admins can manage all teams"
  ON teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );