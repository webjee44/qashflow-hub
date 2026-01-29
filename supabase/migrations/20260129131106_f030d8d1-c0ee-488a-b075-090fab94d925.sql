-- Allow anonymous users to read organization name for valid invitations
-- This is needed for the join invitation page to display organization details

-- First, create a policy to allow reading organization name when there's a valid invitation
CREATE POLICY "Anyone can read org for valid invitation" 
ON public.organizations
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.organization_invitations i
    WHERE i.organization_id = id
    AND i.expires_at > now()
    AND i.accepted_at IS NULL
  )
);

-- Also ensure the RPC function can be called by anonymous users
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated;

-- Ensure accept_invitation can be called by authenticated users
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;