
CREATE OR REPLACE FUNCTION public.delete_organization_cascade(_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_ids uuid[];
  v_all_user_ids uuid[];
  v_orphan_user_id uuid;
BEGIN
  -- Check if user is superadmin
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;

  -- Get company IDs for this organization
  SELECT array_agg(id) INTO v_company_ids
  FROM companies WHERE organization_id = _org_id;

  -- Get user IDs of organization members
  SELECT array_agg(DISTINCT user_id) INTO v_all_user_ids
  FROM organization_members WHERE organization_id = _org_id;

  -- 1. Delete all company-related data
  IF v_company_ids IS NOT NULL THEN
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
    
    DELETE FROM category_forecasts WHERE company_id = ANY(v_company_ids);
    DELETE FROM invoices WHERE company_id = ANY(v_company_ids);
    DELETE FROM categories WHERE company_id = ANY(v_company_ids);
    DELETE FROM forecasts WHERE company_id = ANY(v_company_ids);
    DELETE FROM transactions WHERE company_id = ANY(v_company_ids);
    DELETE FROM automation_rules WHERE company_id = ANY(v_company_ids);
    DELETE FROM company_secrets WHERE company_id = ANY(v_company_ids);
    DELETE FROM company_bridge_accounts WHERE company_id = ANY(v_company_ids);
    DELETE FROM bridge_accounts WHERE company_id = ANY(v_company_ids);
    DELETE FROM partner_category_mappings WHERE company_id = ANY(v_company_ids);
    DELETE FROM company_members WHERE company_id = ANY(v_company_ids);
    DELETE FROM companies WHERE id = ANY(v_company_ids);
  END IF;

  -- 2. Delete organization-related data
  DELETE FROM audit_logs WHERE organization_id = _org_id;
  DELETE FROM subscription_usage WHERE organization_id = _org_id;
  DELETE FROM organization_invitations WHERE organization_id = _org_id;
  DELETE FROM organization_members WHERE organization_id = _org_id;
  
  -- 3. Delete the organization itself
  DELETE FROM organizations WHERE id = _org_id;

  -- 4. For each member, check if they belong to another org. If not, delete them entirely.
  IF v_all_user_ids IS NOT NULL THEN
    FOR v_orphan_user_id IN
      SELECT unnest(v_all_user_ids)
      EXCEPT
      SELECT DISTINCT user_id FROM organization_members
    LOOP
      -- This user has no remaining org membership → full cleanup
      DELETE FROM user_roles WHERE user_id = v_orphan_user_id;
      DELETE FROM profiles WHERE id = v_orphan_user_id;
      DELETE FROM auth.users WHERE id = v_orphan_user_id;
    END LOOP;
  END IF;
END;
$function$;
