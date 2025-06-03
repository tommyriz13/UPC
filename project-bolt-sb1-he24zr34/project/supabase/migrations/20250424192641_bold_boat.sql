/*
  # Improve player statistics and add profile views

  1. Changes
    - Update top scorers/assistmen functions to filter out zero contributions
    - Add function to get player statistics
    - Add function to get player's team info

  2. Security
    - Functions run with security definer
    - Results accessible to all users
*/

-- Update function to get top scorers (only players with goals)
CREATE OR REPLACE FUNCTION get_top_scorers(limit_count integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  username text,
  game_id text,
  total_goals bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.game_id,
    COALESCE(SUM(mps.goals), 0)::bigint as total_goals
  FROM profiles p
  LEFT JOIN match_player_stats mps ON p.id = mps.player_id
  LEFT JOIN matches m ON mps.match_id = m.id
  WHERE (m.approved = true OR m.approved IS NULL)
  GROUP BY p.id, p.username, p.game_id
  HAVING COALESCE(SUM(mps.goals), 0) > 0
  ORDER BY total_goals DESC
  LIMIT limit_count;
$$;

-- Update function to get top assist providers (only players with assists)
CREATE OR REPLACE FUNCTION get_top_assistmen(limit_count integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  username text,
  game_id text,
  total_assists bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.game_id,
    COALESCE(SUM(mps.assists), 0)::bigint as total_assists
  FROM profiles p
  LEFT JOIN match_player_stats mps ON p.id = mps.player_id
  LEFT JOIN matches m ON mps.match_id = m.id
  WHERE (m.approved = true OR m.approved IS NULL)
  GROUP BY p.id, p.username, p.game_id
  HAVING COALESCE(SUM(mps.assists), 0) > 0
  ORDER BY total_assists DESC
  LIMIT limit_count;
$$;

-- Create function to get player statistics
CREATE OR REPLACE FUNCTION get_player_stats(player_id uuid)
RETURNS TABLE (
  total_goals bigint,
  total_assists bigint,
  matches_played bigint,
  team_id uuid,
  team_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(SUM(mps.goals), 0)::bigint as total_goals,
    COALESCE(SUM(mps.assists), 0)::bigint as total_assists,
    COUNT(DISTINCT mps.match_id)::bigint as matches_played,
    t.id as team_id,
    t.name as team_name
  FROM profiles p
  LEFT JOIN match_player_stats mps ON p.id = mps.player_id
  LEFT JOIN matches m ON mps.match_id = m.id
  LEFT JOIN team_members tm ON p.id = tm.user_id
  LEFT JOIN teams t ON tm.team_id = t.id
  WHERE p.id = player_id
  GROUP BY t.id, t.name;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_player_stats(uuid) TO public;