-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Service role can manage bridge accounts" ON bridge_accounts;

-- Create policies for users to access their own bridge accounts
CREATE POLICY "Users can view their bridge accounts"
ON bridge_accounts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
    AND c.user_id = auth.uid()
    AND c.deleted_at IS NULL
  )
);

CREATE POLICY "Users can insert bridge accounts"
ON bridge_accounts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
    AND c.user_id = auth.uid()
    AND c.deleted_at IS NULL
  )
);

CREATE POLICY "Users can update bridge accounts"
ON bridge_accounts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
    AND c.user_id = auth.uid()
    AND c.deleted_at IS NULL
  )
);

CREATE POLICY "Users can delete bridge accounts"
ON bridge_accounts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
    AND c.user_id = auth.uid()
    AND c.deleted_at IS NULL
  )
);

-- Keep service role access for edge functions
CREATE POLICY "Service role full access on bridge accounts"
ON bridge_accounts FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');