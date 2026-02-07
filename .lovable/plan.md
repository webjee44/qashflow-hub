
# Plan correctif : Equilibre du Bilan Previsionnel (Actif = Passif)

## Probleme identifie

Le bilan previsionnel ne s'equilibre pas car la **tresorerie (cash)** est calculee de maniere independante avec une formule simplifiee qui ne tient pas compte de tous les flux financiers. En comptabilite, la tresorerie doit etre l'element d'ajustement qui garantit l'equation fondamentale : **Actif = Passif**.

## Causes racines (4 bugs identifies)

1. **Calcul de tresorerie naif** : `cash = initial_cash + resultats nets cumules` -- ignore les investissements, emprunts, remboursements, amortissements (charge non-cash), et variations du BFR
2. **Blocage a zero** : `Math.max(0, cash)` empeche la tresorerie d'etre negative, ce qui fausse le total actif
3. **Bug sur les emprunts bancaires** : La boucle `.reduce()` appelle `getTotalOutstandingLoans()` (qui retourne le TOTAL de tous les prets) a chaque iteration, puis divise par le nombre de prets -- resultat mathematiquement faux
4. **Postes manquants** : Les subventions d'investissement ne figurent pas au passif

## Solution : La tresorerie comme poste d'equilibre

La methode standard en comptabilite previsionnelle : calculer tous les postes du bilan sauf la tresorerie, puis deduire la tresorerie par difference.

```text
Tresorerie = Total Passif - (Immobilisations nettes + Stocks + Creances clients)
```

Cela revient a la formule classique : **Tresorerie Nette = Fonds de Roulement - BFR**, et garantit l'equilibre par construction.

## Modifications techniques

### Fichier : `src/features/business-plan/hooks/useBalanceSheet.ts`

**A. Corriger le calcul des emprunts bancaires (lignes 154-161)**
- Remplacer la boucle buggee par un simple appel `getTotalOutstandingLoans(year.endDate)` une seule fois par annee

**B. Ajouter les subventions d'investissement au passif**
- Filtrer les financements de type `grant` avec `is_operating_grant === false`
- Les afficher dans les capitaux propres (norme PCG)
- Les amortir sur la duree de vie des immobilisations correspondantes

**C. Recalculer la tresorerie comme poste d'equilibre (lignes 100-109)**
- Calculer d'abord tous les postes actif hors tresorerie (immobilisations nettes, stocks, creances)
- Calculer le total passif (capitaux propres, dettes financieres, dettes d'exploitation)
- Deduire : `cash = totalPassif - actifHorsTresorerie`
- Supprimer le `Math.max(0, cash)` : une tresorerie negative est un signal valide (besoin de financement supplementaire)

**D. Reorganiser l'ordre des calculs**
- Calculer le passif AVANT la tresorerie
- Inserer la tresorerie en dernier dans l'actif circulant
- Mettre a jour `totalAssets` pour qu'il soit egal a `totalLiabilities` par construction

### Fichier : `src/features/business-plan/components/BalanceSheetTable.tsx`

**E. Afficher un indicateur d'alerte si la tresorerie est negative**
- Colorer la cellule en rouge quand la tresorerie est negative
- Ajouter une icone d'avertissement pour signaler un besoin de financement

### Impact sur les autres fichiers

- **`useFundingPlan.ts`** : Utilise `bsData.bfr` qui restera correct (pas impacte)
- **`BFRChart.tsx`** : Utilise `data.bfr` et `data.workingCapital` qui resteront corrects
- **`RatiosCard.tsx`** : Les ratios (endettement, solvabilite) seront plus fiables car bases sur des donnees equilibrees
- **`BalanceSheet.tsx` (page)** : La fonction `isBalanced()` retournera toujours `true` par construction

## Resultat attendu

- TOTAL ACTIF = TOTAL PASSIF a chaque annee (garanti par construction)
- Tresorerie nette = Fonds de Roulement - BFR (formule comptable standard)
- Encours bancaires corrects (un seul appel par annee)
- Signal clair quand la tresorerie est negative (besoin de financement)
