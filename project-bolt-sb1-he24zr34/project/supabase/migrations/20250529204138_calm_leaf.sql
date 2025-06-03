/*
  # Add chat file uploads support

  1. Changes
    - Add file_url and file_type columns to chat_messages
    - Create storage bucket for chat uploads
    - Add storage policies for authenticated users

  2. Security
    - Maintains existing RLS policies
    - Adds secure file upload handling
*/

-- Add file columns to chat_messages
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS file_type text;

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the chat-uploads bucket
CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-uploads');

CREATE POLICY "Anyone can view chat files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-uploads');