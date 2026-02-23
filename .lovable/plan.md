

# CRM Pipeline - Funnel d'engagement utilisateur

## Objectif
Ajouter une nouvelle page "CRM" dans le back-office SuperAdmin qui affiche un pipeline visuel (style Kanban) montrant la progression de chaque utilisateur a travers les etapes d'engagement. Un graphique en entonnoir (funnel) affichera les taux de conversion entre chaque etape.

## Funnel d'engagement propose

Les etapes du pipeline, de gauche a droite :

```text
+-------------+    +-----------+    +-------------+    +-------------+    +---------------+    +-----------+
|  Inscrit    | -> | Onboarding| -> |   Banque    | -> | 1ere        | -> | Utilisation   | -> |  Power    |
|  (Sign-up)  |    |  Complet  |    |  Connectee  |    | Categoris.  |    |   > 1h        |    |  User     |
+-------------+    +-----------+    +-------------+    +-------------+    +---------------+    +-----------+
```

1. **Inscrit** -- Compte cree (tous les utilisateurs)
2. **Onboarding complet** -- `profiles.onboarding_completed = true`
3. **Banque connectee** -- Au moins un `bridge_account` lie a une company de l'utilisateur
4. **1ere categorisation** -- Au moins une transaction avec `category_id IS NOT NULL`
5. **Utilisation > 1h** -- Somme des `duration_seconds` dans `user_activity_logs` > 3600
6. **Power User** -- Utilisation > 5h ET > 10 connexions ET au moins 1 regle d'automatisation

## Ce qui sera cree

### 1. Fonction SQL (migration)
**`get_superadmin_crm_pipeline`** -- Une RPC qui retourne pour chaque utilisateur :
- `user_id`, `email`, `full_name`, `created_at`
- `onboarding_completed` (boolean)
- `has_bank` (boolean) -- bridge_accounts existent
- `has_categorized` (boolean) -- transactions categorisees
- `total_time_seconds` (bigint)
- `total_logins` (bigint)
- `has_automation` (boolean)
- `pipeline_stage` (text) -- etape calculee

Cela permet de classer chaque utilisateur dans la bonne colonne.

### 2. Hook React
**`src/hooks/useCRMPipeline.ts`** -- Appelle la RPC, regroupe les utilisateurs par etape, et calcule les stats du funnel (comptages et taux de conversion).

### 3. Page SuperAdmin
**`src/pages/SuperAdmin/CRM.tsx`** :
- **Funnel Bar Chart** en haut : barres horizontales decroissantes avec pourcentages de conversion entre chaque etape
- **Pipeline Kanban** en dessous : colonnes draggable-free (lecture seule) avec les cartes utilisateurs dans leur etape
- Chaque carte montre : nom/email, date d'inscription, temps passe, bouton impersonation
- Filtre par recherche email/nom
- Badges colores par etape

### 4. Integration
- Ajout de la route `/superadmin/crm` dans `App.tsx`
- Ajout de l'entree "CRM" dans `SuperAdminSidebar.tsx` avec l'icone `Funnel`

## Details techniques

### Migration SQL
```sql
CREATE OR REPLACE FUNCTION get_superadmin_crm_pipeline()
RETURNS TABLE(
  user_id uuid, email text, full_name text, created_at timestamptz,
  onboarding_completed boolean, has_bank boolean, has_categorized boolean,
  total_time_seconds bigint, total_logins bigint, has_automation boolean,
  pipeline_stage text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  WITH user_data AS (
    SELECT 
      u.id, u.email::text, p.full_name, u.created_at,
      COALESCE(p.onboarding_completed, false) as onboarding_done,
      EXISTS(SELECT 1 FROM bridge_accounts ba JOIN companies c 
        ON c.bridge_user_uuid = ba.bridge_user_uuid 
        WHERE c.user_id = u.id AND c.deleted_at IS NULL) as has_bank,
      EXISTS(SELECT 1 FROM transactions t 
        WHERE t.user_id = u.id AND t.category_id IS NOT NULL) as has_cat,
      COALESCE((SELECT SUM(ual.duration_seconds) FROM user_activity_logs ual 
        WHERE ual.user_id = u.id AND ual.event_type = 'heartbeat'), 0)::bigint as time_s,
      COALESCE((SELECT COUNT(*) FROM user_activity_logs ual 
        WHERE ual.user_id = u.id AND ual.event_type = 'login'), 0)::bigint as logins,
      EXISTS(SELECT 1 FROM automation_rules ar WHERE ar.user_id = u.id) as has_auto
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
  )
  SELECT ud.id, ud.email, ud.full_name, ud.created_at,
    ud.onboarding_done, ud.has_bank, ud.has_cat,
    ud.time_s, ud.logins, ud.has_auto,
    CASE
      WHEN ud.time_s > 18000 AND ud.logins > 10 AND ud.has_auto THEN 'power_user'
      WHEN ud.time_s > 3600 THEN 'active_1h'
      WHEN ud.has_cat THEN 'first_categorization'
      WHEN ud.has_bank THEN 'bank_connected'
      WHEN ud.onboarding_done THEN 'onboarding_complete'
      ELSE 'signed_up'
    END as pipeline_stage
  FROM user_data ud
  ORDER BY ud.created_at DESC;
END;
$$;
```

### Structure de la page CRM

La page se compose de deux sections :

**Section 1 - Funnel** : Barres horizontales empilees montrant la conversion.
Chaque barre montre le nombre d'utilisateurs et le % de drop-off par rapport a l'etape precedente.

**Section 2 - Pipeline** : Grille de 6 colonnes scrollables horizontalement. Chaque colonne a un titre avec le compteur et contient des cartes utilisateurs.

### Fichiers modifies
- `supabase/migrations/` -- nouvelle migration pour la RPC
- `src/hooks/useCRMPipeline.ts` -- nouveau hook
- `src/pages/SuperAdmin/CRM.tsx` -- nouvelle page
- `src/components/superadmin/SuperAdminSidebar.tsx` -- ajout entree nav
- `src/App.tsx` -- ajout route

