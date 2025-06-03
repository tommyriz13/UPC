/*
  # Add status field to competitions table

  1. Changes
    - Add status field to competitions table with default value 'in_corso'
    - Update existing records to have the default status

  2. Security
    - Maintains existing RLS policies
*/

ALTER TABLE competitions
ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_corso';

-- Update existing records to have the default status
UPDATE competitions
SET status = 'in_corso'
WHERE status IS NULL;