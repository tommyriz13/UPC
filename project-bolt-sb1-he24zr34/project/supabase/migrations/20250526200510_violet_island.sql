/*
  # Add match chat functionality

  1. New Tables
    - `match_chats`
      - `id` (uuid, primary key)
      - `match_id` (uuid, references matches)
      - `created_at` (timestamptz)
      - `active` (boolean)
    
    - `chat_messages`
      - `id` (uuid, primary key)
      - `chat_id` (uuid, references match_chats)
      - `user_id` (uuid, references profiles)
      - `content` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for team captains and admins
    - Add function to manage chat lifecycle
*/

-- Create match_chats table
CREATE TABLE IF NOT EXISTS match_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  active boolean DEFAULT true,
  UNIQUE(match_id)
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES match_chats(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE match_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Function to check if user can access chat
CREATE OR REPLACE FUNCTION can_access_chat(chat_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM match_chats mc
    JOIN matches m ON m.id = mc.match_id
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    WHERE mc.id = chat_id
    AND mc.active = true
    AND (
      ht.captain_id = auth.uid()
      OR at.captain_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );
END;
$$;

-- Function to check if chat should be active
CREATE OR REPLACE FUNCTION should_chat_be_active(match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  match_date timestamptz;
  match_approved boolean;
BEGIN
  SELECT scheduled_for, approved
  INTO match_date, match_approved
  FROM matches
  WHERE id = match_id;

  RETURN (
    match_date - INTERVAL '7 days' <= now()
    AND NOT match_approved
  );
END;
$$;

-- Function to automatically create/deactivate chats
CREATE OR REPLACE FUNCTION manage_match_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For new matches
  IF TG_OP = 'INSERT' THEN
    INSERT INTO match_chats (match_id, active)
    VALUES (NEW.id, should_chat_be_active(NEW.id));
    RETURN NEW;
  END IF;

  -- For match updates
  IF TG_OP = 'UPDATE' THEN
    -- If match is approved, deactivate chat
    IF NEW.approved AND NOT OLD.approved THEN
      UPDATE match_chats
      SET active = false
      WHERE match_id = NEW.id;
    END IF;

    -- Update chat active status based on date
    UPDATE match_chats
    SET active = should_chat_be_active(NEW.id)
    WHERE match_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for match chat management
CREATE TRIGGER manage_match_chat
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION manage_match_chat();

-- Policies for match_chats
CREATE POLICY "Match chats are viewable by team captains and admins"
  ON match_chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at ON at.id = m.away_team_id
      WHERE m.id = match_id
      AND (
        ht.captain_id = auth.uid()
        OR at.captain_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
      )
    )
  );

-- Policies for chat_messages
CREATE POLICY "Chat messages are viewable by chat participants"
  ON chat_messages FOR SELECT
  USING (can_access_chat(chat_id));

CREATE POLICY "Chat messages can be created by chat participants"
  ON chat_messages FOR INSERT
  WITH CHECK (
    can_access_chat(chat_id)
    AND auth.uid() = user_id
  );