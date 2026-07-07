
CREATE TABLE public.intercompany_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_out_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  tx_in_id  uuid NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  company_out uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_in  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  score numeric NOT NULL,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('auto_matched','suggested','confirmed','rejected')),
  matched_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid NULL,
  decided_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intercompany_links_diff_company CHECK (company_out <> company_in)
);

CREATE INDEX intercompany_links_pair_idx ON public.intercompany_links(company_out, company_in);
CREATE INDEX intercompany_links_status_idx ON public.intercompany_links(status);
CREATE INDEX intercompany_links_company_in_idx ON public.intercompany_links(company_in);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intercompany_links TO authenticated;
GRANT ALL ON public.intercompany_links TO service_role;

ALTER TABLE public.intercompany_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intercompany_links_select_team"
  ON public.intercompany_links FOR SELECT
  TO authenticated
  USING (
    public.has_company_access(auth.uid(), company_out)
    OR public.has_company_access(auth.uid(), company_in)
  );

CREATE POLICY "intercompany_links_insert_team"
  ON public.intercompany_links FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_company_access(auth.uid(), company_out)
    AND public.has_company_access(auth.uid(), company_in)
  );

CREATE POLICY "intercompany_links_update_team"
  ON public.intercompany_links FOR UPDATE
  TO authenticated
  USING (
    public.has_company_access(auth.uid(), company_out)
    AND public.has_company_access(auth.uid(), company_in)
  )
  WITH CHECK (
    public.has_company_access(auth.uid(), company_out)
    AND public.has_company_access(auth.uid(), company_in)
  );

CREATE POLICY "intercompany_links_delete_team"
  ON public.intercompany_links FOR DELETE
  TO authenticated
  USING (
    public.has_company_access(auth.uid(), company_out)
    AND public.has_company_access(auth.uid(), company_in)
  );

CREATE TRIGGER trg_intercompany_links_updated_at
  BEFORE UPDATE ON public.intercompany_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
