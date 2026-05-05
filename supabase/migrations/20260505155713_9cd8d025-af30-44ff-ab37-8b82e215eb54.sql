-- Add is_ignored flag on bridge_accounts (single source of truth for "hidden" accounts)
ALTER TABLE public.bridge_accounts
  ADD COLUMN IF NOT EXISTS is_ignored boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bridge_accounts_active
  ON public.bridge_accounts (bridge_user_uuid)
  WHERE is_ignored = false;

-- Cleanup Vapeclub ghost accounts (duplicate reconnection + orphan accounts)
UPDATE public.bridge_accounts
   SET is_ignored = true
 WHERE bridge_account_id IN (61723202, 60568536, 60568535);

DELETE FROM public.company_bridge_accounts
 WHERE bridge_account_id IN (61723202, 60568536, 60568535);