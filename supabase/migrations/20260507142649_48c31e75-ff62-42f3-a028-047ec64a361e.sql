CREATE TABLE IF NOT EXISTS public.company_bridge_account_identity_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bridge_user_uuid text,
  account_identity text NOT NULL,
  account_type text,
  reason text,
  excluded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, account_identity)
);

CREATE INDEX IF NOT EXISTS idx_cba_identity_exclusions_company
  ON public.company_bridge_account_identity_exclusions(company_id);

CREATE INDEX IF NOT EXISTS idx_cba_identity_exclusions_identity
  ON public.company_bridge_account_identity_exclusions(company_id, account_identity, bridge_user_uuid);

ALTER TABLE public.company_bridge_account_identity_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view bank identity exclusions" ON public.company_bridge_account_identity_exclusions;
CREATE POLICY "Company members can view bank identity exclusions"
ON public.company_bridge_account_identity_exclusions
FOR SELECT
TO authenticated
USING (
  public.has_company_access(auth.uid(), company_id)
  OR public.is_superadmin(auth.uid())
);

DROP POLICY IF EXISTS "Company admins can manage bank identity exclusions" ON public.company_bridge_account_identity_exclusions;
CREATE POLICY "Company admins can manage bank identity exclusions"
ON public.company_bridge_account_identity_exclusions
FOR ALL
TO authenticated
USING (
  public.has_company_access(auth.uid(), company_id)
  OR public.is_superadmin(auth.uid())
)
WITH CHECK (
  public.has_company_access(auth.uid(), company_id)
  OR public.is_superadmin(auth.uid())
);

DROP TRIGGER IF EXISTS update_company_bridge_account_identity_exclusions_updated_at
ON public.company_bridge_account_identity_exclusions;
CREATE TRIGGER update_company_bridge_account_identity_exclusions_updated_at
BEFORE UPDATE ON public.company_bridge_account_identity_exclusions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_company_bridge_identity_exclusion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_identity text;
  v_bridge_user_uuid text;
  v_reason text;
  v_excluded_by uuid;
BEGIN
  SELECT ba.account_identity, ba.bridge_user_uuid
  INTO v_identity, v_bridge_user_uuid
  FROM public.bridge_accounts ba
  WHERE ba.bridge_account_id = NEW.bridge_account_id
  LIMIT 1;

  IF v_identity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.reason, e.excluded_by
  INTO v_reason, v_excluded_by
  FROM public.company_bridge_account_identity_exclusions e
  WHERE e.company_id = NEW.company_id
    AND e.account_identity = v_identity
    AND (e.bridge_user_uuid IS NULL OR e.bridge_user_uuid = v_bridge_user_uuid)
  LIMIT 1;

  IF FOUND THEN
    NEW.status := 'excluded';
    NEW.excluded_at := COALESCE(NEW.excluded_at, now());
    NEW.excluded_by := COALESCE(NEW.excluded_by, v_excluded_by);
    NEW.exclusion_reason := COALESCE(NEW.exclusion_reason, v_reason, 'Compte exclu durablement');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_company_bridge_identity_exclusion_trigger
ON public.company_bridge_accounts;
CREATE TRIGGER enforce_company_bridge_identity_exclusion_trigger
BEFORE INSERT OR UPDATE OF company_id, bridge_account_id, status
ON public.company_bridge_accounts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_company_bridge_identity_exclusion();

CREATE OR REPLACE FUNCTION public.apply_bridge_identity_exclusions_for_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.account_identity IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.company_bridge_accounts cba
  SET
    status = 'excluded',
    excluded_at = COALESCE(cba.excluded_at, now()),
    excluded_by = COALESCE(cba.excluded_by, e.excluded_by),
    exclusion_reason = COALESCE(cba.exclusion_reason, e.reason, 'Compte exclu durablement')
  FROM public.company_bridge_account_identity_exclusions e
  WHERE cba.bridge_account_id = NEW.bridge_account_id
    AND e.company_id = cba.company_id
    AND e.account_identity = NEW.account_identity
    AND (e.bridge_user_uuid IS NULL OR e.bridge_user_uuid = NEW.bridge_user_uuid)
    AND cba.status <> 'excluded';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_bridge_identity_exclusions_for_account_trigger
ON public.bridge_accounts;
CREATE TRIGGER apply_bridge_identity_exclusions_for_account_trigger
AFTER INSERT OR UPDATE OF account_identity, bridge_user_uuid
ON public.bridge_accounts
FOR EACH ROW
EXECUTE FUNCTION public.apply_bridge_identity_exclusions_for_account();

-- Convertit toutes les exclusions actuelles en verrou d'identité durable.
INSERT INTO public.company_bridge_account_identity_exclusions (
  company_id,
  bridge_user_uuid,
  account_identity,
  account_type,
  reason,
  excluded_by
)
SELECT DISTINCT ON (cba.company_id, ba.account_identity)
  cba.company_id,
  ba.bridge_user_uuid,
  ba.account_identity,
  ba.account_type,
  COALESCE(cba.exclusion_reason, 'Compte exclu durablement'),
  cba.excluded_by
FROM public.company_bridge_accounts cba
JOIN public.bridge_accounts ba ON ba.bridge_account_id = cba.bridge_account_id
WHERE cba.status = 'excluded'
  AND ba.account_identity IS NOT NULL
ON CONFLICT (company_id, account_identity) DO UPDATE
SET
  bridge_user_uuid = COALESCE(EXCLUDED.bridge_user_uuid, public.company_bridge_account_identity_exclusions.bridge_user_uuid),
  account_type = COALESCE(EXCLUDED.account_type, public.company_bridge_account_identity_exclusions.account_type),
  reason = COALESCE(EXCLUDED.reason, public.company_bridge_account_identity_exclusions.reason),
  excluded_by = COALESCE(EXCLUDED.excluded_by, public.company_bridge_account_identity_exclusions.excluded_by),
  updated_at = now();

-- SAS Vapeclub : les trois comptes visibles dans la capture sont exclus par identité,
-- pas seulement par identifiant technique Bridge, pour qu'ils ne reviennent pas au prochain sync.
WITH vape AS (
  SELECT id
  FROM public.companies
  WHERE name = 'SAS Vapeclub'
    AND deleted_at IS NULL
  LIMIT 1
), accounts_to_lock AS (
  SELECT ba.bridge_account_id, ba.bridge_user_uuid, ba.account_identity, ba.account_type
  FROM public.bridge_accounts ba
  WHERE ba.bridge_account_id IN (61720938, 60568536, 60568535)
    AND ba.account_identity IS NOT NULL
)
INSERT INTO public.company_bridge_account_identity_exclusions (
  company_id,
  bridge_user_uuid,
  account_identity,
  account_type,
  reason
)
SELECT
  vape.id,
  accounts_to_lock.bridge_user_uuid,
  accounts_to_lock.account_identity,
  accounts_to_lock.account_type,
  'Compte exclu durablement de SAS Vapeclub'
FROM vape
CROSS JOIN accounts_to_lock
ON CONFLICT (company_id, account_identity) DO UPDATE
SET
  bridge_user_uuid = EXCLUDED.bridge_user_uuid,
  account_type = EXCLUDED.account_type,
  reason = EXCLUDED.reason,
  updated_at = now();

WITH vape AS (
  SELECT id
  FROM public.companies
  WHERE name = 'SAS Vapeclub'
    AND deleted_at IS NULL
  LIMIT 1
)
UPDATE public.company_bridge_accounts cba
SET
  status = 'excluded',
  excluded_at = COALESCE(cba.excluded_at, now()),
  exclusion_reason = 'Compte exclu durablement de SAS Vapeclub'
FROM vape
WHERE cba.company_id = vape.id
  AND cba.bridge_account_id IN (61720938, 60568536, 60568535);

DO $$
DECLARE
  v_vape_company_id uuid;
BEGIN
  SELECT id INTO v_vape_company_id
  FROM public.companies
  WHERE name = 'SAS Vapeclub'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_vape_company_id IS NOT NULL THEN
    PERFORM public.recompute_company_bank_stats(v_vape_company_id);
  END IF;
END;
$$;