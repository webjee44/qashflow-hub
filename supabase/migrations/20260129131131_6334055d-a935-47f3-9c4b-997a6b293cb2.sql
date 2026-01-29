-- Update handle_new_user to also add invited users to the specified companies
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id uuid;
  org_name text;
  org_slug text;
  company_name text;
  v_invitation record;
  v_company_id uuid;
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
    VALUES (v_invitation.organization_id, NEW.id, v_invitation.role, now())
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    -- Add as member to specified companies
    IF v_invitation.company_ids IS NOT NULL AND array_length(v_invitation.company_ids, 1) > 0 THEN
      FOREACH v_company_id IN ARRAY v_invitation.company_ids
      LOOP
        INSERT INTO public.company_members (company_id, user_id, invited_by)
        VALUES (v_company_id, NEW.id, v_invitation.invited_by)
        ON CONFLICT (company_id, user_id) DO NOTHING;
      END LOOP;
    END IF;
    
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
$function$;