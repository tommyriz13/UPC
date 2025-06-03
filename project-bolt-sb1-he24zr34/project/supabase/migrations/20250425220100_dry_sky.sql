/*
  # Add social posts feature

  1. New Tables
    - `social_posts`
      - `id` (uuid, primary key)
      - `title` (text, not null)
      - `image_url` (text, not null)
      - `post_url` (text, not null)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `active` (boolean, default true)

  2. Security
    - Enable RLS
    - Add policies for:
      - Everyone can view active posts
      - Only admins can manage posts
*/

CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  post_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  active boolean DEFAULT true
);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Everyone can view active posts"
  ON social_posts FOR SELECT
  USING (active = true);

CREATE POLICY "Only admins can manage posts"
  ON social_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );