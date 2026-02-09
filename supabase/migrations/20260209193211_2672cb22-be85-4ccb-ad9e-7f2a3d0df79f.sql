
-- Drop the insecure policy that exposes stripe data to anyone with a valid invitation token
DROP POLICY IF EXISTS "Anyone can read org for valid invitation" ON public.organizations;

-- Recreate it with restricted columns using a secure view approach:
-- Instead, we create a policy that requires authentication
CREATE POLICY "Authenticated users can read org for valid invitation"
ON public.organizations
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization_invitations i
    WHERE i.organization_id = organizations.id
      AND i.expires_at > now()
      AND i.accepted_at IS NULL
  )
);
