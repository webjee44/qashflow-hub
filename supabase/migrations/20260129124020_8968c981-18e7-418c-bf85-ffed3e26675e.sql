-- 1. Modifier le trigger handle_new_user pour ignorer les superadmins
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
BEGIN
  -- Ne PAS créer de tenant pour les superadmins
  -- Vérifier si le rôle superadmin existe déjà pour cet utilisateur
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.id AND role = 'superadmin'
  ) THEN
    -- Créer uniquement le profil minimal
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Super Admin'))
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
  END IF;

  -- Code existant pour les utilisateurs normaux
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

-- 2. Créer la fonction de nettoyage pour superadmins existants
CREATE OR REPLACE FUNCTION public.cleanup_superadmin_tenant(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_ids uuid[];
BEGIN
  -- Vérifier que l'utilisateur est superadmin
  IF NOT is_superadmin(_user_id) THEN
    RAISE EXCEPTION 'User is not a superadmin';
  END IF;
  
  -- Récupérer les organisations où il est owner
  SELECT array_agg(o.id) INTO v_org_ids
  FROM organizations o
  WHERE o.owner_id = _user_id;
  
  IF v_org_ids IS NOT NULL THEN
    -- Supprimer les entreprises liées
    DELETE FROM companies WHERE organization_id = ANY(v_org_ids);
    
    -- Supprimer les membres
    DELETE FROM organization_members WHERE organization_id = ANY(v_org_ids);
    
    -- Supprimer les organisations
    DELETE FROM organizations WHERE id = ANY(v_org_ids);
  END IF;
END;
$$;

-- 3. Nettoyer le tenant du superadmin existant (superadmin@gmail.com)
SELECT cleanup_superadmin_tenant('60d20ec5-7257-4e6f-9756-0e731615e091');