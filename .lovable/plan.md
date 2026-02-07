

# Ajout d'une ligne "TVA a decaisser" dans la section Decaissements

## Contexte actuel

Le tableau de previsions est structure ainsi :
1. Solde au 1er du mois
2. Encaissements (categories + Total Encaissements TTC)
3. Decaissements (categories + Total Decaissements TTC)
4. Dettes non categorisees
5. TVA a payer (ligne separee, apres les totaux)
6. Solde Net TTC

Le "Total Decaissements" inclut deja la TVA deductible sur les charges (HT + TVA par categorie). La ligne "TVA a payer" affiche le solde net TVA (collectee - deductible) mais n'est pas integree dans les decaissements.

## Ce qui change

Deplacer la ligne "TVA a decaisser" (TVA collectee - TVA deductible = montant a reverser a l'Etat) **juste avant** "Total Decaissements", et **inclure ce montant** dans le total.

### Structure cible

```text
Decaissements
  Groupe 1 (categories...)
  Groupe 2 (categories...)
  ...
  TVA a decaisser                    <-- nouvelle position
Total Decaissements TTC              <-- inclut desormais la TVA nette
Dettes non categorisees
Solde Net TTC
```

## Proposition pour les mois passes

Pour les mois passes, je propose d'afficher la **TVA calculee a partir des transactions reelles** (TVA collectee sur encaissements reels - TVA deductible sur decaissements reels). C'est coherent car :
- On utilise les taux de TVA configures sur chaque categorie
- On applique ces taux aux montants reels des transactions
- C'est la meilleure approximation sans donnees de declaration CA3 dans le systeme

Si la TVA nette est **negative** (credit de TVA), la valeur apparaitra en vert car c'est un flux favorable.

## Modifications techniques

### 1. `src/components/forecasts/ForecastTable.tsx`

**A. Deplacer `renderVatToPayRow()` avant `renderTtcRow('Total Decaissements')`**
- Retirer l'appel actuel a `renderVatToPayRow()` (ligne 1572)
- L'inserer juste avant `renderTtcRow('Total Decaissements', 'expense')` (ligne 1566)

**B. Modifier `renderTtcRow` pour integrer la TVA nette dans le total des decaissements**
- Pour le type `expense`, ajouter au total TTC la TVA nette a decaisser (quand positive)
- Formule : `Total Decaissements = Sum(categories HT + TVA deductible) + max(0, TVA collectee - TVA deductible)`
- Si credit de TVA (negatif), ne pas l'ajouter aux decaissements (il sera recupere comme encaissement)

**C. Mettre a jour `renderNetRow` en coherence**
- Le Solde Net TTC doit reflechir la nouvelle logique : encaissements TTC - decaissements TTC (incluant TVA nette)
- Supprimer le double comptage : la TVA ne doit plus etre comptee separement si elle est deja dans les totaux

**D. Mettre a jour `getMonthNetForecast` dans `useForecasts.ts`**
- Integrer la TVA nette dans le calcul du solde projete pour que le solde d'ouverture des mois futurs soit correct
- Formule : `Net = Encaissements TTC - Decaissements TTC - max(0, TVA nette)`

### 2. `src/hooks/useForecasts.ts`

**E. Ajouter un helper `getNetVat` pour exposer la TVA nette par mois**
- `getNetVat(monthIndex, valueType) = VATcollectee - VATdeductible`
- Reutilise `getVatForecast` et `getVatActual` existants
- Permet au composant d'afficher la ligne et au calcul de solde d'etre coherent

### 3. Mise a jour du Solde Net

Le Solde Net sera recalcule ainsi :
- `Encaissements TTC` (inchange : HT + TVA categories income)
- `-` `Decaissements TTC` (inchange : HT + TVA categories expense)
- `-` `TVA nette a decaisser` (si positive) ou `+` credit de TVA (si negatif)
- `-` `Dettes fournisseurs` (payables)

Cela evite tout double-comptage et garantit un solde coherent avec les lignes affichees.

