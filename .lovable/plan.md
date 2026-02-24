

## Diagnostic : Bug de double-comptage dans le solde de fin de mois

### Probleme identifie

Le solde previsionnel de fin de mois est faux car les **factures fournisseurs (payables)** sont **additionnees** aux previsions manuelles au lieu de les **remplacer** dans le calcul du solde.

**Exemple concret avec Toutatis en fevrier :**
- Prevision manuelle saisie : **2 000 EUR**
- Factures fournisseurs en attente : **102 973 EUR**
- Ce que le calcul fait actuellement : **2 000 + 102 973 = 104 973 EUR** comptabilises en depenses
- Ce qui devrait etre fait : prendre le **maximum** des deux (102 973 EUR), car les payables representent la realite des engagements et rendent le forecast manuel redondant

Ce double-comptage se produit dans la fonction `getMonthNetForecast` (useForecasts.ts, ligne 524-554) qui est utilisee pour calculer le "Solde de fin de mois" previsionnel.

### Pourquoi le probleme est structural

La fonction `getMonthNetForecast` parcourt chaque categorie de depenses et fait :
```text
expenseTtc += forecast TTC       (prevision manuelle)
expenseTtc += payable             (factures en attente)
```

Quand les deux existent pour la meme categorie/mois, les depenses sont gonflees artificiellement, ce qui fait plonger le solde previsionnel en negatif alors que le solde reel est positif.

### Correction proposee

Modifier la logique dans `getMonthNetForecast` (useForecasts.ts) : quand des factures fournisseurs existent pour une categorie donnee sur un mois, utiliser le **montant le plus eleve** entre le forecast et les payables, au lieu de les additionner.

```text
Pour chaque categorie de depenses :
  forecast_ttc = forecast HT + TVA
  payables = factures fournisseurs en attente
  depense_reelle = max(forecast_ttc, payables)   // au lieu de forecast_ttc + payables
```

La meme correction doit etre appliquee dans `renderNetRow` (ForecastTable.tsx, ligne 1689-1700) pour que la "Variation nette du mois" affichee soit coherente avec le solde.

### Fichiers a modifier

1. **`src/hooks/useForecasts.ts`** - Fonction `getMonthNetForecast` (lignes 524-554) : remplacer l'addition forecast + payables par `Math.max(forecastTtc, payables)` par categorie
2. **`src/components/forecasts/ForecastTable.tsx`** - Fonction `renderNetRow` (lignes 1689-1700) : appliquer la meme logique max() pour la variation nette affichee

### Impact

- Le solde previsionnel de fin de mois refletera correctement la realite
- La variation nette affichee sera coherente avec le solde
- L'affichage separe des previsions et payables dans les cellules individuelles reste inchange (comme demande precedemment)

