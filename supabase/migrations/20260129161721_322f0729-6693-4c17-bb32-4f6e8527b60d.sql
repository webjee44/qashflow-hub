-- 1. Ajouter un membre à l'organisation par email (superadmin only)
CREATE OR REPLACE FUNCTION public.add_organization_member_by_email(
  _org_id UUID,
  _email TEXT,
  _role app_role DEFAULT 'member'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
BEGIN
  -- Check superadmin
  IF NOT is_superadmin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès refusé');
  END IF;

  -- Find user by email
  SELECT id INTO _user_id 
  FROM auth.users 
  WHERE email = lower(trim(_email));
  
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé. Il doit d''abord créer un compte.');
  END IF;
  
  -- Check if already member
  IF EXISTS (SELECT 1 FROM organization_members WHERE organization_id = _org_id AND user_id = _user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cet utilisateur est déjà membre de l''organisation');
  END IF;
  
  -- Add to organization
  INSERT INTO organization_members (organization_id, user_id, role, joined_at)
  VALUES (_org_id, _user_id, _role, now());
  
  RETURN jsonb_build_object('success', true, 'user_id', _user_id);
END;
$$;

-- 2. Get org members with company access info (superadmin only)
CREATE OR REPLACE FUNCTION public.get_org_members_with_company_access(
  _org_id UUID
)
RETURNS TABLE (
  member_id UUID,
  user_id UUID,
  email TEXT,
  role app_role,
  joined_at TIMESTAMPTZ,
  companies JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check superadmin
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;

  RETURN QUERY
  SELECT 
    om.id as member_id,
    om.user_id,
    au.email::TEXT,
    om.role,
    om.joined_at,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'company_id', c.id,
          'company_name', c.name,
          'has_access', EXISTS (
            SELECT 1 FROM company_members cm 
            WHERE cm.company_id = c.id AND cm.user_id = om.user_id
          ),
          'is_owner', c.user_id = om.user_id
        ) ORDER BY c.name)
        FROM companies c
        WHERE c.organization_id = _org_id AND c.deleted_at IS NULL
      ),
      '[]'::jsonb
    ) as companies
  FROM organization_members om
  JOIN auth.users au ON au.id = om.user_id
  WHERE om.organization_id = _org_id
  ORDER BY 
    CASE om.role 
      WHEN 'owner' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'member' THEN 3 
      WHEN 'viewer' THEN 4 
      ELSE 5 
    END,
    om.joined_at;
END;
$$;

-- 3. Toggle company member access (superadmin only)
CREATE OR REPLACE FUNCTION public.toggle_company_member_access(
  _company_id UUID,
  _user_id UUID,
  _enable BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check superadmin
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;

  IF _enable THEN
    INSERT INTO company_members (company_id, user_id)
    VALUES (_company_id, _user_id)
    ON CONFLICT (company_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM company_members
    WHERE company_id = _company_id AND user_id = _user_id;
  END IF;
  
  RETURN true;
END;
$$;

-- 4. Remove organization member (superadmin only)
CREATE OR REPLACE FUNCTION public.remove_organization_member(
  _org_id UUID,
  _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _member_role app_role;
BEGIN
  -- Check superadmin
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;

  -- Check member exists and get role
  SELECT role INTO _member_role
  FROM organization_members
  WHERE organization_id = _org_id AND user_id = _user_id;

  IF _member_role IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Cannot remove owner
  IF _member_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove organization owner';
  END IF;

  -- Remove from all companies in this org first
  DELETE FROM company_members
  WHERE user_id = _user_id
    AND company_id IN (
      SELECT id FROM companies WHERE organization_id = _org_id
    );

  -- Remove from organization
  DELETE FROM organization_members
  WHERE organization_id = _org_id AND user_id = _user_id;

  RETURN true;
END;
$$;