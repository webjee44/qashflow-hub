
-- Table for manual closing balance overrides per month
CREATE TABLE public.balance_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  month DATE NOT NULL,
  balance NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, month)
);

ALTER TABLE public.balance_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible balance overrides"
  ON public.balance_overrides FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can create accessible balance overrides"
  ON public.balance_overrides FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible balance overrides"
  ON public.balance_overrides FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible balance overrides"
  ON public.balance_overrides FOR DELETE
  USING (has_company_access(auth.uid(), company_id));
