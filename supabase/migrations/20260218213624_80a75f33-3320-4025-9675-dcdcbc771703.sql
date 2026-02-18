
-- Modifier handle_new_user pour créer les catégories par défaut automatiquement
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  new_company_id uuid;
  org_name text;
  org_slug text;
  company_name text;
BEGIN
  -- Ne PAS créer de tenant pour les superadmins
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.id AND role = 'superadmin'
  ) THEN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Super Admin'))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  company_name := COALESCE(
    NEW.raw_user_meta_data ->> 'company_name',
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  org_name := company_name;
  org_slug := public.generate_org_slug(org_name);
  
  -- Create organization
  INSERT INTO public.organizations (name, slug, owner_id, plan, subscription_status, trial_ends_at, max_companies, max_members, max_transactions_per_month)
  VALUES (org_name, org_slug, NEW.id, 'pro', 'trialing', now() + interval '30 days', 999, 10, 999999)
  RETURNING id INTO new_org_id;
  
  -- Create member with owner role
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');
  
  -- Create user profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', company_name));
  
  -- Create default company
  INSERT INTO public.companies (user_id, name, organization_id, is_default)
  VALUES (NEW.id, company_name, new_org_id, true)
  RETURNING id INTO new_company_id;
  
  -- Create default categories for the new company
  INSERT INTO public.categories (user_id, company_id, name, color, icon, type, vat_rate, sort_order) VALUES
    (NEW.id, new_company_id, 'Ventes', 'hsl(142, 76%, 36%)', 'TrendingUp', 'income', 0.20, 0),
    (NEW.id, new_company_id, 'Prestations', 'hsl(200, 80%, 50%)', 'Briefcase', 'income', 0.20, 1),
    (NEW.id, new_company_id, 'Salaires', 'hsl(0, 72%, 51%)', 'Users', 'expense', 0, 0),
    (NEW.id, new_company_id, 'Loyer', 'hsl(25, 95%, 53%)', 'Home', 'expense', 0.20, 1),
    (NEW.id, new_company_id, 'Fournisseurs', 'hsl(262, 83%, 58%)', 'ShoppingCart', 'expense', 0.20, 2),
    (NEW.id, new_company_id, 'Marketing', 'hsl(330, 80%, 60%)', 'Megaphone', 'expense', 0.20, 3),
    (NEW.id, new_company_id, 'Logiciels & Abonnements', 'hsl(180, 60%, 45%)', 'Monitor', 'expense', 0.20, 4);
  
  RETURN NEW;
END;
$$;
