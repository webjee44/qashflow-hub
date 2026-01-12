-- Create a separate table for company secrets with strict access controls
CREATE TABLE public.company_secrets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  secret_type text NOT NULL DEFAULT 'pennylane_api_key',
  encrypted_value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, secret_type)
);

-- Enable RLS
ALTER TABLE public.company_secrets ENABLE ROW LEVEL SECURITY;

-- NO SELECT policy for regular users - only service_role can read
-- This means only edge functions can access the actual API keys

-- Users can only insert their own company secrets
CREATE POLICY "Users can insert secrets for their companies"
ON public.company_secrets
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_id AND user_id = auth.uid()
  )
);

-- Users can update their own company secrets
CREATE POLICY "Users can update secrets for their companies"
ON public.company_secrets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_id AND user_id = auth.uid()
  )
);

-- Users can delete their own company secrets
CREATE POLICY "Users can delete secrets for their companies"
ON public.company_secrets
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_id AND user_id = auth.uid()
  )
);

-- Create a function to check if a company has a secret configured (without exposing the value)
CREATE OR REPLACE FUNCTION public.company_has_secret(p_company_id uuid, p_secret_type text DEFAULT 'pennylane_api_key')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_secrets
    WHERE company_id = p_company_id AND secret_type = p_secret_type
  )
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_company_secrets_updated_at
  BEFORE UPDATE ON public.company_secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing API keys from companies table to company_secrets
INSERT INTO public.company_secrets (company_id, secret_type, encrypted_value)
SELECT id, 'pennylane_api_key', pennylane_api_key
FROM public.companies
WHERE pennylane_api_key IS NOT NULL;

-- Remove the insecure column from companies table
ALTER TABLE public.companies DROP COLUMN pennylane_api_key;