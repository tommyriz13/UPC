/*
  # Add secure function for role management

  1. New Functions
    - `update_user_role` - Securely updates a user's role
      - Takes user_id and new_role as parameters
      - Checks permissions before updating
      - Returns success status

  2. Security
    - Function runs with security definer
    - Only admins can execute the function
*/

CREATE OR REPLACE FUNCTION update_user_role(
  user_id UUID,
  new_role user_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the executing user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- Update the user's role
  UPDATE profiles
  SET 
    role = new_role,
    updated_at = now()
  WHERE id = user_id;

  RETURN FOUND;
END;
$$;