-- Table de liaison entre sociétés et comptes Bridge spécifiques
-- Permet d'assigner des comptes Bridge spécifiques à chaque société
CREATE TABLE public.company_bridge_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bridge_account_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, bridge_account_id)
);

-- Enable RLS
ALTER TABLE public.company_bridge_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: users can view accounts for their companies
CREATE POLICY "Users can view their company bridge accounts"
  ON public.company_bridge_accounts FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

-- Policy: users can insert accounts for their companies
CREATE POLICY "Users can insert their company bridge accounts"
  ON public.company_bridge_accounts FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

-- Policy: users can delete accounts for their companies
CREATE POLICY "Users can delete their company bridge accounts"
  ON public.company_bridge_accounts FOR DELETE
  USING (has_company_access(auth.uid(), company_id));

-- Index for faster queries
CREATE INDEX idx_company_bridge_accounts_company_id ON public.company_bridge_accounts(company_id);
CREATE INDEX idx_company_bridge_accounts_bridge_account_id ON public.company_bridge_accounts(bridge_account_id);