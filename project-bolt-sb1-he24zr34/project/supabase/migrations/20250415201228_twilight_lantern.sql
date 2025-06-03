/*
  # Add request status enum type

  1. Changes
    - Create request_status enum type
    - Modify team_requests table to use the new enum type
    - Modify captain_requests table to use the same enum type
    - Migrate existing data to use new enum values

  2. Security
    - Maintains existing RLS policies
*/

-- Create the request_status enum type
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Modify team_requests table to use the new enum type
ALTER TABLE team_requests
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE request_status USING status::request_status,
  ALTER COLUMN status SET DEFAULT 'pending';

-- Modify captain_requests table to use the same enum type
ALTER TABLE captain_requests
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE request_status USING status::request_status,
  ALTER COLUMN status SET DEFAULT 'pending';

-- Update any existing records to ensure they use valid enum values
UPDATE team_requests
SET status = 'pending'::request_status
WHERE status IS NULL OR status NOT IN ('pending', 'approved', 'rejected');

UPDATE captain_requests
SET status = 'pending'::request_status
WHERE status IS NULL OR status NOT IN ('pending', 'approved', 'rejected');