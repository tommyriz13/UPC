/*
  # Add storage bucket for team assets

  1. Changes
    - Create storage bucket for team logos and assets
    - Add storage policies for authenticated users
*/

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-assets', 'team-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload team assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'team-assets' AND
  auth.role() = 'authenticated'
);

-- Allow public access to read team assets
CREATE POLICY "Anyone can view team assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'team-assets');