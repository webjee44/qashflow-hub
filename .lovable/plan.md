
# Plan : Isolation du superadmin du flux tenant

## Contexte

Le superadmin `superadmin@gmail.com` a actuellement un tenant (organisation + entreprise) qui lui a été créé automatiquement lors de son inscription. Ce tenant doit être supprimé car les superadmins :
- N'ont pas besoin de tenant propre
- Accèdent uniquement via `/superadmin`
- Utilisent l'impersonation pour consulter les données utilisateurs

## Tenant existant à supprimer

| Element | ID | Nom |
|---------|-----|-----|
| Organisation | `d9c1ff19-e751-45d9-be4c-782702abb865` | superadmin's Organization |
| Entreprise | `6b62fda1-7cf4-458e-9f54-2ce705b63097` | superadmin |

---

## 1. Migration SQL

### 1.1 Modifier le trigger `handle_new_user`

Ajouter une condition pour ignorer la création de tenant si l'utilisateur est déjà superadmin :

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  org_name text;
  org_slug text;
  company_name text;
BEGIN
  -- Ne PAS créer de tenant pour les superadmins
  -- Vérifier si le rôle superadmin existe déjà pour cet utilisateur
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.id AND role = 'superadmin'
  ) THEN
    -- Créer uniquement le profil minimal
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Super Admin'))
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
  END IF;

  -- ... reste du code existant inchangé ...
  company_name := COALESCE(
    NEW.raw_user_meta_data ->> 'company_name',
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  org_name := company_name;
  org_slug := public.generate_org_slug(org_name);
  
  INSERT INTO public.organizations (...)
  ...
  
  RETURN NEW;
END;
$$;
```

### 1.2 Créer une fonction de nettoyage pour superadmins existants

```sql
CREATE OR REPLACE FUNCTION public.cleanup_superadmin_tenant(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_ids uuid[];
BEGIN
  -- Vérifier que l'utilisateur est superadmin
  IF NOT is_superadmin(_user_id) THEN
    RAISE EXCEPTION 'User is not a superadmin';
  END IF;
  
  -- Récupérer les organisations où il est owner
  SELECT array_agg(o.id) INTO v_org_ids
  FROM organizations o
  WHERE o.owner_id = _user_id;
  
  IF v_org_ids IS NOT NULL THEN
    -- Supprimer les entreprises liées
    DELETE FROM companies WHERE organization_id = ANY(v_org_ids);
    
    -- Supprimer les membres
    DELETE FROM organization_members WHERE organization_id = ANY(v_org_ids);
    
    -- Supprimer les organisations
    DELETE FROM organizations WHERE id = ANY(v_org_ids);
  END IF;
END;
$$;
```

### 1.3 Exécuter le nettoyage pour le superadmin existant

```sql
-- Nettoyer le tenant du superadmin existant
SELECT cleanup_superadmin_tenant('60d20ec5-7257-4e6f-9756-0e731615e091');
```

---

## 2. Modifications des hooks (gestion gracieuse)

### 2.1 `useCompany.tsx`

Les providers fonctionnent déjà correctement avec une liste vide - ils retournent simplement `companies = []` et `currentCompany = null`. Aucune modification nécessaire.

### 2.2 `useOrganization.tsx`

Idem, le provider gère déjà le cas où `membershipData.length === 0` en ligne 79-82.

---

## 3. Fichiers impactés

| Fichier | Action | Description |
|---------|--------|-------------|
| Migration SQL | Creer | Modifier trigger + fonction cleanup + exécuter nettoyage |

---

## Résumé des changements

1. **Migration SQL unique** qui :
   - Modifie `handle_new_user` pour ignorer les superadmins
   - Crée `cleanup_superadmin_tenant` pour nettoyer les tenants existants
   - Exécute le nettoyage pour `superadmin@gmail.com`

2. **Aucune modification de code frontend** - les providers gèrent déjà les listes vides

3. **Workflow futur** : Pour créer un nouveau superadmin, il suffira d'ajouter d'abord le rôle dans `user_roles` avant la création du compte (ou utiliser `cleanup_superadmin_tenant` après)
