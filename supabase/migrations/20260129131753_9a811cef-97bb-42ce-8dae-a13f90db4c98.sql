-- Fix double-tenant creation: a legacy auth.users trigger calls handle_new_user_organization
-- That function currently creates an organization unconditionally, causing invited users (and sometimes normal signups)
-- to get an extra tenant. We keep the trigger but make the function a no-op.

CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Legacy trigger compatibility: do nothing.
  -- The canonical initialization logic is implemented in public.handle_new_user().
  RETURN NEW;
END;
$function$;
