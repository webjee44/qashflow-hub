-- Table for storing multiple conditions per automation rule
CREATE TABLE public.automation_rule_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  condition_field text NOT NULL, -- 'description' | 'amount' | 'type'
  condition_operator text NOT NULL, -- 'contains' | 'equals' | 'greater_than' | 'less_than' | 'between'
  condition_value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_rule_conditions ENABLE ROW LEVEL SECURITY;

-- RLS policies mirroring parent table
CREATE POLICY "Users can view conditions for their rules"
ON public.automation_rule_conditions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.automation_rules 
  WHERE automation_rules.id = automation_rule_conditions.rule_id 
    AND automation_rules.user_id = auth.uid()
));

CREATE POLICY "Users can create conditions for their rules"
ON public.automation_rule_conditions
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.automation_rules 
  WHERE automation_rules.id = automation_rule_conditions.rule_id 
    AND automation_rules.user_id = auth.uid()
));

CREATE POLICY "Users can update conditions for their rules"
ON public.automation_rule_conditions
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.automation_rules 
  WHERE automation_rules.id = automation_rule_conditions.rule_id 
    AND automation_rules.user_id = auth.uid()
));

CREATE POLICY "Users can delete conditions for their rules"
ON public.automation_rule_conditions
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.automation_rules 
  WHERE automation_rules.id = automation_rule_conditions.rule_id 
    AND automation_rules.user_id = auth.uid()
));

-- Migrate existing rules data to the new conditions table
INSERT INTO public.automation_rule_conditions (rule_id, condition_field, condition_operator, condition_value)
SELECT id, condition_field, condition_operator, condition_value 
FROM public.automation_rules
WHERE condition_value IS NOT NULL AND condition_value != '';