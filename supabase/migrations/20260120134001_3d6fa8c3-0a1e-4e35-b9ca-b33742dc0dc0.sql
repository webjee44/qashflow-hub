
-- Function to delete an organization and all its related data
CREATE OR REPLACE FUNCTION public.delete_organization_cascade(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_ids uuid[];
  v_user_ids uuid[];
BEGIN
  -- Check if user is superadmin
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;

  -- Get company IDs for this organization
  SELECT array_agg(id) INTO v_company_ids
  FROM companies WHERE organization_id = _org_id;

  -- Get user IDs of organization members
  SELECT array_agg(DISTINCT user_id) INTO v_user_ids
  FROM organization_members WHERE organization_id = _org_id;

  -- 1. Delete all company-related data
  IF v_company_ids IS NOT NULL THEN
    -- BP related tables
    DELETE FROM bp_bonuses WHERE personnel_id IN (SELECT id FROM bp_personnel WHERE company_id = ANY(v_company_ids));
    DELETE FROM bp_scenario_overrides WHERE scenario_id IN (SELECT id FROM bp_scenarios WHERE company_id = ANY(v_company_ids));
    DELETE FROM bp_revenue_forecasts WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_directors WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_financings WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_fixed_expenses WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_investments WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_notes WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_personnel WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_revenue_streams WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_scenarios WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_settings WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_snapshots WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_stocks WHERE company_id = ANY(v_company_ids);
    DELETE FROM bp_variable_expenses WHERE company_id = ANY(v_company_ids);
    DELETE FROM business_plans WHERE company_id = ANY(v_company_ids);
    
    -- Other company data
    DELETE FROM categories WHERE company_id = ANY(v_company_ids);
    DELETE FROM category_forecasts WHERE company_id = ANY(v_company_ids);
    DELETE FROM forecasts WHERE company_id = ANY(v_company_ids);
    DELETE FROM transactions WHERE company_id = ANY(v_company_ids);
    DELETE FROM automation_rules WHERE company_id = ANY(v_company_ids);
    DELETE FROM company_secrets WHERE company_id = ANY(v_company_ids);
    DELETE FROM company_members WHERE company_id = ANY(v_company_ids);
    DELETE FROM companies WHERE id = ANY(v_company_ids);
  END IF;

  -- 2. Delete organization-related data
  DELETE FROM audit_logs WHERE organization_id = _org_id;
  DELETE FROM subscription_usage WHERE organization_id = _org_id;
  DELETE FROM organization_members WHERE organization_id = _org_id;
  
  -- 3. Delete user profiles and roles
  IF v_user_ids IS NOT NULL THEN
    DELETE FROM profiles WHERE id = ANY(v_user_ids);
    DELETE FROM user_roles WHERE user_id = ANY(v_user_ids);
  END IF;
  
  -- 4. Delete the organization itself
  DELETE FROM organizations WHERE id = _org_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_organization_cascade(uuid) TO authenticated;
