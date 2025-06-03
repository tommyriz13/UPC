/*
  # Add match result verification schema

  1. Changes
    - Add verification fields to match_results table
    - Add result_status enum type for tracking verification state
    - Add admin_notes field for discrepancy documentation
    - Add functions for result verification

  2. Security
    - Maintains existing RLS policies
    - Adds admin-only verification functions
*/

-- Create result status enum
CREATE TYPE result_status AS ENUM ('pending', 'verified', 'discrepancy', 'approved', 'rejected');

-- Add verification fields to match_results
ALTER TABLE match_results 
ADD COLUMN IF NOT EXISTS verification_status result_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS admin_notes text,
ADD COLUMN IF NOT EXISTS admin_modified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_at timestamptz,
ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES profiles(id);

-- Function to check result consistency
CREATE OR REPLACE FUNCTION check_result_consistency(match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_count integer;
  first_home_score integer;
  first_away_score integer;
  results_match boolean := true;
BEGIN
  -- Get number of submitted results
  SELECT COUNT(*)
  INTO result_count
  FROM match_results
  WHERE match_results.match_id = check_result_consistency.match_id;

  -- If we don't have exactly 2 results, return false
  IF result_count != 2 THEN
    RETURN false;
  END IF;

  -- Get first result
  SELECT home_score, away_score
  INTO first_home_score, first_away_score
  FROM match_results
  WHERE match_results.match_id = check_result_consistency.match_id
  LIMIT 1;

  -- Check if all results match
  SELECT COUNT(*) = 0
  INTO results_match
  FROM match_results
  WHERE match_results.match_id = check_result_consistency.match_id
  AND (home_score != first_home_score OR away_score != first_away_score);

  RETURN results_match;
END;
$$;

-- Function to verify match results
CREATE OR REPLACE FUNCTION verify_match_results(
  match_id uuid,
  admin_id uuid,
  verification_result result_status,
  notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = admin_id
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can verify match results';
  END IF;

  -- Update all results for this match
  UPDATE match_results
  SET 
    verification_status = verification_result,
    admin_notes = COALESCE(notes, admin_notes),
    verified_at = CASE WHEN verification_result IN ('verified', 'approved') THEN now() ELSE NULL END,
    verified_by = CASE WHEN verification_result IN ('verified', 'approved') THEN admin_id ELSE NULL END
  WHERE match_results.match_id = verify_match_results.match_id;

  -- If approved, update the match status
  IF verification_result = 'approved' THEN
    UPDATE matches
    SET approved = true
    WHERE id = match_id;
  END IF;

  RETURN FOUND;
END;
$$;