/*
  # Add admin profile update policy

  1. Changes
    - Add policy allowing admins to update any profile
    - Use role enum instead of is_admin flag
    - Maintain existing policies

  2. Security
    - Only allows updates from authenticated admin users
    - Preserves existing user self-update policy
*/

-- Add policy for admin updates
CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );