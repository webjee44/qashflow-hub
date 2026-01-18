-- Drop existing SELECT policy for members
DROP POLICY IF EXISTS "Members can view other members of their org" ON public.organization_members;

-- Create view that masks emails for non-admin members
CREATE OR REPLACE VIEW public.organization_members_safe
WITH (security_invoker=on) AS
SELECT 
  om.id,
  om.organization_id,
  om.user_id,
  om.role,
  om.created_at,
  om.updated_at,
  om.joined_at,
  om.invited_at,
  -- Only show email to admins/owners of the organization
  CASE 
    WHEN is_org_admin(auth.uid(), om.organization_id) THEN om.invited_email
    WHEN om.user_id = auth.uid() THEN om.invited_email -- Users can see their own email
    ELSE NULL
  END as invited_email
FROM public.organization_members om;

-- New policy: Members can only see their own membership details
CREATE POLICY "Members can view their own membership"
ON public.organization_members
FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all members of their organization
CREATE POLICY "Org admins can view all members"
ON public.organization_members
FOR SELECT
USING (is_org_admin(auth.uid(), organization_id));