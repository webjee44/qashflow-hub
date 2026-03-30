

# Fix: Solde de fin de mois — actual vs forecast pour le mois courant

## Cause racine

Pour le mois courant, `getClosingBalance` dans `useForecasts.ts` calcule **deux valeurs identiques** car les deux chemins utilisent `getMonthNetForecast()` qui ne regarde que les **prévisions** :

- `balance` (colonne réel) = ouverture d'avril = `anchorBalance + getMonthNetForecast(mars)` → forecast
- `forecastBalance` (colonne prévisionnel) = `ouverture mars + getMonthNetForecast(mars)` → forecast

Résultat : les deux colonnes affichent le même solde (-25 742 €), alors que la "Variation nette" montre bien une différence (-54 825 réel vs -39 554 prévisionnel).

## Solution

Modifier `getClosingBalance` pour que le solde "réel" du mois courant soit calculé à partir de la **variation nette réelle** (transactions bancaires), pas des prévisions.

### Fichier : `src/hooks/useForecasts.ts`

1. **Créer une fonction `getMonthNetActual`** qui calcule la variation nette réelle du mois :
   - Somme des encaissements réels (catégorisés + non catégorisés) TTC
   - Moins la somme des décaissements réels (catégorisés + non catégorisés) TTC
   - Utilise les mêmes sources que la ligne "Variation nette du mois" dans le tableau

2. **Modifier `getClosingBalance` pour le mois courant** :
   - `balance` (réel) = `opening.balance + getMonthNetActual(month)` — basé sur les transactions réelles
   - `forecastBalance` (prévisionnel) = `opening.balance + getMonthNetForecast(month)` — inchangé

Cela garantit que :
- Le solde réel reflète les flux bancaires constatés (cohérent avec la ligne "Variation nette")
- Le solde prévisionnel reflète les projections par catégorie
- La logique est systémique et s'applique à toutes les sociétés

### Impact

- `getClosingBalance` est consommé par : `ForecastTable`, `ForecastChart`, `BalanceChart` (dashboard)
- Le changement est transparent : le contrat de l'objet retourné ne change pas (`balance`, `forecastBalance`)
- Les mois futurs ne sont pas affectés (ils utilisent déjà les forecasts correctement)
- Les mois passés ne sont pas affectés (ils lisent les snapshots)

