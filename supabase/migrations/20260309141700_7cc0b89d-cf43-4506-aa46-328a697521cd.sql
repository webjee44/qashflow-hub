
-- Create bank_balance_snapshots table
CREATE TABLE public.bank_balance_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bridge_account_id INTEGER NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bridge_account_id, snapshot_date)
);

-- Enable RLS
ALTER TABLE public.bank_balance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can read snapshots for companies they have access to
CREATE POLICY "Users can read own company snapshots"
  ON public.bank_balance_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

-- Service role can insert/update (via edge function)
CREATE POLICY "Service role can manage snapshots"
  ON public.bank_balance_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups by company and date
CREATE INDEX idx_bank_balance_snapshots_company_date 
  ON public.bank_balance_snapshots(company_id, snapshot_date DESC);
