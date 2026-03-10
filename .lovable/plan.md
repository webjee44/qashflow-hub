

# Correction globale : isolation des soldes bancaires via `company_bridge_accounts`

## Problème

Plusieurs endroits du code récupèrent les soldes bancaires en interrogeant directement `bridge_accounts` avec `.eq('company_id', ...)` au lieu de passer par la table d'assignation `company_bridge_accounts`. Le champ `company_id` dans `bridge_accounts` n'est pas la source de vérité — c'est `company_bridge_accounts` qui fait foi.

## Fichiers impactés

### 1. `src/hooks/useDashboardStats.ts` — **2 blocs à corriger**

- **`useDashboardStats` (ligne ~122)** : récupère les soldes via `bridge_accounts.company_id`
- **`useBalanceChartData` (ligne ~249)** : même problème

**Correction** : dans les deux cas, remplacer par le pattern de `useBankBalance.ts` :
1. Requêter `company_bridge_accounts` pour obtenir les `bridge_account_id` assignés
2. Requêter `bridge_accounts` avec `.in('bridge_account_id', assignedIds)`

### 2. `src/pages/Onboarding.tsx` — **1 bloc à corriger (ligne ~489)**

Après l'auto-assignation, le calcul du solde pour mettre à jour `companies.bank_balance` utilise `bridge_accounts.eq('company_id', ...)`. Devrait utiliser les IDs qui viennent d'être assignés dans `company_bridge_accounts`.

### 3. Fichiers **OK** (pas de correction nécessaire)

- `src/hooks/useBankBalance.ts` — utilise déjà correctement `company_bridge_accounts`
- `src/hooks/useForecasts.ts` — utilise déjà correctement `company_bridge_accounts`
- `src/components/settings/BankAccountsCard.tsx` — contexte paramètres, affiche tous les comptes pour l'assignation (comportement voulu)
- `src/components/settings/ManageAccountsDialog.tsx` — même logique paramètres
- `src/components/transactions/hooks/useBankAccounts.ts` — récupère uniquement les noms pour l'affichage, pas les soldes

## Résumé des modifications

3 blocs de code à modifier dans 2 fichiers, tous avec le même pattern : passer par `company_bridge_accounts` avant de lire les soldes dans `bridge_accounts`.

