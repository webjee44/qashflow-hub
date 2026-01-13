-- Create table for variable expenses (charges variables)
CREATE TABLE public.bp_variable_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID DEFAULT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'cogs',
  calculation_type TEXT DEFAULT 'percentage',
  linked_revenue_stream_id UUID DEFAULT NULL,
  percentage NUMERIC DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  vat_rate NUMERIC DEFAULT 0.20,
  is_vat_deductible BOOLEAN DEFAULT true,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bp_variable_expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own variable expenses"
ON public.bp_variable_expenses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own variable expenses"
ON public.bp_variable_expenses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own variable expenses"
ON public.bp_variable_expenses
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own variable expenses"
ON public.bp_variable_expenses
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_bp_variable_expenses_updated_at
BEFORE UPDATE ON public.bp_variable_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();