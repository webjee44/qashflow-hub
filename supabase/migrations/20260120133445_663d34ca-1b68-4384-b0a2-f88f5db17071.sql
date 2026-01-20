-- ============================================
-- TABLE: company_members
-- Permet d'associer des utilisateurs à des sociétés spécifiques
-- ============================================

CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  invited_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (company_id, user_id)
);

-- Index pour les recherches fréquentes
CREATE INDEX idx_company_members_user_id ON public.company_members(user_id);
CREATE INDEX idx_company_members_company_id ON public.company_members(company_id);

-- Enable RLS
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FUNCTION: has_company_access
-- Vérifie si un utilisateur a accès à une société
-- ============================================

CREATE OR REPLACE FUNCTION public.has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Propriétaire de la société
    SELECT 1 FROM public.companies 
    WHERE id = _company_id AND user_id = _user_id AND deleted_at IS NULL
  )
  OR EXISTS (
    -- Membre explicite de la société
    SELECT 1 FROM public.company_members 
    WHERE company_id = _company_id AND user_id = _user_id
  )
  OR EXISTS (
    -- Admin/Owner de l'organisation
    SELECT 1 FROM public.companies c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = _company_id 
      AND om.user_id = _user_id 
      AND om.role IN ('owner', 'admin')
      AND c.deleted_at IS NULL
  )
$$;

-- ============================================
-- RLS POLICIES: company_members
-- ============================================

-- Lecture : voir les membres des sociétés auxquelles on a accès
CREATE POLICY "View company members"
ON public.company_members FOR SELECT
TO authenticated
USING (
  public.has_company_access(auth.uid(), company_id)
  OR public.is_superadmin(auth.uid())
);

-- Insertion : propriétaire de la société ou admin de l'organisation
CREATE POLICY "Add company members"
ON public.company_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_id AND c.user_id = auth.uid() AND c.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = company_id 
      AND om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin')
      AND c.deleted_at IS NULL
  )
  OR public.is_superadmin(auth.uid())
);

-- Suppression : propriétaire de la société ou admin de l'organisation
CREATE POLICY "Remove company members"
ON public.company_members FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_id AND c.user_id = auth.uid() AND c.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = company_id 
      AND om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin')
      AND c.deleted_at IS NULL
  )
  OR public.is_superadmin(auth.uid())
);

-- ============================================
-- UPDATE RLS POLICIES: companies
-- Remplacer par la nouvelle logique d'accès
-- ============================================

-- Supprimer les anciennes policies de SELECT
DROP POLICY IF EXISTS "Users can view companies in their organization" ON public.companies;
DROP POLICY IF EXISTS "Users can view their own companies" ON public.companies;

-- Nouvelle policy unifiée pour SELECT
CREATE POLICY "Users can view accessible companies"
ON public.companies FOR SELECT
TO authenticated
USING (
  public.has_company_access(auth.uid(), id)
  OR public.is_superadmin(auth.uid())
);

-- ============================================
-- FUNCTION: get_company_members_with_email
-- Pour afficher les membres avec leur email dans le super-admin
-- ============================================

CREATE OR REPLACE FUNCTION public.get_company_members_with_email(_company_id uuid)
RETURNS TABLE(
  id uuid,
  company_id uuid,
  user_id uuid,
  email text,
  invited_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier que l'utilisateur a le droit de voir ces données
  IF NOT (
    public.has_company_access(auth.uid(), _company_id) 
    OR public.is_superadmin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    cm.id,
    cm.company_id,
    cm.user_id,
    u.email::text,
    cm.invited_by,
    cm.created_at
  FROM public.company_members cm
  JOIN auth.users u ON u.id = cm.user_id
  WHERE cm.company_id = _company_id
  ORDER BY cm.created_at DESC;
END;
$$;

-- ============================================
-- FUNCTION: add_company_member_by_email
-- Pour ajouter un membre via son email
-- ============================================

CREATE OR REPLACE FUNCTION public.add_company_member_by_email(_company_id uuid, _email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  new_member_id uuid;
BEGIN
  -- Vérifier que l'utilisateur a le droit d'ajouter des membres
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = _company_id AND c.user_id = auth.uid() AND c.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = _company_id 
        AND om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
        AND c.deleted_at IS NULL
    )
    OR public.is_superadmin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied: you cannot add members to this company';
  END IF;
  
  -- Trouver l'utilisateur par email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = lower(trim(_email));
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', _email;
  END IF;
  
  -- Vérifier que l'utilisateur n'est pas déjà membre ou propriétaire
  IF EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = _company_id AND user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'This user is already the owner of this company';
  END IF;
  
  -- Ajouter le membre
  INSERT INTO public.company_members (company_id, user_id, invited_by)
  VALUES (_company_id, target_user_id, auth.uid())
  ON CONFLICT (company_id, user_id) DO NOTHING
  RETURNING id INTO new_member_id;
  
  IF new_member_id IS NULL THEN
    RAISE EXCEPTION 'User is already a member of this company';
  END IF;
  
  RETURN new_member_id;
END;
$$;