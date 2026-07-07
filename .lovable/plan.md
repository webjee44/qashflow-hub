# LOT S2 — Choc de simplification data

Objectif : effacer la dette multi-tenance. Un seul groupe (Tradeflix), 9 sociétés, accès via `company_members`.

## 1. Migration SQL (un seul lot atomique)

Fichier : `supabase/migrations/<ts>_s2_drop_multitenant.sql`, transactionnel.

### 1a. Détachement FK & drop colonnes
```
ALTER TABLE public.companies              DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.audit_logs             DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.user_activity_logs     DROP COLUMN IF EXISTS organization_id;
-- + tout autre `organization_id` détecté au moment de la migration
```

### 1b. Drop tables mortes
```
DROP TABLE IF EXISTS public.subscription_usage        CASCADE;
DROP TABLE IF EXISTS public.organization_invitations  CASCADE;
DROP TABLE IF EXISTS public.organization_members_safe CASCADE; -- vue ou table
DROP TABLE IF EXISTS public.organization_members      CASCADE;
DROP TABLE IF EXISTS public.organizations             CASCADE;
DROP TABLE IF EXISTS public.forecasts                 CASCADE; -- 0 ligne
DROP TABLE IF EXISTS public.bank_balance_snapshots    CASCADE; -- pipeline mort
```
Rappel : archive déjà présente dans `qashflow_archive`.

### 1c. Fonctions utilitaires RLS
Une seule fonction canonique pour la nouvelle règle "équipe" :

```sql
CREATE OR REPLACE FUNCTION public.is_team_member_of_company(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members cm_target
    WHERE cm_target.company_id = _company_id
      AND EXISTS (
        SELECT 1 FROM public.company_members cm_self
        WHERE cm_self.user_id = auth.uid()
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = _company_id AND c.user_id = auth.uid()
  );
$$;
```
(Version finale précise en fonction du schéma réel de `company_members` — inspection au moment de la migration.)

### 1d. Refonte RLS globale
Pour chaque table `T` du domaine qui porte `company_id` :
1. `DROP POLICY` sur toutes les policies existantes.
2. `CREATE POLICY "team_access" ON public.T FOR ALL TO authenticated USING (public.is_team_member_of_company(company_id)) WITH CHECK (public.is_team_member_of_company(company_id));`

Tables sans `company_id` (profiles, roles utilisateurs, categories globales) : policies triviales `auth.uid() = user_id` uniquement.

Compte cible : ~1 policy par table domaine ≈ 40. Rapport de diff avant/après fourni.

### 1e. Nettoyage fonctions/vues obsolètes
Drop de `has_organization_role`, `user_organization_id`, `organization_members_safe`, `get_organization_stats`, etc. si présents.

## 2. Code — purge & adaptation

### 2a. Suppressions
- `src/hooks/useOrganization.tsx`
- `src/hooks/useInvitations.ts` (invitations organization) → remplacé par un flux minimal `company_members` si nécessaire, sinon supprimé.
- Toute page/composant Settings/Join référençant `organization_id`.

### 2b. Adaptation `useCompany.tsx`
Nouvelle règle de listing :
```ts
// companies visibles = union(
//   companies.user_id = auth.uid(),
//   companies.id in (select company_id from company_members where user_id = auth.uid())
// )
```
Un simple `select * from companies` suffira (RLS s'en charge). Suppression de `currentOrganization`, `orgId`, `.eq('organization_id', ...)`.

### 2c. `App.tsx`
Retirer `<OrganizationProvider>` et son import.

### 2d. Autres hooks touchés
- `useAuditLogs.ts`, `useActivityTracker.ts`, `useOnboarding.ts`, `useRevenueStreams.ts`, `useDashboardStats.ts` : retirer tout `organization_id` (filtrage RLS suffit) et remplacer par `company_id` là où pertinent.
- Edge functions `check-subscription`, `create-checkout`, `customer-portal`, `check-clients`, `admin-delete-user`, `snapshot-balances` : soit suppression (billing, snapshots) soit purge des refs `organization_id`.

### 2e. Types Supabase
`src/integrations/supabase/types.ts` sera régénéré par la plateforme après migration. Pas d'édition manuelle.

## 3. Edge functions à décommissionner
- `snapshot-balances` (pipeline mort, table drop) → `supabase--delete_edge_functions`.
- `check-subscription`, `create-checkout`, `customer-portal` (billing supprimé S1) → à confirmer et delete.

## 4. Tests & validation
- `bunx vitest run` : suite complète verte (moteur trésorerie inchangé, tests 190+ intacts).
- `tsgo --noEmit` : build type OK après régénération de `types.ts`.
- Sanity SQL post-migration (fourni au user) : compte des policies avant/après, listing des tables restantes.

## 5. Livrables
1. 1 fichier de migration atomique.
2. Rapport diff policies (fichier markdown ou logué dans la réponse).
3. Liste fichiers supprimés/édités.
4. Liste FK cassées assumées confirmées (celles listées en 1a).

## Points nécessitant confirmation avant exécution
1. **`company_members` schéma** : nom exact des colonnes (`user_id`, `company_id`, `role` ?) — à confirmer via `security--get_table_schema` juste avant migration.
2. **Edge functions billing** : OK pour delete `check-subscription`, `create-checkout`, `customer-portal`, `snapshot-balances` ?
3. **`useInvitations`** : conserver un flux d'invitation vers `company_members` (utile pour ajouter un membre à une société) OU supprimer entièrement ? La demande dit « garder juste l'invitation vers company_members » — je pars sur "conserver et adapter", en drop de la référence `organization_id`.
4. **Tests** : je n'ajoute pas de nouveau test (pas de code métier nouveau). OK ?

Réponds "go" (et lève les 4 points ci-dessus si besoin) et j'exécute.
