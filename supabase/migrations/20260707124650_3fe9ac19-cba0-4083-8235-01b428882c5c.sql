ALTER TABLE public.automation_run_items
  DROP CONSTRAINT IF EXISTS automation_run_items_status_check;

ALTER TABLE public.automation_run_items
  ADD CONSTRAINT automation_run_items_status_check
  CHECK (status IN (
    'applied',
    'skipped_conflict',
    'skipped_type_mismatch',
    'skipped_invalid_target',
    'rolled_back',
    'corrected'
  ));