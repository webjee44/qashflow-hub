-- Create trigger function to auto-create organization on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  -- Use full_name or email as organization name
  org_name := COALESCE(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    split_part(new.email, '@', 1)
  ) || '''s Organization';
  
  -- Generate unique slug
  org_slug := public.generate_org_slug(org_name);
  
  -- Create the organization
  INSERT INTO public.organizations (name, slug, owner_id, plan, subscription_status)
  VALUES (org_name, org_slug, new.id, 'free', 'trialing')
  RETURNING id INTO new_org_id;
  
  -- Add user as owner of the organization
  INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
  VALUES (new_org_id, new.id, 'owner', now());
  
  RETURN new;
END;
$$;

-- Create trigger on auth.users for organization creation
CREATE TRIGGER on_auth_user_created_organization
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_organization();