
# Plan de Refactoring Architectural

## Objectif
Migrer vers une architecture "Feature-based" (Screaming Architecture) pour améliorer la maintenabilité, réduire la duplication et faciliter la navigation dans le code.

---

## Phase 1 : Consolidation du Business Plan (Priorité Haute)

### 1.1 Structure cible
```
src/features/business-plan/
  components/          # Composants UI (tables, charts, cards)
  dialogs/             # Modales et formulaires
  hooks/               # Hooks React Query
  services/            # Appels Supabase (déplacés depuis src/services/)
  pages/               # Containers de pages (déplacés depuis src/pages/BusinessPlan/)
  types/               # Types locaux
  utils/               # Helpers (formatage, calculs)
  index.ts             # Point d'entrée public
```

### 1.2 Fichiers à déplacer/supprimer

| Origine | Destination | Action |
|---------|-------------|--------|
| `src/services/businessPlanService.ts` | `src/features/business-plan/services/` | Déplacer |
| `src/services/revenueStreamService.ts` | `src/features/business-plan/services/` | Déplacer |
| `src/services/fixedExpenseService.ts` | `src/features/business-plan/services/` | Déplacer |
| `src/services/personnelService.ts` | `src/features/business-plan/services/` | Déplacer |
| `src/services/investmentService.ts` | `src/features/business-plan/services/` | Déplacer |
| `src/services/financingService.ts` | `src/features/business-plan/services/` | Déplacer |
| `src/services/bonusService.ts` | `src/features/business-plan/services/` | Déplacer |
| `src/components/businessplan/*` | Supprimer | Duplicatas (conserver ceux dans features/) |
| `src/pages/BusinessPlan/*` | `src/features/business-plan/pages/` | Déplacer |
| `src/hooks/useBP*.ts` | Re-exports uniquement | Garder comme alias |

### 1.3 Simplification des pages
Les fichiers dans `src/pages/BusinessPlan/` deviennent des "thin pages" :

```typescript
// src/pages/BusinessPlan/BalanceSheet.tsx (AVANT: 142 lignes)
// src/pages/BusinessPlan/BalanceSheet.tsx (APRES: ~5 lignes)
import { BalanceSheetPage } from '@/features/business-plan/pages';
export default BalanceSheetPage;
```

---

## Phase 2 : Création des autres Features (Priorité Moyenne)

### 2.1 Nouvelles features à créer

```
src/features/
  business-plan/      # Existant (à consolider)
  transactions/       # Nouveau
  categories/         # Nouveau
  forecasts/          # Nouveau
  invoices/           # Nouveau
  dashboard/          # Nouveau
  settings/           # Nouveau
  automations/        # Nouveau
```

### 2.2 Exemple : Feature Transactions
```
src/features/transactions/
  components/
    TransactionRow.tsx
    TransactionsView.tsx
    BulkCategorizeDialog.tsx
    SortDropdown.tsx
    SuggestAutomationDialog.tsx
  hooks/
    useTransactions.ts
  types/
    index.ts
  index.ts
```

---

## Phase 3 : Nettoyage de src/components (Priorité Moyenne)

### 3.1 Structure cible
```
src/components/
  ui/                 # Shadcn (inchangé)
  layout/             # Header, Sidebar, etc. (inchangé)
  shared/             # Composants réutilisables cross-feature
    DateRangePicker.tsx
    CurrencyInput.tsx
    EmptyState.tsx
```

### 3.2 Composants à migrer vers features
- `src/components/dashboard/*` vers `src/features/dashboard/components/`
- `src/components/transactions/*` vers `src/features/transactions/components/`
- `src/components/categories/*` vers `src/features/categories/components/`
- `src/components/invoices/*` vers `src/features/invoices/components/`
- `src/components/forecasts/*` vers `src/features/forecasts/components/`
- `src/components/automations/*` vers `src/features/automations/components/`
- `src/components/settings/*` vers `src/features/settings/components/`

---

## Phase 4 : Standardisation des Hooks (Priorité Basse)

### 4.1 Vérification React Query
Le code utilise déjà React Query. Points à vérifier :
- Tous les hooks utilisent `useQuery`/`useMutation`
- Les services ne contiennent que des appels Supabase purs
- Pas de `useEffect` pour le data fetching

### 4.2 Hooks globaux vs Feature hooks
```
src/hooks/               # Hooks globaux uniquement
  useAuth.tsx
  useCompany.tsx
  useOrganization.tsx
  use-mobile.tsx
  use-toast.ts
  
src/features/*/hooks/    # Hooks spécifiques à la feature
```

---

## Phase 5 : Edge Functions (Priorité Basse)

### 5.1 Améliorer _shared
Créer des modules partagés pour éviter la duplication :
```
supabase/functions/_shared/
  bridge-client.ts      # Existant
  validation.ts         # Existant
  supabase-admin.ts     # Nouveau : client admin réutilisable
  response-helpers.ts   # Nouveau : corsHeaders, error responses
  types.ts              # Nouveau : types partagés client/serveur
```

---

## Ordre d'exécution recommandé

| Étape | Description | Effort | Impact |
|-------|-------------|--------|--------|
| 1 | Supprimer duplicatas `src/components/businessplan/` | Faible | Fort |
| 2 | Déplacer services BP vers `features/business-plan/services/` | Moyen | Fort |
| 3 | Transformer pages BP en "thin pages" | Moyen | Fort |
| 4 | Créer feature `transactions` | Moyen | Moyen |
| 5 | Créer feature `categories` | Moyen | Moyen |
| 6 | Créer feature `forecasts` | Moyen | Moyen |
| 7 | Créer autres features (invoices, dashboard, etc.) | Fort | Moyen |
| 8 | Améliorer `_shared` dans Edge Functions | Faible | Faible |

---

## Bénéfices attendus

1. **Colocation** : Tout ce qui concerne une feature dans un seul dossier
2. **Découvrabilité** : Structure qui "crie" le domaine métier
3. **Maintenance** : Modifications localisées, moins de risque de régression
4. **Onboarding** : Nouveaux développeurs comprennent vite l'architecture
5. **Tests** : Plus facile de tester une feature isolée

---

## Points d'attention

- **Imports circulaires** : Utiliser les fichiers `index.ts` comme points d'entrée
- **Backward compatibility** : Garder des re-exports temporaires dans `src/hooks/` et `src/services/`
- **Incremental** : Migrer feature par feature, pas tout d'un coup
- **Types Supabase** : `src/integrations/supabase/types.ts` reste la source unique (auto-générée)
