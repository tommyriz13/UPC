/*
  # Fix leaderboard aggregation

  1. Changes
    - Add functions to calculate player statistics
    - Create secure functions for top scorers and assistmen
    - Maintain security with proper permissions

  2. Security
    - Functions run with security definer
    - Results accessible to all authenticated users
*/

-- Create function to get top scorers
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
  WHERE m.approved = true OR m.approved IS NULL
  GROUP BY p.id, p.username, p.game_id
  ORDER BY total_goals DESC
  LIMIT limit_count;
$$;

-- Create function to get top assist providers
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
  WHERE m.approved = true OR m.approved IS NULL
  GROUP BY p.id, p.username, p.game_id
  ORDER BY total_assists DESC
  LIMIT limit_count;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_top_scorers(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_assistmen(integer) TO authenticated;