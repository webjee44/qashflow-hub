-- 1. Add is_vat_payment flag to categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_vat_payment boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS categories_one_vat_payment_per_company
  ON public.categories (company_id)
  WHERE is_vat_payment = true;

-- 2. Add vat_regime to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS vat_regime text NOT NULL DEFAULT 'monthly_real';

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_vat_regime_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_vat_regime_check
  CHECK (vat_regime IN ('monthly_real', 'quarterly_real', 'simplified', 'franchise'));

-- 3. Backfill: create "TVA à payer" category for every existing company
INSERT INTO public.categories (
  user_id, company_id, name, color, icon, type, vat_rate, sort_order, is_vat_payment
)
SELECT
  c.user_id,
  c.id,
  'TVA à payer',
  'hsl(210, 10%, 50%)',
  'Receipt',
  'expense'::transaction_type,
  0,
  100,
  true
FROM public.companies c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories cat
    WHERE cat.company_id = c.id AND cat.is_vat_payment = true
  );

-- 4. Update handle_new_user() to seed the VAT category for new accounts
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
  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_invitation_token IS NOT NULL THEN
    SELECT * INTO v_invitation
    FROM public.organization_invitations
    WHERE token = v_invitation_token
      AND expires_at > now()
      AND accepted_at IS NULL;

    IF FOUND THEN
      INSERT INTO public.profiles (id, full_name, onboarding_completed, onboarding_step)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), true, 99);

      INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
      VALUES (v_invitation.organization_id, NEW.id, v_invitation.role, now());

      IF v_invitation.company_ids IS NOT NULL AND array_length(v_invitation.company_ids, 1) > 0 THEN
        INSERT INTO public.company_members (company_id, user_id, invited_by)
        SELECT unnest(v_invitation.company_ids), NEW.id, v_invitation.invited_by;
      ELSE
        INSERT INTO public.company_members (company_id, user_id, invited_by)
        SELECT c.id, NEW.id, v_invitation.invited_by
        FROM public.companies c
        WHERE c.organization_id = v_invitation.organization_id
          AND c.deleted_at IS NULL;
      END IF;

      UPDATE public.organization_invitations
      SET accepted_at = now()
      WHERE id = v_invitation.id;

      RETURN NEW;
    END IF;
  END IF;

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

  INSERT INTO public.categories (user_id, company_id, name, color, icon, type, vat_rate, sort_order, is_vat_payment)
  VALUES
    (NEW.id, new_company_id, 'Ventes', 'hsl(142, 76%, 36%)', 'TrendingUp', 'income', 0.20, 0, false),
    (NEW.id, new_company_id, 'Prestations', 'hsl(221, 83%, 53%)', 'Briefcase', 'income', 0.20, 1, false),
    (NEW.id, new_company_id, 'Salaires', 'hsl(0, 84%, 60%)', 'Users', 'expense', 0.20, 0, false),
    (NEW.id, new_company_id, 'Loyer', 'hsl(25, 95%, 53%)', 'Home', 'expense', 0.20, 1, false),
    (NEW.id, new_company_id, 'Fournisseurs', 'hsl(262, 83%, 58%)', 'ShoppingCart', 'expense', 0.20, 2, false),
    (NEW.id, new_company_id, 'Marketing', 'hsl(330, 80%, 60%)', 'Megaphone', 'expense', 0.20, 3, false),
    (NEW.id, new_company_id, 'Logiciels & Abonnements', 'hsl(180, 60%, 45%)', 'Monitor', 'expense', 0.20, 4, false),
    (NEW.id, new_company_id, 'Virement intercompte', 'hsl(210, 10%, 60%)', 'ArrowLeftRight', 'expense', 0, 99, false),
    (NEW.id, new_company_id, 'TVA à payer', 'hsl(210, 10%, 50%)', 'Receipt', 'expense', 0, 100, true);

  RETURN NEW;
END;
$function$;