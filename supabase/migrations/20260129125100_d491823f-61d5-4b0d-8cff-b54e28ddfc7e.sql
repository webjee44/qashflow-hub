-- =============================================
-- ORGANIZATION INVITATIONS SYSTEM
-- =============================================

-- 1. Create the organization_invitations table
CREATE TABLE public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  company_ids uuid[] DEFAULT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create indexes for performance
CREATE INDEX idx_invitations_token ON public.organization_invitations(token);
CREATE INDEX idx_invitations_email ON public.organization_invitations(lower(email));
CREATE INDEX idx_invitations_org ON public.organization_invitations(organization_id);

-- 3. Enable RLS
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Admins can create invitations for their org
CREATE POLICY "Org admins can create invitations"
ON public.organization_invitations FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), organization_id));

-- Admins can view their org's invitations
CREATE POLICY "Org admins can view invitations"
ON public.organization_invitations FOR SELECT
USING (is_org_admin(auth.uid(), organization_id));

-- Anyone can read valid invitation by token (for /join page - unauthenticated users)
CREATE POLICY "Anyone can read valid invitation by token"
ON public.organization_invitations FOR SELECT
USING (
  expires_at > now() 
  AND accepted_at IS NULL
);

-- Admins can delete/revoke invitations
CREATE POLICY "Org admins can delete invitations"
ON public.organization_invitations FOR DELETE
USING (is_org_admin(auth.uid(), organization_id));

-- Superadmins full access
CREATE POLICY "Superadmins can manage all invitations"
ON public.organization_invitations FOR ALL
USING (is_superadmin(auth.uid()))
WITH CHECK (is_superadmin(auth.uid()));

-- 5. Function to get invitation details by token (public, for /join page)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  organization_name text,
  email text,
  role app_role,
  company_ids uuid[],
  expires_at timestamptz,
  accepted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.organization_id,
    o.name as organization_name,
    i.email,
    i.role,
    i.company_ids,
    i.expires_at,
    i.accepted_at
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = _token
    AND i.expires_at > now()
    AND i.accepted_at IS NULL;
END;
$$;

-- 6. Function to accept an invitation (for logged-in users)
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_user_id uuid := auth.uid();
BEGIN
  -- Must be logged in
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Vous devez être connecté pour accepter une invitation');
  END IF;

  -- Get the invitation
  SELECT * INTO v_invitation
  FROM public.organization_invitations
  WHERE token = _token
    AND expires_at > now()
    AND accepted_at IS NULL;
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitation invalide ou expirée');
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_invitation.organization_id
      AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Vous êtes déjà membre de cette organisation');
  END IF;
  
  -- Add as member
  INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
  VALUES (v_invitation.organization_id, v_user_id, v_invitation.role, now());
  
  -- Mark invitation as accepted
  UPDATE public.organization_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'organization_id', v_invitation.organization_id,
    'role', v_invitation.role
  );
END;
$$;

-- 7. Update handle_new_user trigger to check for pending invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  org_name text;
  org_slug text;
  company_name text;
  v_invitation record;
BEGIN
  -- Check for superadmin first
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.id AND role = 'superadmin'
  ) THEN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Super Admin'))
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
  END IF;

  -- CHECK FOR PENDING INVITATION
  SELECT * INTO v_invitation
  FROM public.organization_invitations
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF FOUND THEN
    -- User was invited - add them to the existing organization
    -- Create profile only
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)))
    ON CONFLICT (id) DO NOTHING;
    
    -- Add as member to the inviting organization
    INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
    VALUES (v_invitation.organization_id, NEW.id, v_invitation.role, now());
    
    -- Mark invitation as accepted
    UPDATE public.organization_invitations
    SET accepted_at = now()
    WHERE id = v_invitation.id;
    
    -- DO NOT create a new organization or company
    RETURN NEW;
  END IF;

  -- NORMAL FLOW - No invitation found, create new tenant
  company_name := COALESCE(
    NEW.raw_user_meta_data ->> 'company_name',
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  org_name := company_name;
  org_slug := public.generate_org_slug(org_name);
  
  -- Create organization with Pro plan and 30 days trial
  INSERT INTO public.organizations (name, slug, owner_id, plan, subscription_status, trial_ends_at, max_companies, max_members, max_transactions_per_month)
  VALUES (org_name, org_slug, NEW.id, 'pro', 'trialing', now() + interval '30 days', 999, 10, 999999)
  RETURNING id INTO new_org_id;
  
  -- Create member with owner role
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');
  
  -- Create user profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', company_name));
  
  -- Create default company with the actual company name from signup
  INSERT INTO public.companies (user_id, name, organization_id, is_default)
  VALUES (NEW.id, company_name, new_org_id, true);
  
  RETURN NEW;
END;
$$;