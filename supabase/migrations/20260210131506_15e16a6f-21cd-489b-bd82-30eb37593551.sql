
-- ============================================
-- PHASE 1: Nettoyage des doublons existants
-- ============================================

-- 1a. Transferer les categories des anciennes lignes (sans bridge_id) vers les nouvelles (avec bridge_id)
UPDATE public.transactions AS new_tx
SET category_id = old_tx.category_id
FROM public.transactions AS old_tx
WHERE old_tx.bridge_transaction_id IS NULL
  AND new_tx.bridge_transaction_id IS NOT NULL
  AND old_tx.deleted_at IS NULL
  AND new_tx.deleted_at IS NULL
  AND old_tx.description = new_tx.description
  AND old_tx.date = new_tx.date
  AND old_tx.amount = new_tx.amount
  AND old_tx.type = new_tx.type
  AND old_tx.company_id = new_tx.company_id
  AND old_tx.category_id IS NOT NULL
  AND new_tx.category_id IS NULL;

-- 1b. Soft-delete les anciennes lignes qui ont un doublon avec bridge_id
UPDATE public.transactions AS old_tx
SET deleted_at = now()
FROM public.transactions AS new_tx
WHERE old_tx.bridge_transaction_id IS NULL
  AND new_tx.bridge_transaction_id IS NOT NULL
  AND old_tx.deleted_at IS NULL
  AND new_tx.deleted_at IS NULL
  AND old_tx.description = new_tx.description
  AND old_tx.date = new_tx.date
  AND old_tx.amount = new_tx.amount
  AND old_tx.type = new_tx.type
  AND old_tx.company_id = new_tx.company_id;

-- ============================================
-- PHASE 2: Backfill des orphelins
-- ============================================

-- Remplir bridge_transaction_id a partir de pennylane_id (format 'bridge_XXXX')
UPDATE public.transactions
SET bridge_transaction_id = CAST(REPLACE(pennylane_id, 'bridge_', '') AS BIGINT)
WHERE bridge_transaction_id IS NULL
  AND pennylane_id LIKE 'bridge_%'
  AND deleted_at IS NULL;

-- ============================================
-- PHASE 4: Trigger anti-doublon
-- ============================================

-- Fonction de validation
CREATE OR REPLACE FUNCTION public.prevent_duplicate_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE description = NEW.description
      AND date = NEW.date
      AND amount = NEW.amount
      AND type = NEW.type
      AND company_id = NEW.company_id
      AND deleted_at IS NULL
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Doublon detecte: transaction avec meme signature (description, date, amount, type, company_id) existe deja';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT
CREATE TRIGGER trg_prevent_duplicate_transaction
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_transaction();
