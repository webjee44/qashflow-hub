-- Create function to get all members with their organizations and companies for superadmin
CREATE OR REPLACE FUNCTION public.get_superadmin_all_members()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  organizations jsonb,
  companies jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check superadmin access
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email::text,
    p.full_name,
    u.created_at,
    -- Organizations with role
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'org_id', o.id,
          'org_name', o.name,
          'role', om.role
        ) ORDER BY o.name
      )
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = u.id AND o.deleted_at IS NULL
    ), '[]'::jsonb) as organizations,
    -- Companies (owner + member combined)
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'company_id', sub.id,
          'company_name', sub.name,
          'access_type', sub.access_type
        ) ORDER BY sub.name
      )
      FROM (
        -- Companies where user is owner
        SELECT c.id, c.name, 'owner'::text as access_type
        FROM companies c 
        WHERE c.user_id = u.id AND c.deleted_at IS NULL
        UNION
        -- Companies where user is member (but not owner)
        SELECT c.id, c.name, 'member'::text as access_type
        FROM company_members cm
        JOIN companies c ON c.id = cm.company_id
        WHERE cm.user_id = u.id AND c.deleted_at IS NULL AND c.user_id != u.id
      ) sub
    ), '[]'::jsonb) as companies
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;