
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id uuid;
  new_company_id uuid;
  org_name text;
  org_slug text;
  v_invitation_token text;
  v_invitation record;
BEGIN
  -- Check if user was invited via an invitation token
  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_invitation_token IS NOT NULL THEN
    -- Look up the invitation
    SELECT * INTO v_invitation
    FROM public.organization_invitations
    WHERE token = v_invitation_token
      AND expires_at > now()
      AND accepted_at IS NULL;

    IF FOUND THEN
      -- Create profile with onboarding already completed (invited user)
      INSERT INTO public.profiles (id, full_name, onboarding_completed, onboarding_step)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), true, 99);

      -- Add user as member of the organization
      INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
      VALUES (v_invitation.organization_id, NEW.id, v_invitation.role, now());

      -- If invitation has company_ids, add user to those companies
      IF v_invitation.company_ids IS NOT NULL AND array_length(v_invitation.company_ids, 1) > 0 THEN
        INSERT INTO public.company_members (company_id, user_id, invited_by)
        SELECT unnest(v_invitation.company_ids), NEW.id, v_invitation.invited_by;
      ELSE
        -- Add to all companies of the organization
        INSERT INTO public.company_members (company_id, user_id, invited_by)
        SELECT c.id, NEW.id, v_invitation.invited_by
        FROM public.companies c
        WHERE c.organization_id = v_invitation.organization_id
          AND c.deleted_at IS NULL;
      END IF;

      -- Mark invitation as accepted
      UPDATE public.organization_invitations
      SET accepted_at = now()
      WHERE id = v_invitation.id;

      RETURN NEW;
    END IF;
  END IF;

  -- Standard flow: no invitation — create full org/company setup
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  org_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Mon entreprise');
  org_slug := public.generate_org_slug(org_name);

  INSERT INTO public.organizations (name, slug, owner_id, plan, subscription_status, trial_ends_at, max_companies, max_members, max_transactions_per_month)
  VALUES (org_name, org_slug, NEW.id, 'pro', 'trialing', now() + interval '7 days', 999, 10, 999999)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
  VALUES (new_org_id, NEW.id, 'owner', now());

  INSERT INTO public.companies (name, user_id, organization_id, is_default, initial_balance)
  VALUES (org_name, NEW.id, new_org_id, true, 0)
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_members (company_id, user_id, invited_by)
  VALUES (new_company_id, NEW.id, NEW.id);

  INSERT INTO public.categories (user_id, company_id, name, color, icon, type, vat_rate, sort_order)
  VALUES
    (NEW.id, new_company_id, 'Ventes', 'hsl(142, 76%, 36%)', 'TrendingUp', 'income', 0.20, 0),
    (NEW.id, new_company_id, 'Prestations', 'hsl(221, 83%, 53%)', 'Briefcase', 'income', 0.20, 1),
    (NEW.id, new_company_id, 'Salaires', 'hsl(0, 84%, 60%)', 'Users', 'expense', 0.20, 0),
    (NEW.id, new_company_id, 'Loyer', 'hsl(25, 95%, 53%)', 'Home', 'expense', 0.20, 1),
    (NEW.id, new_company_id, 'Fournisseurs', 'hsl(262, 83%, 58%)', 'ShoppingCart', 'expense', 0.20, 2),
    (NEW.id, new_company_id, 'Marketing', 'hsl(330, 80%, 60%)', 'Megaphone', 'expense', 0.20, 3),
    (NEW.id, new_company_id, 'Logiciels & Abonnements', 'hsl(180, 60%, 45%)', 'Monitor', 'expense', 0.20, 4),
    (NEW.id, new_company_id, 'Virement intercompte', 'hsl(210, 10%, 60%)', 'ArrowLeftRight', 'expense', 0, 99);

  RETURN NEW;
END;
$function$;
