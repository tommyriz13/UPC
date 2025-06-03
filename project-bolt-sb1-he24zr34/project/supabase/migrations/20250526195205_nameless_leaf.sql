/*
  # Fix numeric types for match statistics

  1. Changes
    - Update column types in matches table
    - Update column types in match_results table
    - Update column types in match_player_stats table
    - Update column types in standings table

  2. Security
    - Maintains existing RLS policies
*/

-- Update matches table
ALTER TABLE matches
ALTER COLUMN home_score TYPE bigint USING home_score::bigint,
ALTER COLUMN away_score TYPE bigint USING away_score::bigint;

-- Update match_results table
ALTER TABLE match_results
ALTER COLUMN home_score TYPE bigint USING home_score::bigint,
ALTER COLUMN away_score TYPE bigint USING away_score::bigint;

-- Update match_player_stats table
ALTER TABLE match_player_stats
ALTER COLUMN goals TYPE bigint USING goals::bigint,
ALTER COLUMN assists TYPE bigint USING assists::bigint;

-- Update standings table
ALTER TABLE standings
ALTER COLUMN played TYPE bigint USING played::bigint,
ALTER COLUMN won TYPE bigint USING won::bigint,
ALTER COLUMN drawn TYPE bigint USING drawn::bigint,
ALTER COLUMN lost TYPE bigint USING lost::bigint,
ALTER COLUMN goals_for TYPE bigint USING goals_for::bigint,
ALTER COLUMN goals_against TYPE bigint USING goals_against::bigint,
ALTER COLUMN goal_difference TYPE bigint USING goal_difference::bigint,
ALTER COLUMN points TYPE bigint USING points::bigint;

-- Update competition_teams table
ALTER TABLE competition_teams
ALTER COLUMN points TYPE bigint USING points::bigint,
ALTER COLUMN matches_played TYPE bigint USING matches_played::bigint,
ALTER COLUMN wins TYPE bigint USING wins::bigint,
ALTER COLUMN draws TYPE bigint USING draws::bigint,
ALTER COLUMN losses TYPE bigint USING losses::bigint,
ALTER COLUMN goals_for TYPE bigint USING goals_for::bigint,
ALTER COLUMN goals_against TYPE bigint USING goals_against::bigint;