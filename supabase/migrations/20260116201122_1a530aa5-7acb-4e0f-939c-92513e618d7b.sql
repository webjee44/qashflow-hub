-- Update the handle_new_user_organization function to also create the first company
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  new_company_id UUID;
  org_name TEXT;
  org_slug TEXT;
  company_name TEXT;
BEGIN
  -- Get company name from metadata (used for organization name too)
  company_name := COALESCE(
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );
  
  -- Use company name for organization name
  org_name := company_name || '''s Organization';
  
  -- Generate unique slug
  org_slug := public.generate_org_slug(org_name);
  
  -- Create the organization
  INSERT INTO public.organizations (name, slug, owner_id, plan, subscription_status)
  VALUES (org_name, org_slug, new.id, 'free', 'trialing')
  RETURNING id INTO new_org_id;
  
  -- Add user as owner of the organization
  INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
  VALUES (new_org_id, new.id, 'owner', now());
  
  -- Create the first company with the company name
  INSERT INTO public.companies (name, user_id, organization_id, is_default, initial_balance)
  VALUES (company_name, new.id, new_org_id, true, 0)
  RETURNING id INTO new_company_id;
  
  RETURN new;
END;
$function$;