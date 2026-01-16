-- =====================================================
-- 1. SOFT DELETE - Add deleted_at columns
-- =====================================================

-- Add deleted_at to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at to companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON public.organizations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON public.companies(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON public.transactions(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- 2. AUDIT LOGS - Create table and triggers
-- =====================================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE', 'EXPORT')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  organization_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view audit logs for their organizations
CREATE POLICY "Users can view audit logs for their organizations"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR user_id = auth.uid()
);

-- RLS policy: Only system can insert audit logs (via triggers with SECURITY DEFINER)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- 3. AUDIT TRIGGER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Try to get organization_id from OLD record
    org_id := OLD.organization_id;
    IF org_id IS NULL AND TG_TABLE_NAME = 'companies' THEN
      org_id := OLD.organization_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if this is a soft delete
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      action_type := 'SOFT_DELETE';
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
      action_type := 'RESTORE';
    ELSE
      action_type := 'UPDATE';
    END IF;
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    record_uuid := NEW.id;
    org_id := NEW.organization_id;
  ELSIF TG_OP = 'INSERT' THEN
    action_type := 'INSERT';
    old_data := NULL;
    new_data := to_jsonb(NEW);
    record_uuid := NEW.id;
    org_id := NEW.organization_id;
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
$$;

-- =====================================================
-- 4. ATTACH TRIGGERS TO CRITICAL TABLES
-- =====================================================

-- Trigger for organizations
DROP TRIGGER IF EXISTS audit_organizations_trigger ON public.organizations;
CREATE TRIGGER audit_organizations_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Trigger for companies
DROP TRIGGER IF EXISTS audit_companies_trigger ON public.companies;
CREATE TRIGGER audit_companies_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Trigger for transactions
DROP TRIGGER IF EXISTS audit_transactions_trigger ON public.transactions;
CREATE TRIGGER audit_transactions_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Trigger for categories
DROP TRIGGER IF EXISTS audit_categories_trigger ON public.categories;
CREATE TRIGGER audit_categories_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();