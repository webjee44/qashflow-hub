-- Update handle_new_user to use company name from metadata instead of hardcoded "Ma société"
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
BEGIN
  -- Get company name from metadata, fallback to email prefix
  company_name := COALESCE(
    NEW.raw_user_meta_data ->> 'company_name',
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Generate organization name based on company name
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