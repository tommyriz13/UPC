/*
  # Add captain requests table

  1. New Tables
    - `captain_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `status` (text, default 'pending')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for:
      - Users can create their own requests
      - Admins can view and manage all requests
      - Users can view their own requests
*/

CREATE TABLE IF NOT EXISTS captain_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE captain_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can create their own captain requests"
  ON captain_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own captain requests"
  ON captain_requests FOR SELECT
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update captain requests"
  ON captain_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );