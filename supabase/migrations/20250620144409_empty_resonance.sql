/*
  # Fix update_standings function signature

  The system is calling update_standings(uuid, uuid) but our function expects (uuid, text).
  We need to create the function with the expected signature and determine the edition type
  from the match_id.
*/

-- Create the update_standings function with the signature the system expects
CREATE OR REPLACE FUNCTION update_standings(p_match_id uuid, p_team_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_edition_type text;
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
  v_group_name text;
BEGIN
  -- Determine edition type and get match details
  IF EXISTS (SELECT 1 FROM matches_league WHERE id = p_match_id) THEN
    v_edition_type := 'league';
    SELECT home_team_id, away_team_id, home_score, away_score, edition_id
    INTO v_home_team_id, v_away_team_id, v_home_score, v_away_score, v_edition_id
    FROM matches_league
    WHERE id = p_match_id;
  ELSIF EXISTS (SELECT 1 FROM matches_cup WHERE id = p_match_id) THEN
    v_edition_type := 'cup';
    SELECT home_team_id, away_team_id, home_score, away_score, edition_id
    INTO v_home_team_id, v_away_team_id, v_home_score, v_away_score, v_edition_id
    FROM matches_cup
    WHERE id = p_match_id;
  ELSIF EXISTS (SELECT 1 FROM matches_champions WHERE id = p_match_id) THEN
    v_edition_type := 'champions';
    SELECT home_team_id, away_team_id, home_score, away_score, edition_id, group_name
    INTO v_home_team_id, v_away_team_id, v_home_score, v_away_score, v_edition_id, v_group_name
    FROM matches_champions
    WHERE id = p_match_id;
  ELSIF EXISTS (SELECT 1 FROM matches WHERE id = p_match_id) THEN
    v_edition_type := 'legacy';
    SELECT home_team_id, away_team_id, home_score, away_score, competition_id
    INTO v_home_team_id, v_away_team_id, v_home_score, v_away_score, v_edition_id
    FROM matches
    WHERE id = p_match_id;
  ELSE
    -- Match not found
    RETURN;
  END IF;

  -- If match not found or scores are null, exit
  IF v_home_team_id IS NULL OR v_home_score IS NULL OR v_away_score IS NULL THEN
    RETURN;
  END IF;

  -- Cup competitions don't have standings, so exit early
  IF v_edition_type = 'cup' THEN
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
  IF v_edition_type = 'league' THEN
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

  ELSIF v_edition_type = 'champions' THEN
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
  END IF;
END;
$$;

-- Also create a trigger function that calls update_standings when match_results are approved
CREATE OR REPLACE FUNCTION handle_match_result_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update standings when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Call update_standings for both teams
    PERFORM update_standings(NEW.match_id, NEW.team_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS on_match_result_approved ON match_results;
CREATE TRIGGER on_match_result_approved
  AFTER UPDATE OF status ON match_results
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION handle_match_result_approval();