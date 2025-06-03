/*
  # Add support ticket system schema

  1. New Tables
    - `support_tickets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `status` (text, default 'open')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `resolved_at` (timestamptz)
      - `resolved_by` (uuid, references profiles)

    - `ticket_messages`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, references support_tickets)
      - `user_id` (uuid, references profiles)
      - `content` (text)
      - `file_url` (text)
      - `file_type` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for users and admins
*/

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  CONSTRAINT valid_status CHECK (status IN ('open', 'resolved'))
);

-- Create ticket_messages table
CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  file_url text,
  file_type text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Policies for support_tickets
CREATE POLICY "Users can view their own tickets"
  ON support_tickets FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update tickets"
  ON support_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for ticket_messages
CREATE POLICY "Users can view messages from their tickets"
  ON ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND (
        support_tickets.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Users can create messages in their tickets"
  ON ticket_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND (
        support_tickets.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );

-- Create function to get unread ticket count
CREATE OR REPLACE FUNCTION get_unread_ticket_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- For admins, count messages in all open tickets
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND role = 'admin'
  ) THEN
    SELECT COUNT(DISTINCT tm.id)
    INTO v_count
    FROM support_tickets st
    JOIN ticket_messages tm ON tm.ticket_id = st.id
    WHERE st.status = 'open'
    AND tm.user_id != p_user_id
    AND tm.created_at > COALESCE(
      (SELECT MAX(created_at)
       FROM ticket_messages
       WHERE ticket_id = st.id
       AND user_id = p_user_id),
      st.created_at
    );
  ELSE
    -- For users, count unread messages in their tickets
    SELECT COUNT(DISTINCT tm.id)
    INTO v_count
    FROM support_tickets st
    JOIN ticket_messages tm ON tm.ticket_id = st.id
    WHERE st.user_id = p_user_id
    AND st.status = 'open'
    AND tm.user_id != p_user_id
    AND tm.created_at > COALESCE(
      (SELECT MAX(created_at)
       FROM ticket_messages
       WHERE ticket_id = st.id
       AND user_id = p_user_id),
      st.created_at
    );
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$;