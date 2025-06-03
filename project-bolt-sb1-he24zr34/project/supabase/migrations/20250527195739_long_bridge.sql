/*
  # Add chat read status tracking

  1. New Tables
    - `chat_read_status`
      - `user_id` (uuid, references profiles)
      - `chat_id` (uuid, references match_chats)
      - `last_read_at` (timestamptz)
      - Primary key on (user_id, chat_id)

  2. Security
    - Enable RLS
    - Add policies for users to manage their own read status
    - Add function to get unread message count
*/

-- Create chat_read_status table
CREATE TABLE IF NOT EXISTS chat_read_status (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES match_chats(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chat_id)
);

-- Enable RLS
ALTER TABLE chat_read_status ENABLE ROW LEVEL SECURITY;

-- Policies for chat_read_status
CREATE POLICY "Users can manage their own read status"
  ON chat_read_status
  FOR ALL
  USING (auth.uid() = user_id);

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_message_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- For admins, count unread messages in all active chats
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND role = 'admin'
  ) THEN
    SELECT COUNT(DISTINCT cm.id)
    INTO v_count
    FROM match_chats mc
    JOIN chat_messages cm ON cm.chat_id = mc.id
    LEFT JOIN chat_read_status crs ON crs.chat_id = mc.id AND crs.user_id = p_user_id
    WHERE mc.active = true
    AND cm.user_id != p_user_id
    AND (crs.last_read_at IS NULL OR cm.created_at > crs.last_read_at);
  ELSE
    -- For team captains, count unread messages in their team's chats
    SELECT COUNT(DISTINCT cm.id)
    INTO v_count
    FROM match_chats mc
    JOIN matches m ON m.id = mc.match_id
    JOIN teams t ON (t.id = m.home_team_id OR t.id = m.away_team_id)
    JOIN chat_messages cm ON cm.chat_id = mc.id
    LEFT JOIN chat_read_status crs ON crs.chat_id = mc.id AND crs.user_id = p_user_id
    WHERE mc.active = true
    AND t.captain_id = p_user_id
    AND cm.user_id != p_user_id
    AND (crs.last_read_at IS NULL OR cm.created_at > crs.last_read_at);
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$;