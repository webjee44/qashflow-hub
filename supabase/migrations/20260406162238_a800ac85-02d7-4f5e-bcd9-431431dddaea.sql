-- Fix 1: Restrict organizations invitation-based SELECT policy to only match the authenticated user's email
DROP POLICY IF EXISTS "Authenticated users can read org for valid invitation" ON public.organizations;
CREATE POLICY "Authenticated users can read org for valid invitation"
ON public.organizations
FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.organization_invitations i
    WHERE i.organization_id = organizations.id
      AND i.expires_at > now()
      AND i.accepted_at IS NULL
      AND lower(i.email) = lower(public.get_auth_email())
  )
);

-- Fix 2: Remove overly permissive INSERT/UPDATE policies on subscription_usage
DROP POLICY IF EXISTS "System can insert/update usage" ON public.subscription_usage;
DROP POLICY IF EXISTS "System can update usage" ON public.subscription_usage;