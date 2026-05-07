
-- ============================================================
-- BLACKLIST DB POUR COMPTES BRIDGE
-- ============================================================

-- 1. Table de blacklist
CREATE TABLE IF NOT EXISTS public.bridge_account_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bridge_account_id bigint,
  bridge_item_id bigint,
  bridge_user_uuid text,
  iban text,
  iban_last4 text,
  account_identity text,
  reason text,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bab_company_account 
  ON public.bridge_account_blocks(company_id, bridge_account_id) 
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bab_company_active 
  ON public.bridge_account_blocks(company_id) 
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bab_company_identity 
  ON public.bridge_account_blocks(company_id, account_identity) 
  WHERE is_active = true;

ALTER TABLE public.bridge_account_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bab_select_company_access" ON public.bridge_account_blocks
  FOR SELECT USING (
    public.has_company_access(auth.uid(), company_id) 
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "bab_insert_owner_or_admin" ON public.bridge_account_blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id 
        AND (c.user_id = auth.uid() 
             OR EXISTS (
               SELECT 1 FROM public.organization_members om
               WHERE om.organization_id = c.organization_id
                 AND om.user_id = auth.uid()
                 AND om.role IN ('owner','admin')
             ))
    )
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "bab_update_owner_or_admin" ON public.bridge_account_blocks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id 
        AND (c.user_id = auth.uid() 
             OR EXISTS (
               SELECT 1 FROM public.organization_members om
               WHERE om.organization_id = c.organization_id
                 AND om.user_id = auth.uid()
                 AND om.role IN ('owner','admin')
             ))
    )
    OR public.is_superadmin(auth.uid())
  );

CREATE TRIGGER trg_bab_updated_at
  BEFORE UPDATE ON public.bridge_account_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Trigger anti-réactivation sur company_bridge_accounts
CREATE OR REPLACE FUNCTION public.prevent_blocked_bridge_account_activation()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_identity text;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Match direct par bridge_account_id
  IF EXISTS (
    SELECT 1 FROM public.bridge_account_blocks b
    WHERE b.company_id = NEW.company_id
      AND b.bridge_account_id = NEW.bridge_account_id
      AND b.is_active = true
  ) THEN
    NEW.status := 'excluded';
    NEW.excluded_at := COALESCE(NEW.excluded_at, now());
    NEW.exclusion_reason := COALESCE(NEW.exclusion_reason, 'Compte bloqué : verrou DB anti-réactivation');
    RETURN NEW;
  END IF;

  -- Match par account_identity (résiste au changement de bridge_account_id)
  SELECT account_identity INTO v_identity
  FROM public.bridge_accounts
  WHERE bridge_account_id = NEW.bridge_account_id
  LIMIT 1;

  IF v_identity IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bridge_account_blocks b
    WHERE b.company_id = NEW.company_id
      AND b.account_identity = v_identity
      AND b.is_active = true
  ) THEN
    NEW.status := 'excluded';
    NEW.excluded_at := COALESCE(NEW.excluded_at, now());
    NEW.exclusion_reason := COALESCE(NEW.exclusion_reason, 'Compte bloqué : verrou DB anti-réactivation (identity match)');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_blocked_bridge_account_activation ON public.company_bridge_accounts;
CREATE TRIGGER trg_prevent_blocked_bridge_account_activation
  BEFORE INSERT OR UPDATE ON public.company_bridge_accounts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_blocked_bridge_account_activation();

-- 3. Vue centrale : exclure les comptes blacklistés (double sécurité)
CREATE OR REPLACE VIEW public.company_active_bridge_accounts AS
SELECT cba.company_id,
       cba.bridge_account_id,
       cba.status AS assignment_status,
       cba.excluded_at,
       cba.exclusion_reason,
       ba.name,
       ba.iban,
       ba.balance,
       ba.account_type,
       ba.bridge_item_id,
       ba.bridge_user_uuid,
       ba.bank_name,
       ba.lifecycle_status,
       ba.item_status,
       ba.last_sync_at,
       ba.updated_at
FROM public.company_bridge_accounts cba
JOIN public.bridge_accounts ba USING (bridge_account_id)
WHERE cba.status = 'active'
  AND ba.lifecycle_status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.bridge_account_blocks b
    WHERE b.company_id = cba.company_id
      AND b.is_active = true
      AND (b.bridge_account_id = cba.bridge_account_id
           OR b.account_identity = ba.account_identity)
  );

-- 4. Trigger soft-delete transactions à l'insertion d'un block
CREATE OR REPLACE FUNCTION public.apply_block_to_existing_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  -- Force exclusion des company_bridge_accounts existants
  UPDATE public.company_bridge_accounts cba
  SET status = 'excluded',
      excluded_at = COALESCE(cba.excluded_at, now()),
      exclusion_reason = COALESCE(cba.exclusion_reason, 'Compte bloqué : ' || COALESCE(NEW.reason, 'verrou DB'))
  WHERE cba.company_id = NEW.company_id
    AND cba.status = 'active'
    AND (
      cba.bridge_account_id = NEW.bridge_account_id
      OR EXISTS (
        SELECT 1 FROM public.bridge_accounts ba
        WHERE ba.bridge_account_id = cba.bridge_account_id
          AND ba.account_identity = NEW.account_identity
          AND NEW.account_identity IS NOT NULL
      )
    );

  -- Soft-delete transactions par bridge_account_id uniquement
  UPDATE public.transactions t
  SET deleted_at = now(), updated_at = now()
  WHERE t.company_id = NEW.company_id
    AND t.deleted_at IS NULL
    AND (
      t.bridge_account_id = NEW.bridge_account_id
      OR t.bridge_account_id IN (
        SELECT ba.bridge_account_id FROM public.bridge_accounts ba
        WHERE ba.account_identity = NEW.account_identity
          AND NEW.account_identity IS NOT NULL
      )
    );

  PERFORM public.recompute_company_bank_stats(NEW.company_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_block_to_existing_data ON public.bridge_account_blocks;
CREATE TRIGGER trg_apply_block_to_existing_data
  AFTER INSERT OR UPDATE OF is_active ON public.bridge_account_blocks
  FOR EACH ROW EXECUTE FUNCTION public.apply_block_to_existing_data();
