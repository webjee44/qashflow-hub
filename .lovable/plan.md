
# Plan de correction : Accès membre identique au propriétaire

## Objectif
Garantir que les membres invités (ex: safaa@cloudvapor.com) aient exactement les mêmes vues BP et Trésorerie que le propriétaire de la société.

---

## 1. Corrections des politiques RLS en base de données

### 1.1 Tables BP : Ajouter `has_company_access` pour INSERT/UPDATE/DELETE

**Tables concernées (17 tables) :**
- bp_revenue_streams, bp_fixed_expenses, bp_variable_expenses
- bp_personnel, bp_directors, bp_bonuses
- bp_investments, bp_financings, bp_stocks
- bp_settings, bp_notes, bp_snapshots, bp_scenarios
- bp_scenario_overrides, bp_revenue_forecasts

**Modification requise :**
```sql
-- Exemple pour bp_revenue_streams (à répliquer sur toutes les tables BP)
DROP POLICY IF EXISTS "Users can update their own revenue streams" ON bp_revenue_streams;
CREATE POLICY "Users can update accessible revenue streams" 
ON bp_revenue_streams FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can delete their own revenue streams" ON bp_revenue_streams;
CREATE POLICY "Users can delete accessible revenue streams"
ON bp_revenue_streams FOR DELETE
USING (has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create their own revenue streams" ON bp_revenue_streams;
CREATE POLICY "Users can create accessible revenue streams"
ON bp_revenue_streams FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));
```

### 1.2 Tables Treasury : Ajouter `has_company_access` pour SELECT + mutations

**Tables concernées :**
- `categories`
- `category_forecasts` 
- `forecasts`
- `automation_rules`

**Modification requise :**
```sql
-- categories
DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
CREATE POLICY "Users can view accessible categories"
ON categories FOR SELECT
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- Idem pour UPDATE, DELETE avec has_company_access
```

---

## 2. Corrections des hooks côté Frontend

### 2.1 Utiliser `company.user_id` au lieu de `user.id` pour les créations

Les hooks doivent créer les données avec le `user_id` du **propriétaire de la société** (pas le membre connecté) pour éviter les données parasites.

**Fichiers à modifier :**
- `src/services/revenueStreamService.ts`
- `src/services/fixedExpenseService.ts`
- `src/services/personnelService.ts`
- `src/services/investmentService.ts`
- `src/services/financingService.ts`
- `src/hooks/useCategories.ts`
- `src/hooks/useForecasts.ts`

**Pattern à appliquer :**
```typescript
// Avant (crée avec user_id du membre)
await supabase.from('bp_revenue_streams').insert({
  user_id: user.id,  // ❌ Membre connecté
  company_id: companyId,
  ...data
});

// Après (crée avec user_id du propriétaire)
await supabase.from('bp_revenue_streams').insert({
  user_id: currentCompany.user_id,  // ✅ Propriétaire
  company_id: companyId,
  ...data
});
```

### 2.2 Modifier `useCategories.ts` 

Le hook doit :
1. Filtrer par `company_id` via `has_company_access` (pas par `user_id`)
2. Créer avec `company.user_id`

---

## 3. Synchronisation du paramètre `bpEnabled`

### Option A : Hériter du propriétaire (recommandé)
Le membre hérite automatiquement du paramètre `bp_enabled` du propriétaire de la société.

**Modification dans `useOnboarding.ts` :**
```typescript
// Pour les membres, lire bp_enabled du propriétaire de la société
const ownerProfile = await supabase
  .from('profiles')
  .select('bp_enabled')
  .eq('id', currentCompany.user_id)
  .single();

setBpEnabled(ownerProfile.data?.bp_enabled ?? true);
```

### Option B : Forcer l'accès complet pour les membres
Ne pas restreindre les membres - ils voient toujours BP + Treasury si disponible.

---

## 4. Permissions Settings pour les membres

Les membres ne doivent pas pouvoir modifier :
- Paramètres BP (`useBPSettings` - déjà protégé via `isCompanyOwner`)
- Connexion bancaire (Bridge)
- Suppression de société

**Vérifications à ajouter dans les composants Settings :**
```typescript
const isOwner = currentCompany?.user_id === user?.id;

// Désactiver les actions sensibles pour les non-propriétaires
<Button disabled={!isOwner}>Supprimer la société</Button>
```

---

## Résumé des modifications

| Couche | Élément | Action |
|--------|---------|--------|
| **DB RLS** | 17 tables BP | Ajouter `has_company_access` pour INSERT/UPDATE/DELETE |
| **DB RLS** | 4 tables Treasury | Ajouter `has_company_access` pour toutes opérations |
| **Frontend** | 7 services/hooks | Utiliser `company.user_id` pour les insertions |
| **Frontend** | useOnboarding | Hériter `bpEnabled` du propriétaire |
| **Frontend** | Settings | Restreindre actions admin aux propriétaires |

---

## Détails techniques

### Migration SQL (une seule migration pour toutes les tables)

La migration va :
1. Supprimer les anciennes politiques restrictives
2. Créer de nouvelles politiques utilisant `has_company_access`
3. S'applique aux 21 tables concernées

### Hooks à modifier

1. **revenueStreamService.ts** : Paramètre `ownerId` au lieu de `userId`
2. **useBPRevenueStreams.ts** : Passer `currentCompany.user_id` au service
3. **useCategories.ts** : Query par `company_id` + créer avec `company.user_id`
4. **useForecasts.ts** : Créer forecasts avec `company.user_id`

Après ces modifications, safaa@cloudvapor.com aura exactement les mêmes vues que le propriétaire pour Cloud Vapor.
