-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  pennylane_api_key TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own companies"
  ON public.companies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own companies"
  ON public.companies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own companies"
  ON public.companies FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add company_id to transactions
ALTER TABLE public.transactions 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add company_id to categories
ALTER TABLE public.categories 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add company_id to automation_rules
ALTER TABLE public.automation_rules 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add company_id to category_forecasts
ALTER TABLE public.category_forecasts 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add company_id to forecasts
ALTER TABLE public.forecasts 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;