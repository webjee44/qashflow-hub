CREATE UNIQUE INDEX unique_bp_per_company 
ON business_plans (company_id) 
WHERE company_id IS NOT NULL;