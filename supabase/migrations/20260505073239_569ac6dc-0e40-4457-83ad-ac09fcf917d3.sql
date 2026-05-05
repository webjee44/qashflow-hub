-- Align automation_rule_conditions RLS with automation_rules access contract.
-- Root cause: previous policies only allowed the rule's original creator (user_id = auth.uid())
-- to mutate conditions, while the rule itself is editable by all company members
-- via has_company_access(). This caused silent RLS rejections when a non-owner
-- member edited a shared rule, dropping extra conditions (amount, bank account).

DROP POLICY IF EXISTS "Users can view conditions for their rules" ON public.automation_rule_conditions;
DROP POLICY IF EXISTS "Users can create conditions for their rules" ON public.automation_rule_conditions;
DROP POLICY IF EXISTS "Users can update conditions for their rules" ON public.automation_rule_conditions;
DROP POLICY IF EXISTS "Users can delete conditions for their rules" ON public.automation_rule_conditions;

CREATE POLICY "Users can view accessible rule conditions"
ON public.automation_rule_conditions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.automation_rules r
    WHERE r.id = automation_rule_conditions.rule_id
      AND (
        r.user_id = auth.uid()
        OR (r.company_id IS NOT NULL AND public.has_company_access(auth.uid(), r.company_id))
      )
  )
);

CREATE POLICY "Users can create accessible rule conditions"
ON public.automation_rule_conditions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.automation_rules r
    WHERE r.id = automation_rule_conditions.rule_id
      AND (
        r.user_id = auth.uid()
        OR (r.company_id IS NOT NULL AND public.has_company_access(auth.uid(), r.company_id))
      )
  )
);

CREATE POLICY "Users can update accessible rule conditions"
ON public.automation_rule_conditions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.automation_rules r
    WHERE r.id = automation_rule_conditions.rule_id
      AND (
        r.user_id = auth.uid()
        OR (r.company_id IS NOT NULL AND public.has_company_access(auth.uid(), r.company_id))
      )
  )
);

CREATE POLICY "Users can delete accessible rule conditions"
ON public.automation_rule_conditions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.automation_rules r
    WHERE r.id = automation_rule_conditions.rule_id
      AND (
        r.user_id = auth.uid()
        OR (r.company_id IS NOT NULL AND public.has_company_access(auth.uid(), r.company_id))
      )
  )
);