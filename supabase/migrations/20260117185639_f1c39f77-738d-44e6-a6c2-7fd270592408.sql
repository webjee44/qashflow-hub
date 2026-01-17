-- Update the default trial period to 30 days and set plan to 'pro' for new organizations
ALTER TABLE public.organizations 
ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '30 days');

-- Update existing function to set plan as 'pro' and trial as 30 days
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_org_id uuid;
  org_name text;
  org_slug text;
BEGIN
  -- Générer un nom d'organisation basé sur l'email
  org_name := split_part(NEW.email, '@', 1);
  org_slug := public.generate_org_slug(org_name);
  
  -- Créer l'organisation avec plan Pro et 30 jours d'essai
  INSERT INTO public.organizations (name, slug, owner_id, plan, subscription_status, trial_ends_at, max_companies, max_members, max_transactions_per_month)
  VALUES (org_name, org_slug, NEW.id, 'pro', 'trialing', now() + interval '30 days', 999, 10, 999999)
  RETURNING id INTO new_org_id;
  
  -- Créer le membre avec le rôle owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');
  
  -- Créer le profil utilisateur
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', org_name));
  
  -- Créer une entreprise par défaut
  INSERT INTO public.companies (user_id, name, organization_id, is_default)
  VALUES (NEW.id, 'Ma société', new_org_id, true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update existing organizations that are still on free plan to pro with proper trial
UPDATE public.organizations 
SET 
  plan = 'pro',
  trial_ends_at = CASE 
    WHEN trial_ends_at IS NULL THEN created_at + interval '30 days'
    WHEN trial_ends_at < now() THEN trial_ends_at -- Keep expired trials as is
    ELSE created_at + interval '30 days' -- Extend to 30 days from creation
  END,
  max_companies = 999,
  max_members = 10,
  max_transactions_per_month = 999999
WHERE plan = 'free' AND subscription_status = 'trialing';