/*
  # Fix duplicate submissions and missing update_standings function

  1. Duplicate Prevention
    - The existing trigger already prevents duplicate submissions
    - Add additional client-side check for better UX

  2. Missing Function
    - Create the update_standings function that's being called during approval
    - Handle standings updates for all competition types
*/

-- Create function to update standings based on match results
CREATE OR REPLACE FUNCTION update_standings(p_match_id uuid, p_edition_type text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_home_score integer;
  v_away_score integer;
  v_edition_id uuid;
  v_home_points integer := 0;
  v_away_points integer := 0;
  v_home_wins integer := 0;
  v_away_wins integer := 0;
  v_home_draws integer := 0;
  v_away_draws integer := 0;
  v_home_losses integer := 0;
  v_away_losses integer := 0;
BEGIN
  -- Get match details based on competition type
  IF p_edition_type = 'league' THEN
    SELECT home_team_id, away_team_id, home_score, away_score, edition_id
    INTO v_home_team_id, v_away_team_id, v_home_score, v_away_score, v_edition_id
    FROM matches_league
    WHERE id = p_match_id;
  ELSIF p_edition_type = 'cup' THEN
    SELECT home_team_id, away_team_id, home_score, away_score, edition_id
    INTO v_home_team_id, v_away_team_id, v_home_score, v_away_score, v_edition_id
    FROM matches_cup
    WHERE id = p_match_id;
  ELSIF p_edition_type = 'champions' THEN
    SELECT home_team_id, away_team_id, home_score, away_score, edition_id
    INTO v_home_team_id, v_away_team_id, v_home_score, v_away_score, v_edition_id
    FROM matches_champions
    WHERE id = p_match_id;
  ELSE
    -- Legacy matches table
    SELECT home_team_id, away_team_id, home_score, away_score, competition_id
    INTO v_home_team_id, v_away_team_id, v_home_score, v_away_score, v_edition_id
    FROM matches
    WHERE id = p_match_id;
  END IF;

  -- If match not found or scores are null, exit
  IF v_home_team_id IS NULL OR v_home_score IS NULL OR v_away_score IS NULL THEN
    RETURN;
  END IF;

  -- Calculate points and stats
  IF v_home_score > v_away_score THEN
    -- Home team wins
    v_home_points := 3;
    v_away_points := 0;
    v_home_wins := 1;
    v_away_losses := 1;
  ELSIF v_home_score < v_away_score THEN
    -- Away team wins
    v_home_points := 0;
    v_away_points := 3;
    v_home_losses := 1;
    v_away_wins := 1;
  ELSE
    -- Draw
    v_home_points := 1;
    v_away_points := 1;
    v_home_draws := 1;
    v_away_draws := 1;
  END IF;

  -- Update standings based on competition type
  IF p_edition_type = 'league' THEN
    -- Update home team standings
    INSERT INTO standings_league (
      edition_id, team_id, team_name, played, won, drawn, lost, 
      goals_for, goals_against, goal_difference, points
    )
    SELECT 
      v_edition_id, v_home_team_id, t.name, 1, v_home_wins, v_home_draws, v_home_losses,
      v_home_score, v_away_score, (v_home_score - v_away_score), v_home_points
    FROM teams t WHERE t.id = v_home_team_id
    ON CONFLICT (edition_id, team_id) DO UPDATE SET
      played = standings_league.played + 1,
      won = standings_league.won + v_home_wins,
      drawn = standings_league.drawn + v_home_draws,
      lost = standings_league.lost + v_home_losses,
      goals_for = standings_league.goals_for + v_home_score,
      goals_against = standings_league.goals_against + v_away_score,
      goal_difference = standings_league.goal_difference + (v_home_score - v_away_score),
      points = standings_league.points + v_home_points,
      updated_at = now();

    -- Update away team standings
    INSERT INTO standings_league (
      edition_id, team_id, team_name, played, won, drawn, lost, 
      goals_for, goals_against, goal_difference, points
    )
    SELECT 
      v_edition_id, v_away_team_id, t.name, 1, v_away_wins, v_away_draws, v_away_losses,
      v_away_score, v_home_score, (v_away_score - v_home_score), v_away_points
    FROM teams t WHERE t.id = v_away_team_id
    ON CONFLICT (edition_id, team_id) DO UPDATE SET
      played = standings_league.played + 1,
      won = standings_league.won + v_away_wins,
      drawn = standings_league.drawn + v_away_draws,
      lost = standings_league.lost + v_away_losses,
      goals_for = standings_league.goals_for + v_away_score,
      goals_against = standings_league.goals_against + v_home_score,
      goal_difference = standings_league.goal_difference + (v_away_score - v_home_score),
      points = standings_league.points + v_away_points,
      updated_at = now();

  ELSIF p_edition_type = 'champions' THEN
    -- Get group name for champions league
    DECLARE
      v_group_name text;
    BEGIN
      SELECT group_name INTO v_group_name
      FROM matches_champions
      WHERE id = p_match_id;

      -- Update home team standings
      INSERT INTO standings_champions_groups (
        edition_id, group_name, team_id, team_name, played, won, drawn, lost, 
        goals_for, goals_against, goal_difference, points
      )
      SELECT 
        v_edition_id, v_group_name, v_home_team_id, t.name, 1, v_home_wins, v_home_draws, v_home_losses,
        v_home_score, v_away_score, (v_home_score - v_away_score), v_home_points
      FROM teams t WHERE t.id = v_home_team_id
      ON CONFLICT (edition_id, group_name, team_id) DO UPDATE SET
        played = standings_champions_groups.played + 1,
        won = standings_champions_groups.won + v_home_wins,
        drawn = standings_champions_groups.drawn + v_home_draws,
        lost = standings_champions_groups.lost + v_home_losses,
        goals_for = standings_champions_groups.goals_for + v_home_score,
        goals_against = standings_champions_groups.goals_against + v_away_score,
        goal_difference = standings_champions_groups.goal_difference + (v_home_score - v_away_score),
        points = standings_champions_groups.points + v_home_points,
        updated_at = now();

      -- Update away team standings
      INSERT INTO standings_champions_groups (
        edition_id, group_name, team_id, team_name, played, won, drawn, lost, 
        goals_for, goals_against, goal_difference, points
      )
      SELECT 
        v_edition_id, v_group_name, v_away_team_id, t.name, 1, v_away_wins, v_away_draws, v_away_losses,
        v_away_score, v_home_score, (v_away_score - v_home_score), v_away_points
      FROM teams t WHERE t.id = v_away_team_id
      ON CONFLICT (edition_id, group_name, team_id) DO UPDATE SET
        played = standings_champions_groups.played + 1,
        won = standings_champions_groups.won + v_away_wins,
        drawn = standings_champions_groups.drawn + v_away_draws,
        lost = standings_champions_groups.lost + v_away_losses,
        goals_for = standings_champions_groups.goals_for + v_away_score,
        goals_against = standings_champions_groups.goals_against + v_home_score,
        goal_difference = standings_champions_groups.goal_difference + (v_away_score - v_home_score),
        points = standings_champions_groups.points + v_away_points,
        updated_at = now();
    END;
  END IF;

  -- Cup competitions don't have standings tables, so we skip them
END;
$$;

-- Create function to approve match results and update standings
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
  v_match_table text;
BEGIN
  -- Determine the correct match table
  v_match_table := 'matches_' || p_edition_type;
  
  -- Update the match with the final scores and mark as approved
  IF p_edition_type = 'league' THEN
    UPDATE matches_league 
    SET home_score = p_home_score, 
        away_score = p_away_score, 
        approved = true,
        status = 'completed',
        updated_at = now()
    WHERE id = p_match_id;
  ELSIF p_edition_type = 'cup' THEN
    UPDATE matches_cup 
    SET home_score = p_home_score, 
        away_score = p_away_score, 
        approved = true,
        status = 'completed',
        updated_at = now()
    WHERE id = p_match_id;
  ELSIF p_edition_type = 'champions' THEN
    UPDATE matches_champions 
    SET home_score = p_home_score, 
        away_score = p_away_score, 
        approved = true,
        status = 'completed',
        updated_at = now()
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
  END IF;

  -- Update standings (only for league and champions competitions)
  IF p_edition_type IN ('league', 'champions') THEN
    PERFORM update_standings(p_match_id, p_edition_type);
  END IF;

  -- Update player stats aggregates
  PERFORM update_player_stats_aggregates(p_match_id, p_edition_type);
END;
$$;

-- Create function to update player stats aggregates
CREATE OR REPLACE FUNCTION update_player_stats_aggregates(
  p_match_id uuid,
  p_edition_type text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_edition_id uuid;
  v_stats_table text;
  rec RECORD;
BEGIN
  -- Get edition_id based on competition type
  IF p_edition_type = 'league' THEN
    SELECT edition_id INTO v_edition_id FROM matches_league WHERE id = p_match_id;
    v_stats_table := 'stats_league';
  ELSIF p_edition_type = 'cup' THEN
    SELECT edition_id INTO v_edition_id FROM matches_cup WHERE id = p_match_id;
    v_stats_table := 'stats_cup';
  ELSIF p_edition_type = 'champions' THEN
    SELECT edition_id INTO v_edition_id FROM matches_champions WHERE id = p_match_id;
    v_stats_table := 'stats_champions';
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

-- Create function to check if result already submitted (for client-side checks)
CREATE OR REPLACE FUNCTION check_result_already_submitted(p_match_id uuid, p_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM match_results 
    WHERE match_id = p_match_id 
    AND team_id = p_team_id
  );
END;
$$;