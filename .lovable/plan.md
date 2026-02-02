
# Plan : Vue cumulative des membres SuperAdmin

## Objectif
Créer une nouvelle page `/superadmin/members` affichant tous les utilisateurs enregistrés avec :
- Email
- Prénom (full_name)
- Organisation(s) rattachée(s)
- Société(s) accessible(s)
- Bouton d'usurpation one-click

---

## 1. Nouvelle fonction RPC Supabase

### `get_superadmin_all_members`

Cette fonction récupère tous les utilisateurs avec leurs organisations et sociétés en une seule requête optimisée.

```sql
CREATE OR REPLACE FUNCTION public.get_superadmin_all_members()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  organizations jsonb,
  companies jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email::text,
    p.full_name,
    u.created_at,
    -- Organizations avec rôle
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'org_id', o.id,
        'org_name', o.name,
        'role', om.role
      ) ORDER BY o.name)
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = u.id AND o.deleted_at IS NULL
    ), '[]'::jsonb) as organizations,
    -- Sociétés (owner + member combinés)
    COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object(
        'company_id', c.id,
        'company_name', c.name,
        'access_type', CASE WHEN c.user_id = u.id THEN 'owner' ELSE 'member' END
      ) ORDER BY ...)
      FROM (
        SELECT c.* FROM companies c WHERE c.user_id = u.id AND c.deleted_at IS NULL
        UNION
        SELECT c.* FROM company_members cm
        JOIN companies c ON c.id = cm.company_id
        WHERE cm.user_id = u.id AND c.deleted_at IS NULL
      ) c
    ), '[]'::jsonb) as companies
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
```

---

## 2. Nouveaux fichiers Frontend

### 2.1 Page `src/pages/SuperAdmin/Members.tsx`

**Structure :**
```text
+----------------------------------------------------------+
| 🔍 Recherche [___________________]  Total: 42 membres    |
+----------------------------------------------------------+
| Email           | Prénom    | Organisations | Sociétés | Action |
+----------------------------------------------------------+
| safaa@cloud...  | SAFAA A.  | GROUPE TRADE. | Cloud V. | [👤]   |
| supply@cloud... | supply    | GROUPE TRADE. | 2 soc.   | [👤]   |
| ...             | ...       | ...           | ...      | [👤]   |
+----------------------------------------------------------+
```

**Fonctionnalités :**
- Tableau avec colonnes : Email, Prénom, Organisations (badges), Sociétés (badges), Action
- Recherche instantanée (filtrage client-side)
- Hover sur badges = tooltip avec liste complète
- Bouton usurpation one-click (icône UserCog)

### 2.2 Hook `useSuperAdminMembers` dans `src/hooks/useSuperAdmin.ts`

```typescript
export function useSuperAdminAllMembers() {
  const { data: isSuperAdmin } = useSuperAdminRole();

  return useQuery({
    queryKey: ['superadmin-all-members'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_superadmin_all_members');
      if (error) throw error;
      return data || [];
    },
    enabled: !!isSuperAdmin,
  });
}
```

---

## 3. Mise à jour du Sidebar

### `src/components/superadmin/SuperAdminSidebar.tsx`

Ajouter l'entrée "Membres" dans la navigation :

```typescript
const navItems = [
  { to: '/superadmin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/superadmin/members', icon: Users, label: 'Membres' },  // NEW
  { to: '/superadmin/organizations', icon: Building2, label: 'Organisations' },
  { to: '/superadmin/subscriptions', icon: CreditCard, label: 'Abonnements' },
];
```

---

## 4. Route dans App.tsx

```typescript
const SuperAdminMembers = lazy(() => import("./pages/SuperAdmin/Members"));

// Dans les routes SuperAdmin
<Route path="/superadmin/members" element={
  <SuperAdminRoute>
    <Suspense fallback={<PageLoader />}><SuperAdminMembers /></Suspense>
  </SuperAdminRoute>
} />
```

---

## 5. Composants UI de la page Members

### Design de la table

| Colonne | Contenu | Style |
|---------|---------|-------|
| **Email** | Email complet, cliquable | `font-medium truncate` |
| **Prénom** | `full_name` ou "—" si vide | Normal |
| **Organisations** | Badges avec nom org + rôle (max 2 + "+N") | Badge couleur par rôle |
| **Sociétés** | Badges avec nom société (max 2 + "+N") | Badge outline |
| **Action** | Bouton icône UserCog | `variant="ghost"` |

### Usurpation one-click
Réutilise la logique existante de `OrganizationDetail.tsx` :
```typescript
const handleImpersonate = async (userId: string) => {
  const { data, error } = await supabase.functions.invoke('admin-impersonate', {
    body: { targetUserId: userId },
  });
  if (data?.impersonationUrl) {
    window.open(data.impersonationUrl, '_blank');
  }
};
```

---

## Résumé des modifications

| Fichier | Action |
|---------|--------|
| `supabase/migrations/xxx.sql` | Créer fonction RPC `get_superadmin_all_members` |
| `src/hooks/useSuperAdmin.ts` | Ajouter hook `useSuperAdminAllMembers` |
| `src/pages/SuperAdmin/Members.tsx` | **Créer** nouvelle page |
| `src/components/superadmin/SuperAdminSidebar.tsx` | Ajouter lien "Membres" |
| `src/App.tsx` | Ajouter route `/superadmin/members` |

---

## Interface finale attendue

La page affichera un tableau searchable avec :
- **42 lignes** (ou le nombre total d'utilisateurs)
- Filtrage instantané par email/prénom
- Badges colorés pour les organisations (owner=jaune, admin=bleu, member=vert)
- Usurpation d'identité en un clic ouvrant un nouvel onglet
