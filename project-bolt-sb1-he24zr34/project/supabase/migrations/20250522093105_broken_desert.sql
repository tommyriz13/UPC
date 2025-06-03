/*
  # Add match proofs storage bucket and policies

  1. Changes
    - Create new storage bucket for match proofs
    - Add storage policies for authenticated users
    - Add policies for public read access

  2. Security
    - Maintains secure upload control
    - Allows public access to stored files
*/

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('match-proofs', 'match-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the match-proofs bucket
CREATE POLICY "Team captains can upload match proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'match-proofs' AND
  EXISTS (
    SELECT 1 FROM teams
    WHERE teams.captain_id = auth.uid()
  )
);

CREATE POLICY "Team captains can update their proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'match-proofs' AND
  EXISTS (
    SELECT 1 FROM teams
    WHERE teams.captain_id = auth.uid()
  )
);

CREATE POLICY "Team captains can delete their proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'match-proofs' AND
  EXISTS (
    SELECT 1 FROM teams
    WHERE teams.captain_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view match proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'match-proofs');