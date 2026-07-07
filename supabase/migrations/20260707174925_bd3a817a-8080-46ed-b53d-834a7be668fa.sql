
CREATE TABLE public.intercompany_match_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('backfill','incremental')),
  triggered_by text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failed')),
  candidates_scanned integer NOT NULL DEFAULT 0,
  auto_matched integer NOT NULL DEFAULT 0,
  suggested integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  skipped_existing integer NOT NULL DEFAULT 0,
  windows_processed integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intercompany_match_runs_started_idx ON public.intercompany_match_runs(started_at DESC);

GRANT SELECT ON public.intercompany_match_runs TO authenticated;
GRANT ALL ON public.intercompany_match_runs TO service_role;

ALTER TABLE public.intercompany_match_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intercompany_match_runs_superadmin_select"
  ON public.intercompany_match_runs FOR SELECT
  TO authenticated
  USING (public.is_superadmin(auth.uid()));
