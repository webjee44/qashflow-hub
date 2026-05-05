CREATE OR REPLACE FUNCTION public.recompute_company_bank_stats(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND COALESCE(ba.is_ignored, false) = false
    GROUP BY cba.company_id
  ) AS stats
  WHERE c.id = p_company_id AND stats.company_id = c.id;

  IF NOT FOUND THEN
    UPDATE public.companies
    SET
      bank_balance = 0,
      bridge_accounts_count = 0,
      bank_balance_updated_at = now()
    WHERE id = p_company_id;
  END IF;
END;
$function$;