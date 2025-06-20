/*
  # Fix approve_match_result function ambiguity

  1. Remove all existing versions of approve_match_result
  2. Create a single, properly defined function
  3. Ensure no parameter conflicts
*/

-- Drop all existing versions of approve_match_result function
DROP FUNCTION IF EXISTS approve_match_result(uuid, text, integer, integer);
DROP FUNCTION IF EXISTS approve_match_result(uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS approve_match_result(p_match_id uuid, p_edition_type text, p_home_score integer, p_away_score integer);

-- Create the single, correct approve_match_result function
CREATE OR REPLACE FUNCTION approve_match_result(
  p_match_id uuid,
  p_edition_type text,
  p_home_score integer,
  p_away_score integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_edition_id uuid;
BEGIN
  -- Update the match with the final scores and mark as approved
  IF p_edition_type = 'league' THEN
    UPDATE matches_league 
    SET home_score = p_home_score, 
        away_score = p_away_score, 
        approved = true,
        status = 'completed',
        updated_at = now()
    WHERE id = p_match_id;
    
    -- Get team IDs for standings update
    SELECT home_team_id, away_team_id, edition_id
    INTO v_home_team_id, v_away_team_id, v_edition_id
    FROM matches_league
    WHERE id = p_match_id;
    
  ELSIF p_edition_type = 'cup' THEN
    UPDATE matches_cup 
    SET home_score = p_home_score, 
        away_score = p_away_score, 
        approved = true,
        status = 'completed',
        updated_at = now()
    WHERE id = p_match_id;
    
    -- Get team IDs (cup doesn't have standings, but we get them for consistency)
    SELECT home_team_id, away_team_id, edition_id
    INTO v_home_team_id, v_away_team_id, v_edition_id
    FROM matches_cup
    WHERE id = p_match_id;
    
  ELSIF p_edition_type = 'champions' THEN
    UPDATE matches_champions 
    SET home_score = p_home_score, 
        away_score = p_away_score, 
        approved = true,
        status = 'completed',
        updated_at = now()
    WHERE id = p_match_id;
    
    -- Get team IDs for standings update
    SELECT home_team_id, away_team_id, edition_id
    INTO v_home_team_id, v_away_team_id, v_edition_id
    FROM matches_champions
    WHERE id = p_match_id;
    
  ELSE
    -- Legacy matches table
    UPDATE matches 
    SET home_score = p_home_score, 
        away_score = p_away_score, 
        approved = true,
        status = 'completed',
        updated_at = now()
    WHERE id = p_match_id;
    
    -- Get team IDs
    SELECT home_team_id, away_team_id, competition_id
    INTO v_home_team_id, v_away_team_id, v_edition_id
    FROM matches
    WHERE id = p_match_id;
  END IF;

  -- Update match results status to approved
  UPDATE match_results 
  SET status = 'approved',
      verification_status = 'approved'
  WHERE match_id = p_match_id;

  -- Update standings (only for league and champions competitions)
  IF p_edition_type IN ('league', 'champions') THEN
    -- Call update_standings for both teams
    PERFORM update_standings(p_match_id, v_home_team_id);
    PERFORM update_standings(p_match_id, v_away_team_id);
  END IF;

  -- Update player stats aggregates
  PERFORM update_player_stats_aggregates(p_match_id, p_edition_type);
END;
$$;

-- Ensure update_player_stats_aggregates function exists
CREATE OR REPLACE FUNCTION update_player_stats_aggregates(
  p_match_id uuid,
  p_edition_type text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_edition_id uuid;
  rec RECORD;
BEGIN
  -- Get edition_id based on competition type
  IF p_edition_type = 'league' THEN
    SELECT edition_id INTO v_edition_id FROM matches_league WHERE id = p_match_id;
  ELSIF p_edition_type = 'cup' THEN
    SELECT edition_id INTO v_edition_id FROM matches_cup WHERE id = p_match_id;
  ELSIF p_edition_type = 'champions' THEN
    SELECT edition_id INTO v_edition_id FROM matches_champions WHERE id = p_match_id;
  ELSE
    -- Legacy matches table
    SELECT competition_id INTO v_edition_id FROM matches WHERE id = p_match_id;
    RETURN; -- Skip stats update for legacy matches
  END IF;

  -- Update stats for each player in this match
  FOR rec IN 
    SELECT player_id, team_id, goals, assists
    FROM match_player_stats
    WHERE match_id = p_match_id
  LOOP
    -- Update the appropriate stats table
    IF p_edition_type = 'league' THEN
      INSERT INTO stats_league (edition_id, player_id, team_id, goals, assists, matches_played)
      VALUES (v_edition_id, rec.player_id, rec.team_id, rec.goals, rec.assists, 1)
      ON CONFLICT (edition_id, player_id) DO UPDATE SET
        goals = stats_league.goals + rec.goals,
        assists = stats_league.assists + rec.assists,
        matches_played = stats_league.matches_played + 1,
        updated_at = now();
    ELSIF p_edition_type = 'cup' THEN
      INSERT INTO stats_cup (edition_id, player_id, team_id, goals, assists, matches_played)
      VALUES (v_edition_id, rec.player_id, rec.team_id, rec.goals, rec.assists, 1)
      ON CONFLICT (edition_id, player_id) DO UPDATE SET
        goals = stats_cup.goals + rec.goals,
        assists = stats_cup.assists + rec.assists,
        matches_played = stats_cup.matches_played + 1,
        updated_at = now();
    ELSIF p_edition_type = 'champions' THEN
      INSERT INTO stats_champions (edition_id, player_id, team_id, goals, assists, matches_played)
      VALUES (v_edition_id, rec.player_id, rec.team_id, rec.goals, rec.assists, 1)
      ON CONFLICT (edition_id, player_id) DO UPDATE SET
        goals = stats_champions.goals + rec.goals,
        assists = stats_champions.assists + rec.assists,
        matches_played = stats_champions.matches_played + 1,
        updated_at = now();
    END IF;
  END LOOP;
END;
$$;