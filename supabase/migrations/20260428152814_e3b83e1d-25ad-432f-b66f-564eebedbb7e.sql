-- ============================================
-- Source de vérité unique pour bank_balance & bridge_accounts_count
-- ============================================
-- Les colonnes companies.bank_balance et companies.bridge_accounts_count
-- sont des dénormalisations de company_bridge_accounts JOIN bridge_accounts.
-- Cette migration centralise le calcul dans une fonction et le déclenche
-- automatiquement via des triggers, supprimant 3 implémentations divergentes
-- dans les edge functions (bridge-sync, bridge-webhook, bridge-accounts).

-- 1. Fonction de recalcul atomique
CREATE OR REPLACE FUNCTION public.recompute_company_bank_stats(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.companies c
  SET
    bank_balance = COALESCE(stats.total_balance, 0),
    bridge_accounts_count = COALESCE(stats.total_count, 0),
    bank_balance_updated_at = now()
  FROM (
    SELECT
      cba.company_id,
      SUM(ba.balance)::numeric AS total_balance,
      COUNT(ba.bridge_account_id)::integer AS total_count
    FROM public.company_bridge_accounts cba
    LEFT JOIN public.bridge_accounts ba
      ON ba.bridge_account_id = cba.bridge_account_id
    WHERE cba.company_id = p_company_id
    GROUP BY cba.company_id
  ) AS stats
  WHERE c.id = p_company_id AND stats.company_id = c.id;

  -- Si aucune ligne n'est retournée par stats (zéro assignation), on remet à zéro
  IF NOT FOUND THEN
    UPDATE public.companies
    SET
      bank_balance = 0,
      bridge_accounts_count = 0,
      bank_balance_updated_at = now()
    WHERE id = p_company_id;
  END IF;
END;
$$;

-- 2. Trigger sur company_bridge_accounts (assignation/désassignation)
CREATE OR REPLACE FUNCTION public.trg_recompute_on_cba_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_company_bank_stats(NEW.company_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recompute_company_bank_stats(NEW.company_id);
    IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
      PERFORM public.recompute_company_bank_stats(OLD.company_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_company_bank_stats(OLD.company_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recompute_company_stats_on_cba ON public.company_bridge_accounts;
CREATE TRIGGER recompute_company_stats_on_cba
AFTER INSERT OR UPDATE OR DELETE ON public.company_bridge_accounts
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_on_cba_change();

-- 3. Trigger sur bridge_accounts (changement de balance ou suppression)
CREATE OR REPLACE FUNCTION public.trg_recompute_on_ba_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_company_id uuid;
  target_account_id bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_account_id := OLD.bridge_account_id;
  ELSE
    target_account_id := NEW.bridge_account_id;
    -- Sur UPDATE, ne recalculer que si balance a changé
    IF TG_OP = 'UPDATE' AND OLD.balance IS NOT DISTINCT FROM NEW.balance THEN
      RETURN NULL;
    END IF;
  END IF;

  FOR affected_company_id IN
    SELECT DISTINCT cba.company_id
    FROM public.company_bridge_accounts cba
    WHERE cba.bridge_account_id = target_account_id
  LOOP
    PERFORM public.recompute_company_bank_stats(affected_company_id);
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recompute_company_stats_on_ba ON public.bridge_accounts;
CREATE TRIGGER recompute_company_stats_on_ba
AFTER INSERT OR UPDATE OR DELETE ON public.bridge_accounts
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_on_ba_change();

-- 4. Réconciliation one-shot pour toutes les sociétés existantes
DO $$
DECLARE
  c_id uuid;
BEGIN
  FOR c_id IN SELECT id FROM public.companies WHERE deleted_at IS NULL
  LOOP
    PERFORM public.recompute_company_bank_stats(c_id);
  END LOOP;
END;
$$;