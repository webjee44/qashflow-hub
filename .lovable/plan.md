

# Simplification "Point Zéro" — Forward-Only sans reconstitution du passé

## Analyse de l'existant

Le hook `useForecasts.ts` (819 lignes) a déjà été partiellement simplifié lors du précédent refactoring (suppression de `allTransactions`), mais il reste des vestiges de la logique rétroactive :
- `getOpeningBalance` tente encore des fallbacks complexes (snapshot end-of-month, live balance, initial_balance)
- `getClosingBalance` fait un retro-calcul pour les mois passés (`nextOpening`)
- La fonction `backfill-snapshots` tente de reconstituer l'historique complet en marchant en arrière

L'analyse du CTO est claire : **arrêter de reconstituer le passé**, et créer le "Point Zéro" (snapshot du 1er du mois d'inscription) directement dans `bridge-sync` lors de la première connexion.

## Plan d'implémentation

### 1. Créer le snapshot initial dans `bridge-sync`

Après la synchronisation des transactions dans `bridge-sync` (full-sync), ajouter une étape qui :
- Vérifie s'il existe déjà un snapshot pour cette company
- Si non (première connexion) : calcule le solde au 1er du mois courant = `liveBalance - Σ transactions du mois courant`
- Insère ce snapshot comme "Point Zéro" dans `bank_balance_snapshots`

Cela se fait une seule fois, au moment de l'inscription, côté backend.

### 2. Simplifier `getOpeningBalance` dans `useForecasts.ts`

Réduire à 3 cas triviaux :
- **Passé** : Lire le snapshot. Si absent → `0` (mois avant inscription, l'UI affichera "Non suivi")
- **Mois courant** : Lire le snapshot du 1er du mois (créé par le backend)
- **Futur** : Snapshot courant + Σ `getMonthNetForecast` en marche avant

Suppression des fallbacks : plus de `getSnapshotForEndOfMonth`, plus de `liveBankBalance` dans le calcul d'ouverture, plus de `initialBalance`.

### 3. Simplifier `getClosingBalance`

- **Passé** : Override manuel OU snapshot du mois suivant OU opening + net réalisé
- **Courant** : Opening + net forecast (pas de double logique `forecastBalance`)
- **Futur** : Opening + net forecast

### 4. Adapter l'UI pour les mois sans données

Dans `ForecastTable.tsx`, afficher un indicateur visuel (cellule grisée ou mention "—") pour les mois antérieurs à l'inscription où aucun snapshot n'existe, au lieu de montrer `0 €`.

## Fichiers impactés

1. **`supabase/functions/bridge-sync/index.ts`** — Ajouter ~30 lignes après la sync pour créer le snapshot initial (Point Zéro)
2. **`src/hooks/useForecasts.ts`** — Simplifier `getOpeningBalance` (~60→20 lignes), `getClosingBalance` (~35→20 lignes), supprimer `getSnapshotForEndOfMonth`
3. **`supabase/functions/snapshot-balances/index.ts`** — Inchangé (le CRON quotidien continue de fonctionner)
4. **`supabase/functions/backfill-snapshots/index.ts`** — Peut être conservé comme outil d'admin mais n'est plus nécessaire au fonctionnement normal

## Impact net

- `getOpeningBalance` : 60 → ~20 lignes
- `getClosingBalance` : 35 → ~20 lignes  
- Suppression de `getSnapshotForEndOfMonth` (~15 lignes)
- Le frontend ne dépend plus de `liveBankBalance` pour les calculs de solde (uniquement pour l'affichage "Solde actuel")
- Plus de reconstitution historique = plus de chiffres faux

