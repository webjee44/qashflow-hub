CREATE OR REPLACE FUNCTION public.enforce_bridge_transaction_active_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.bridge_account_id IS NULL OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_bridge_accounts cba
    JOIN public.bridge_accounts ba ON ba.bridge_account_id = cba.bridge_account_id
    WHERE cba.company_id = NEW.company_id
      AND cba.bridge_account_id = NEW.bridge_account_id
      AND cba.status = 'active'
      AND ba.lifecycle_status = 'active'
  ) THEN
    NEW.deleted_at := COALESCE(NEW.deleted_at, now());
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_bridge_transaction_active_assignment_trigger ON public.transactions;
CREATE TRIGGER enforce_bridge_transaction_active_assignment_trigger
BEFORE INSERT OR UPDATE OF company_id, bridge_account_id, deleted_at
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_bridge_transaction_active_assignment();

CREATE OR REPLACE FUNCTION public.soft_delete_transactions_on_cba_exclusion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'excluded' THEN
    UPDATE public.transactions
    SET deleted_at = COALESCE(deleted_at, now()),
        updated_at = now()
    WHERE company_id = NEW.company_id
      AND bridge_account_id = NEW.bridge_account_id
      AND deleted_at IS NULL;
  END IF;

  PERFORM public.recompute_company_bank_stats(NEW.company_id);
  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    PERFORM public.recompute_company_bank_stats(OLD.company_id);
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS soft_delete_transactions_on_cba_exclusion_trigger ON public.company_bridge_accounts;
CREATE TRIGGER soft_delete_transactions_on_cba_exclusion_trigger
AFTER INSERT OR UPDATE OF status, company_id, bridge_account_id
ON public.company_bridge_accounts
FOR EACH ROW
EXECUTE FUNCTION public.soft_delete_transactions_on_cba_exclusion();