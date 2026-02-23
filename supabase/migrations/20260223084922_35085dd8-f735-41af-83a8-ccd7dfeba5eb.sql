
-- Fix deduplication trigger to include bank_account_name in signature
CREATE OR REPLACE FUNCTION public.prevent_duplicate_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE description = NEW.description
      AND date = NEW.date
      AND amount = NEW.amount
      AND type = NEW.type
      AND company_id = NEW.company_id
      AND COALESCE(bank_account_name, '') = COALESCE(NEW.bank_account_name, '')
      AND deleted_at IS NULL
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Doublon detecte: transaction avec meme signature (description, date, amount, type, company_id, bank_account_name) existe deja';
  END IF;
  RETURN NEW;
END;
$$;
