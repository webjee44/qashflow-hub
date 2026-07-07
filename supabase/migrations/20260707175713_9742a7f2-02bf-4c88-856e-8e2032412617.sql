
-- =========================================================================
-- FIX 1 : has_company_access — suppression du 3e bloc « broken join »
-- =========================================================================
-- La clause EXISTS jointe (member_company / requested_company) ne comparait
-- jamais member_company.id au _company_id demandé, ce qui accordait l'accès
-- à TOUTES les sociétés dès qu'on était membre d'au moins une. Les deux
-- premiers blocs (owner direct + membership direct sur _company_id)
-- couvrent complètement le besoin réel.
CREATE OR REPLACE FUNCTION public.has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND c.deleted_at IS NULL
      AND c.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.company_members cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = _company_id
      AND cm.user_id = _user_id
      AND c.deleted_at IS NULL
  )
$function$;

-- =========================================================================
-- FIX 2 : user_roles — empêcher l'auto-élévation vers superadmin
-- =========================================================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Owners peuvent gérer les rôles NON-superadmin ; seuls les superadmins
-- peuvent accorder/retirer le rôle superadmin.
CREATE POLICY "Owners manage non-superadmin roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    public.is_superadmin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'owner'::app_role)
      AND role <> 'superadmin'::app_role
    )
  )
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'owner'::app_role)
      AND role <> 'superadmin'::app_role
    )
  );

-- =========================================================================
-- FIX 3 : audit_logs — empêcher la forge d'entrées d'audit
-- =========================================================================
-- Le trigger audit_trigger_func s'exécute en SECURITY DEFINER et utilise
-- déjà le service role via l'exécution serveur : il est immunisé de RLS.
-- Côté client, on interdit purement les inserts (les lignes doivent venir
-- exclusivement des triggers). La lecture reste limitée à ses propres logs.
DROP POLICY IF EXISTS "Users manage own audit logs" ON public.audit_logs;

CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Superadmins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- Pas de policy INSERT/UPDATE/DELETE : les writes ne peuvent venir que du
-- service role (triggers, edge functions) qui bypasse la RLS.
