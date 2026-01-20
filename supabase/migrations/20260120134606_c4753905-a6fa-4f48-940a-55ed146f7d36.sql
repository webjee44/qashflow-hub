-- Function to get user email for superadmins
CREATE OR REPLACE FUNCTION public.get_user_email_for_superadmin(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is superadmin
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;
  
  RETURN (SELECT email FROM auth.users WHERE id = _user_id);
END;
$$;