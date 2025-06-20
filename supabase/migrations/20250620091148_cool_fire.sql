/*
  # Fix Foreign Key Constraints for Competition-Specific Match Tables

  1. Problem: Shared tables (match_lineups, match_proofs, etc.) reference a single 'matches' table
  2. Solution: Update foreign key constraints to work with competition-specific tables
  3. Create a unified view or use check constraints to validate match_id across all tables
*/

-- First, drop existing foreign key constraints that reference the old 'matches' table
ALTER TABLE match_lineups DROP CONSTRAINT IF EXISTS match_lineups_match_id_fkey;
ALTER TABLE match_proofs DROP CONSTRAINT IF EXISTS match_proofs_match_id_fkey;
ALTER TABLE match_player_stats DROP CONSTRAINT IF EXISTS match_player_stats_match_id_fkey;
ALTER TABLE match_results DROP CONSTRAINT IF EXISTS match_results_match_id_fkey;
ALTER TABLE match_chats DROP CONSTRAINT IF EXISTS match_chats_match_id_fkey;
ALTER TABLE match_stats DROP CONSTRAINT IF EXISTS match_stats_match_id_fkey;

-- Create a function to validate match_id exists in any of the competition tables
CREATE OR REPLACE FUNCTION validate_match_id(match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if match_id exists in any of the competition-specific tables
  RETURN EXISTS (
    SELECT 1 FROM matches_league WHERE id = match_id
    UNION ALL
    SELECT 1 FROM matches_cup WHERE id = match_id
    UNION ALL
    SELECT 1 FROM matches_champions WHERE id = match_id
  );
END;
$$;

-- Add check constraints instead of foreign keys to validate match_id
ALTER TABLE match_lineups 
ADD CONSTRAINT match_lineups_valid_match_id 
CHECK (validate_match_id(match_id));

ALTER TABLE match_proofs 
ADD CONSTRAINT match_proofs_valid_match_id 
CHECK (validate_match_id(match_id));

ALTER TABLE match_player_stats 
ADD CONSTRAINT match_player_stats_valid_match_id 
CHECK (validate_match_id(match_id));

ALTER TABLE match_results 
ADD CONSTRAINT match_results_valid_match_id 
CHECK (validate_match_id(match_id));

-- Only add constraints for tables that exist
DO $$
BEGIN
  -- Check if match_chats table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_chats') THEN
    ALTER TABLE match_chats 
    ADD CONSTRAINT match_chats_valid_match_id 
    CHECK (validate_match_id(match_id));
  END IF;

  -- Check if match_stats table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_stats') THEN
    ALTER TABLE match_stats 
    ADD CONSTRAINT match_stats_valid_match_id 
    CHECK (validate_match_id(match_id));
  END IF;
END $$;

-- Create a unified view for all matches across competitions
CREATE OR REPLACE VIEW all_matches AS
SELECT 
  id,
  edition_id,
  home_team_id,
  away_team_id,
  home_score,
  away_score,
  scheduled_for,
  match_day,
  approved,
  status,
  created_at,
  updated_at,
  'league' as competition_type,
  NULL::integer as round,
  NULL::integer as leg,
  NULL::text as stage,
  NULL::text as group_name,
  NULL::jsonb as bracket_position
FROM matches_league

UNION ALL

SELECT 
  id,
  edition_id,
  home_team_id,
  away_team_id,
  home_score,
  away_score,
  scheduled_for,
  match_day,
  approved,
  status,
  created_at,
  updated_at,
  'cup' as competition_type,
  round,
  leg,
  NULL::text as stage,
  NULL::text as group_name,
  bracket_position
FROM matches_cup

UNION ALL

SELECT 
  id,
  edition_id,
  home_team_id,
  away_team_id,
  home_score,
  away_score,
  scheduled_for,
  match_day,
  approved,
  status,
  created_at,
  updated_at,
  'champions' as competition_type,
  NULL::integer as round,
  NULL::integer as leg,
  stage,
  group_name,
  NULL::jsonb as bracket_position
FROM matches_champions;

-- Create a function to get match details regardless of competition type
CREATE OR REPLACE FUNCTION get_match_details(p_match_id uuid)
RETURNS TABLE (
  id uuid,
  edition_id uuid,
  home_team_id uuid,
  away_team_id uuid,
  home_score integer,
  away_score integer,
  scheduled_for timestamptz,
  match_day integer,
  approved boolean,
  status match_status,
  competition_type text,
  round integer,
  leg integer,
  stage text,
  group_name text,
  bracket_position jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM all_matches WHERE all_matches.id = p_match_id;
END;
$$;

-- Update the approve_match_result function to work with the new structure
CREATE OR REPLACE FUNCTION approve_match_result(
  p_match_id uuid,
  p_edition_type competition_type,
  p_home_score integer,
  p_away_score integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_edition_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_group_name text;
BEGIN
  CASE p_edition_type
    WHEN 'league' THEN
      -- Get match details from league table
      SELECT edition_id, home_team_id, away_team_id
      INTO v_edition_id, v_home_team_id, v_away_team_id
      FROM matches_league
      WHERE id = p_match_id;

      -- Update match with scores and approval
      UPDATE matches_league
      SET home_score = p_home_score,
          away_score = p_away_score,
          approved = true,
          status = 'completed'
      WHERE id = p_match_id;

      -- Update standings
      PERFORM update_edition_standings(
        v_edition_id,
        p_edition_type,
        v_home_team_id,
        v_away_team_id,
        p_home_score,
        p_away_score,
        NULL
      );

    WHEN 'cup' THEN
      -- Get match details from cup table
      SELECT edition_id, home_team_id, away_team_id
      INTO v_edition_id, v_home_team_id, v_away_team_id
      FROM matches_cup
      WHERE id = p_match_id;

      -- Update match with scores and approval
      UPDATE matches_cup
      SET home_score = p_home_score,
          away_score = p_away_score,
          approved = true,
          status = 'completed'
      WHERE id = p_match_id;

    WHEN 'champions' THEN
      -- Get match details from champions table
      SELECT edition_id, home_team_id, away_team_id, group_name
      INTO v_edition_id, v_home_team_id, v_away_team_id, v_group_name
      FROM matches_champions
      WHERE id = p_match_id;

      -- Update match with scores and approval
      UPDATE matches_champions
      SET home_score = p_home_score,
          away_score = p_away_score,
          approved = true,
          status = 'completed'
      WHERE id = p_match_id;

      -- Update standings
      PERFORM update_edition_standings(
        v_edition_id,
        p_edition_type,
        v_home_team_id,
        v_away_team_id,
        p_home_score,
        p_away_score,
        v_group_name
      );
  END CASE;
END;
$$;

-- Grant necessary permissions
GRANT SELECT ON all_matches TO authenticated;
GRANT EXECUTE ON FUNCTION validate_match_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_match_details(uuid) TO authenticated;