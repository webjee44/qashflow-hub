-- Fix the audit trigger to handle tables without organization_id column
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_data JSONB;
  new_data JSONB;
  action_type TEXT;
  org_id UUID;
  record_uuid UUID;
BEGIN
  -- Determine action type
  IF TG_OP = 'DELETE' THEN
    action_type := 'DELETE';
    old_data := to_jsonb(OLD);
    new_data := NULL;
    record_uuid := OLD.id;
    -- Try to get organization_id from OLD record (if it exists)
    BEGIN
      org_id := OLD.organization_id;
    EXCEPTION WHEN undefined_column THEN
      org_id := NULL;
    END;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if this is a soft delete
    BEGIN
      IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        action_type := 'SOFT_DELETE';
      ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        action_type := 'RESTORE';
      ELSE
        action_type := 'UPDATE';
      END IF;
    EXCEPTION WHEN undefined_column THEN
      action_type := 'UPDATE';
    END;
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    record_uuid := NEW.id;
    -- Try to get organization_id (if it exists)
    BEGIN
      org_id := NEW.organization_id;
    EXCEPTION WHEN undefined_column THEN
      org_id := NULL;
    END;
  ELSIF TG_OP = 'INSERT' THEN
    action_type := 'INSERT';
    old_data := NULL;
    new_data := to_jsonb(NEW);
    record_uuid := NEW.id;
    -- Try to get organization_id (if it exists)
    BEGIN
      org_id := NEW.organization_id;
    EXCEPTION WHEN undefined_column THEN
      org_id := NULL;
    END;
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    organization_id
  ) VALUES (
    TG_TABLE_NAME,
    record_uuid,
    action_type,
    old_data,
    new_data,
    auth.uid(),
    org_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;