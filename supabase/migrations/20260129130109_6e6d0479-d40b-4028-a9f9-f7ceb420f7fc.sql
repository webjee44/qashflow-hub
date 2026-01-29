
-- Create a SECURITY DEFINER function for superadmins to view companies in an organization
CREATE OR REPLACE FUNCTION public.get_superadmin_org_companies(_org_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  user_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is superadmin
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.user_id,
    c.created_at
  FROM public.companies c
  WHERE c.organization_id = _org_id
    AND c.deleted_at IS NULL
  ORDER BY c.name;
END;
$$;
