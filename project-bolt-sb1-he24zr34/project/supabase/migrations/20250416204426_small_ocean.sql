/*
  # Update team members RLS policies

  1. Changes
    - Drop existing RLS policies for team_members table
    - Add new policies that allow:
      - Users to join teams
      - Team captains and admins to manage members
      - Everyone to view team members

  2. Security
    - Maintains secure access control while allowing team joining
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Team members are viewable by everyone" ON team_members;
DROP POLICY IF EXISTS "Only team captains and admins can modify team members" ON team_members;

-- Create new policies
CREATE POLICY "Team members are viewable by everyone"
  ON team_members FOR SELECT
  USING (true);

CREATE POLICY "Users can join teams"
  ON team_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Team captains and admins can manage members"
  ON team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND (
        teams.captain_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );