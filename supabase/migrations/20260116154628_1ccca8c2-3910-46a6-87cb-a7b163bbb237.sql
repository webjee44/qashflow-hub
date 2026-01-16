
-- Migrate existing users to organizations
DO $$
DECLARE
  user_record RECORD;
  new_org_id uuid;
  org_name text;
  org_slug text;
BEGIN
  -- Loop through users who don't have an organization
  FOR user_record IN 
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_members om WHERE om.user_id = u.id
    )
  LOOP
    -- Generate org name from email
    org_name := COALESCE(
      user_record.raw_user_meta_data->>'company_name',
      split_part(user_record.email, '@', 1) || '''s Organization'
    );
    
    -- Generate unique slug
    org_slug := public.generate_org_slug(org_name);
    
    -- Create organization for this user
    INSERT INTO public.organizations (name, slug, owner_id, plan, subscription_status)
    VALUES (org_name, org_slug, user_record.id, 'free', 'trialing')
    RETURNING id INTO new_org_id;
    
    -- Add user as owner
    INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
    VALUES (new_org_id, user_record.id, 'owner', now());
    
    -- Associate their existing companies with this organization
    UPDATE public.companies 
    SET organization_id = new_org_id 
    WHERE user_id = user_record.id AND organization_id IS NULL;
    
    RAISE NOTICE 'Migrated user % to organization %', user_record.email, org_name;
  END LOOP;
END $$;
