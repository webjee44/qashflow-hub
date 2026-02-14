
-- Drop the overly permissive SELECT policy
DROP POLICY "Anyone can read valid invitation by token" ON public.organization_invitations;

-- Create a restricted SELECT policy: only the invited user (matched by email) or org admins can read
CREATE POLICY "Invited user or org admins can read invitations"
ON public.organization_invitations
FOR SELECT
USING (
  -- Org admins can see their org's invitations
  is_org_admin(auth.uid(), organization_id)
  -- Or the authenticated user's email matches the invitation email
  OR (
    auth.uid() IS NOT NULL 
    AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  )
);
