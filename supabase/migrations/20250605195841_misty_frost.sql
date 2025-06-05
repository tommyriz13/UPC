/*
  # Add competition editions and type-specific tables

  1. New Tables
    - `competition_editions` - Store competition editions/seasons
    - Type-specific match tables
    - Type-specific standings tables
    - Type-specific stats tables

  2. Changes
    - Add edition_id to existing tables
    - Update relationships and constraints
    - Add appropriate indexes

  3. Security
    - Maintain existing RLS policies
    - Add policies for new tables
*/

-- Create competition editions table
CREATE TABLE IF NOT EXISTS competition_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type competition_type NOT NULL,
  season text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  status text DEFAULT 'in_corso',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create type-specific match tables
CREATE TABLE IF NOT EXISTS matches_league (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES competition_editions(id) ON DELETE CASCADE,
  home_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  home_score integer,
  away_score integer,
  match_day integer NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status match_status DEFAULT 'scheduled',
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches_cup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES competition_editions(id) ON DELETE CASCADE,
  home_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  home_score integer,
  away_score integer,
  round integer NOT NULL,
  leg integer DEFAULT 1,
  scheduled_for timestamptz NOT NULL,
  status match_status DEFAULT 'scheduled',
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches_champions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES competition_editions(id) ON DELETE CASCADE,
  stage text NOT NULL, -- 'groups', 'round_of_16', 'quarter_finals', 'semi_finals', 'final'
  group_name text, -- For group stage matches
  home_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  home_score integer,
  away_score integer,
  match_day integer NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status match_status DEFAULT 'scheduled',
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create type-specific standings tables
CREATE TABLE IF NOT EXISTS standings_league (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES competition_editions(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  played integer DEFAULT 0,
  won integer DEFAULT 0,
  drawn integer DEFAULT 0,
  lost integer DEFAULT 0,
  goals_for integer DEFAULT 0,
  goals_against integer DEFAULT 0,
  goal_difference integer DEFAULT 0,
  points integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(edition_id, team_id)
);

CREATE TABLE IF NOT EXISTS standings_champions_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES competition_editions(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  played integer DEFAULT 0,
  won integer DEFAULT 0,
  drawn integer DEFAULT 0,
  lost integer DEFAULT 0,
  goals_for integer DEFAULT 0,
  goals_against integer DEFAULT 0,
  goal_difference integer DEFAULT 0,
  points integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(edition_id, group_name, team_id)
);

-- Create type-specific stats tables
CREATE TABLE IF NOT EXISTS stats_league (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES competition_editions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  matches_played integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(edition_id, player_id)
);

CREATE TABLE IF NOT EXISTS stats_cup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES competition_editions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  matches_played integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(edition_id, player_id)
);

CREATE TABLE IF NOT EXISTS stats_champions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES competition_editions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  matches_played integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(edition_id, player_id)
);

-- Create indexes
CREATE INDEX idx_matches_league_edition ON matches_league(edition_id);
CREATE INDEX idx_matches_cup_edition ON matches_cup(edition_id);
CREATE INDEX idx_matches_champions_edition ON matches_champions(edition_id);
CREATE INDEX idx_standings_league_edition ON standings_league(edition_id);
CREATE INDEX idx_standings_champions_edition ON standings_champions_groups(edition_id);
CREATE INDEX idx_stats_league_edition ON stats_league(edition_id);
CREATE INDEX idx_stats_cup_edition ON stats_cup(edition_id);
CREATE INDEX idx_stats_champions_edition ON stats_champions(edition_id);

-- Enable RLS
ALTER TABLE competition_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_cup ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_champions ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_champions_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_league ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_cup ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_champions ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Competition editions are viewable by everyone"
  ON competition_editions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify competition editions"
  ON competition_editions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add similar policies for all new tables
DO $$ 
DECLARE
  table_name text;
BEGIN
  FOR table_name IN 
    SELECT unnest(ARRAY[
      'matches_league',
      'matches_cup',
      'matches_champions',
      'standings_league',
      'standings_champions_groups',
      'stats_league',
      'stats_cup',
      'stats_champions'
    ])
  LOOP
    EXECUTE format($policy$
      CREATE POLICY "Viewable by everyone" ON %I
        FOR SELECT USING (true);
      
      CREATE POLICY "Only admins can modify" ON %I
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
          )
        );
    $policy$, table_name, table_name);
  END LOOP;
END $$;

-- Create functions for stats aggregation
CREATE OR REPLACE FUNCTION update_league_stats(
  p_edition_id uuid,
  p_player_id uuid,
  p_team_id uuid,
  p_goals integer,
  p_assists integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO stats_league (
    edition_id,
    player_id,
    team_id,
    goals,
    assists,
    matches_played
  )
  VALUES (
    p_edition_id,
    p_player_id,
    p_team_id,
    p_goals,
    p_assists,
    1
  )
  ON CONFLICT (edition_id, player_id)
  DO UPDATE SET
    goals = stats_league.goals + p_goals,
    assists = stats_league.assists + p_assists,
    matches_played = stats_league.matches_played + 1;
END;
$$;

-- Create similar functions for cup and champions stats
CREATE OR REPLACE FUNCTION update_cup_stats(
  p_edition_id uuid,
  p_player_id uuid,
  p_team_id uuid,
  p_goals integer,
  p_assists integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO stats_cup (
    edition_id,
    player_id,
    team_id,
    goals,
    assists,
    matches_played
  )
  VALUES (
    p_edition_id,
    p_player_id,
    p_team_id,
    p_goals,
    p_assists,
    1
  )
  ON CONFLICT (edition_id, player_id)
  DO UPDATE SET
    goals = stats_cup.goals + p_goals,
    assists = stats_cup.assists + p_assists,
    matches_played = stats_cup.matches_played + 1;
END;
$$;

CREATE OR REPLACE FUNCTION update_champions_stats(
  p_edition_id uuid,
  p_player_id uuid,
  p_team_id uuid,
  p_goals integer,
  p_assists integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO stats_champions (
    edition_id,
    player_id,
    team_id,
    goals,
    assists,
    matches_played
  )
  VALUES (
    p_edition_id,
    p_player_id,
    p_team_id,
    p_goals,
    p_assists,
    1
  )
  ON CONFLICT (edition_id, player_id)
  DO UPDATE SET
    goals = stats_champions.goals + p_goals,
    assists = stats_champions.assists + p_assists,
    matches_played = stats_champions.matches_played + 1;
END;
$$;

-- Create functions for standings updates
CREATE OR REPLACE FUNCTION update_league_standings(
  p_edition_id uuid,
  p_team_id uuid,
  p_team_name text,
  p_goals_for integer,
  p_goals_against integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO standings_league (
    edition_id,
    team_id,
    team_name,
    played,
    won,
    drawn,
    lost,
    goals_for,
    goals_against,
    goal_difference,
    points
  )
  VALUES (
    p_edition_id,
    p_team_id,
    p_team_name,
    1,
    CASE WHEN p_goals_for > p_goals_against THEN 1 ELSE 0 END,
    CASE WHEN p_goals_for = p_goals_against THEN 1 ELSE 0 END,
    CASE WHEN p_goals_for < p_goals_against THEN 1 ELSE 0 END,
    p_goals_for,
    p_goals_against,
    p_goals_for - p_goals_against,
    CASE 
      WHEN p_goals_for > p_goals_against THEN 3
      WHEN p_goals_for = p_goals_against THEN 1
      ELSE 0
    END
  )
  ON CONFLICT (edition_id, team_id)
  DO UPDATE SET
    played = standings_league.played + 1,
    won = standings_league.won + CASE WHEN p_goals_for > p_goals_against THEN 1 ELSE 0 END,
    drawn = standings_league.drawn + CASE WHEN p_goals_for = p_goals_against THEN 1 ELSE 0 END,
    lost = standings_league.lost + CASE WHEN p_goals_for < p_goals_against THEN 1 ELSE 0 END,
    goals_for = standings_league.goals_for + p_goals_for,
    goals_against = standings_league.goals_against + p_goals_against,
    goal_difference = (standings_league.goals_for + p_goals_for) - (standings_league.goals_against + p_goals_against),
    points = standings_league.points + 
      CASE 
        WHEN p_goals_for > p_goals_against THEN 3
        WHEN p_goals_for = p_goals_against THEN 1
        ELSE 0
      END;
END;
$$;

CREATE OR REPLACE FUNCTION update_champions_group_standings(
  p_edition_id uuid,
  p_group_name text,
  p_team_id uuid,
  p_team_name text,
  p_goals_for integer,
  p_goals_against integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO standings_champions_groups (
    edition_id,
    group_name,
    team_id,
    team_name,
    played,
    won,
    drawn,
    lost,
    goals_for,
    goals_against,
    goal_difference,
    points
  )
  VALUES (
    p_edition_id,
    p_group_name,
    p_team_id,
    p_team_name,
    1,
    CASE WHEN p_goals_for > p_goals_against THEN 1 ELSE 0 END,
    CASE WHEN p_goals_for = p_goals_against THEN 1 ELSE 0 END,
    CASE WHEN p_goals_for < p_goals_against THEN 1 ELSE 0 END,
    p_goals_for,
    p_goals_against,
    p_goals_for - p_goals_against,
    CASE 
      WHEN p_goals_for > p_goals_against THEN 3
      WHEN p_goals_for = p_goals_against THEN 1
      ELSE 0
    END
  )
  ON CONFLICT (edition_id, group_name, team_id)
  DO UPDATE SET
    played = standings_champions_groups.played + 1,
    won = standings_champions_groups.won + CASE WHEN p_goals_for > p_goals_against THEN 1 ELSE 0 END,
    drawn = standings_champions_groups.drawn + CASE WHEN p_goals_for = p_goals_against THEN 1 ELSE 0 END,
    lost = standings_champions_groups.lost + CASE WHEN p_goals_for < p_goals_against THEN 1 ELSE 0 END,
    goals_for = standings_champions_groups.goals_for + p_goals_for,
    goals_against = standings_champions_groups.goals_against + p_goals_against,
    goal_difference = (standings_champions_groups.goals_for + p_goals_for) - (standings_champions_groups.goals_against + p_goals_against),
    points = standings_champions_groups.points + 
      CASE 
        WHEN p_goals_for > p_goals_against THEN 3
        WHEN p_goals_for = p_goals_against THEN 1
        ELSE 0
      END;
END;
$$;