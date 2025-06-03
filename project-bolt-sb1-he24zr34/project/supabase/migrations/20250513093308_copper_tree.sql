/*
  # Fix storage access and policies

  1. Changes
    - Update storage bucket policies to allow public access
    - Add policies for authenticated users to upload and manage files
    - Add policies for public read access to all files

  2. Security
    - Maintains secure upload control while allowing public access to stored files
*/

-- Update the storage bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'team-assets';

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload team assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view team assets" ON storage.objects;

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