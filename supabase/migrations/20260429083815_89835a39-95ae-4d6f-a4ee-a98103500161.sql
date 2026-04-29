
-- 1. Revoke column-level SELECT for sensitive billing/Stripe fields from authenticated/anon roles
REVOKE SELECT (
  stripe_customer_id,
  stripe_subscription_id,
  billing_email,
  billing_name,
  billing_address_line1,
  billing_address_line2,
  billing_city,
  billing_postal_code,
  billing_country
) ON public.organizations FROM authenticated, anon;

-- Service role keeps full access (used by edge functions). Superadmin queries go through SECURITY DEFINER functions.

-- 2. Secure RPC: only org owners/admins (or superadmin) can read billing details
CREATE OR REPLACE FUNCTION public.get_organization_billing(_org_id uuid)
RETURNS TABLE (
  stripe_customer_id text,
  stripe_subscription_id text,
  billing_name text,
  billing_email text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_postal_code text,
  billing_country text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_org_admin(auth.uid(), _org_id) OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: organization admin or owner role required';
  END IF;

  RETURN QUERY
  SELECT
    o.stripe_customer_id,
    o.stripe_subscription_id,
    o.billing_name,
    o.billing_email,
    o.billing_address_line1,
    o.billing_address_line2,
    o.billing_city,
    o.billing_postal_code,
    o.billing_country
  FROM public.organizations o
  WHERE o.id = _org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_organization_billing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_billing(uuid) TO authenticated;
