
-- ============================================================
-- PR2 — Audit log & rollback
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NULL,                          -- NULL = run multi-règles
  company_id uuid NULL,
  user_id uuid NOT NULL,
  triggered_by text NOT NULL DEFAULT 'manual',-- manual|cron|user|system
  mode text NOT NULL DEFAULT 'apply',         -- apply|reclassify|suggest_only
  total_matched integer NOT NULL DEFAULT 0,
  total_applied integer NOT NULL DEFAULT 0,
  total_skipped_conflict integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',     -- running|completed|failed|rolled_back
  can_rollback boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  rolled_back_at timestamptz NULL,
  rolled_back_by uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_company ON public.automation_runs(company_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON public.automation_runs(rule_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user ON public.automation_runs(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.automation_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  rule_id uuid NULL,
  transaction_id uuid NOT NULL,
  previous_category_id uuid NULL,
  new_category_id uuid NULL,
  confidence numeric NULL,
  confidence_source text NULL,                -- exact_rule|fingerprint_history|merchant_history|llm
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'applied',     -- applied|skipped_conflict|rolled_back|corrected
  rolled_back_at timestamptz NULL,
  corrected_at timestamptz NULL,
  corrected_to_category_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_run_items_run ON public.automation_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_run_items_transaction ON public.automation_run_items(transaction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_items_rule ON public.automation_run_items(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_items_status ON public.automation_run_items(status);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_run_items ENABLE ROW LEVEL SECURITY;

-- RLS automation_runs
CREATE POLICY "Service role manages runs"
  ON public.automation_runs FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Users view accessible runs"
  ON public.automation_runs FOR SELECT
  USING (
    auth.uid() = user_id
    OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
  );

-- RLS automation_run_items (via parent run)
CREATE POLICY "Service role manages run items"
  ON public.automation_run_items FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Users view accessible run items"
  ON public.automation_run_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.automation_runs r
      WHERE r.id = automation_run_items.run_id
        AND (r.user_id = auth.uid()
             OR (r.company_id IS NOT NULL AND has_company_access(auth.uid(), r.company_id)))
    )
  );

-- ============================================================
-- PR3 — Priorité, conflits, scoring
-- ============================================================

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS specificity_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_from text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS validated_examples_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS false_positive_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_correction_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_automation_rules_priority
  ON public.automation_rules(company_id, is_active, priority DESC, specificity_score DESC, created_at ASC);
