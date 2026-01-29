
-- Allow superadmins to update organization name
CREATE POLICY "Superadmins can update organizations"
ON public.organizations
FOR UPDATE
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));
