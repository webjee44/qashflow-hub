
-- Revoke EXECUTE on every public function from anon so unauthenticated callers
-- can't hit any RPC, including SECURITY DEFINER helpers. Authenticated users
-- still have access (functions check authorization internally).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, PUBLIC',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;
