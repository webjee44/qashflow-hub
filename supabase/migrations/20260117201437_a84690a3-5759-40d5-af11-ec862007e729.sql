-- Table pour les snapshots/versions du business plan
CREATE TABLE public.bp_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table pour les variations par ligne dans les scénarios
CREATE TABLE public.bp_scenario_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES public.bp_scenarios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL, -- 'revenue_stream', 'fixed_expense', 'variable_expense', 'personnel', 'investment'
  item_id UUID NOT NULL,
  override_type TEXT NOT NULL, -- 'multiplier', 'fixed_value', 'disabled'
  override_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(scenario_id, item_type, item_id)
);

-- Enable RLS
ALTER TABLE public.bp_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp_scenario_overrides ENABLE ROW LEVEL SECURITY;

-- Policies for bp_snapshots
CREATE POLICY "Users can view their own snapshots" 
ON public.bp_snapshots FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own snapshots" 
ON public.bp_snapshots FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own snapshots" 
ON public.bp_snapshots FOR DELETE 
USING (auth.uid() = user_id);

-- Policies for bp_scenario_overrides
CREATE POLICY "Users can view their own overrides" 
ON public.bp_scenario_overrides FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own overrides" 
ON public.bp_scenario_overrides FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own overrides" 
ON public.bp_scenario_overrides FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own overrides" 
ON public.bp_scenario_overrides FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_bp_scenario_overrides_updated_at
BEFORE UPDATE ON public.bp_scenario_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();