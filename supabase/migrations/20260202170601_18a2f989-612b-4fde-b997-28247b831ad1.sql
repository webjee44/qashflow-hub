-- Fix RLS policies on bridge_accounts to allow company members to view accounts

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their bridge accounts" ON bridge_accounts;
DROP POLICY IF EXISTS "Users can insert bridge accounts" ON bridge_accounts;
DROP POLICY IF EXISTS "Users can update bridge accounts" ON bridge_accounts;
DROP POLICY IF EXISTS "Users can delete bridge accounts" ON bridge_accounts;

-- Recreate policies using has_company_access function
CREATE POLICY "Users can view accessible bridge accounts" 
ON bridge_accounts FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
      AND c.deleted_at IS NULL
      AND has_company_access(auth.uid(), c.id)
  )
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
);

CREATE POLICY "Users can insert accessible bridge accounts" 
ON bridge_accounts FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
      AND c.deleted_at IS NULL
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update accessible bridge accounts" 
ON bridge_accounts FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
      AND c.deleted_at IS NULL
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete accessible bridge accounts" 
ON bridge_accounts FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
      AND c.deleted_at IS NULL
      AND c.user_id = auth.uid()
  )
);