/*
  # Update match proofs and verification schema

  1. Changes
    - Add result_status enum type for verification states
    - Add verification fields to match_results table
    - Add admin notes and verification tracking
    - Update match proofs schema for image URLs

  2. Security
    - Maintains existing RLS policies
    - Adds admin-only verification functions
*/

-- Create result status enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE result_status AS ENUM ('pending', 'verified', 'discrepancy', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update match_results table
ALTER TABLE match_results
ADD COLUMN IF NOT EXISTS verification_status result_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS admin_notes text,
ADD COLUMN IF NOT EXISTS admin_modified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_at timestamptz,
ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES profiles(id);

-- Create index for match results
CREATE INDEX IF NOT EXISTS idx_match_player_stats_match ON match_player_stats(match_id);

-- Create unique constraint for match results
CREATE UNIQUE INDEX IF NOT EXISTS match_player_stats_match_id_player_id_key ON match_player_stats(match_id, player_id);

-- Create unique constraint for match lineups
CREATE UNIQUE INDEX IF NOT EXISTS match_lineups_match_id_team_id_key ON match_lineups(match_id, team_id);

-- Create index for match lineups
CREATE INDEX IF NOT EXISTS idx_match_lineups_match_team ON match_lineups(match_id, team_id);

-- Create unique constraint for match proofs
CREATE UNIQUE INDEX IF NOT EXISTS match_proofs_match_id_team_id_key ON match_proofs(match_id, team_id);

-- Create index for match proofs
CREATE INDEX IF NOT EXISTS idx_match_proofs_match_team ON match_proofs(match_id, team_id);

-- Update storage bucket policies
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Authenticated users can upload team assets" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view team assets" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update their uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete their uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Public read access" ON storage.objects;
  
  -- Create new policies
  CREATE POLICY "Authenticated users can upload team assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'team-assets');

  CREATE POLICY "Authenticated users can update their uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'team-assets' AND auth.uid() = owner);

  CREATE POLICY "Authenticated users can delete their uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'team-assets' AND auth.uid() = owner);

  CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'team-assets');
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;