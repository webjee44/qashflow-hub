
-- Step 1: Create SECURITY DEFINER function to safely get current user email
CREATE OR REPLACE FUNCTION public.get_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT email::text FROM auth.users WHERE id = auth.uid();
$$;

-- Step 2: Drop the problematic policy and recreate with the new function
DROP POLICY IF EXISTS "Invited user or org admins can read invitations" 
  ON public.organization_invitations;

CREATE POLICY "Invited user or org admins can read invitations"
  ON public.organization_invitations FOR SELECT
  TO authenticated
  USING (
    is_org_admin(auth.uid(), organization_id) 
    OR (
      auth.uid() IS NOT NULL 
      AND lower(email) = lower(public.get_auth_email())
    )
  );

-- Step 3: Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
