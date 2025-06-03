/*
  # Fix match proofs storage policies

  1. Changes
    - Drop existing policies if they exist
    - Recreate policies for match proofs bucket
    - Ensure idempotent policy creation

  2. Security
    - Maintains secure upload control
    - Allows public access to stored files
*/

DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Team captains can upload match proofs" ON storage.objects;
  DROP POLICY IF EXISTS "Team captains can update their proofs" ON storage.objects;
  DROP POLICY IF EXISTS "Team captains can delete their proofs" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view match proofs" ON storage.objects;

  -- Create new policies
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
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;