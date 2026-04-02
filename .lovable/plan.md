

# Fix: Variation nette du mois ≠ Encaissements - Décaissements

## Cause racine

La ligne **"Variation nette du mois"** et les lignes **"Encaissements" / "Décaissements"** utilisent des formules **différentes** pour le prévisionnel :

- **Décaissements (header)** : `getMonthTotal('expense', mi, 'forecast') + netVat`
- **Variation nette** : `Σ max(forecast, payable) par catégorie + payables non catégorisées + netVat`

La variation nette intègre les factures fournisseurs (payables) dans son calcul d'expenses, mais pas la ligne Décaissements. Résultat : les trois lignes sont incohérentes.

Exemple du screenshot :
- Encaissements prévisionnel : 296 472 €
- Décaissements prévisionnel : 266 400 €
- Attendu : 296 472 - 266 400 = **+30 072 €**
- Affiché : **-5 672 €** (car le calcul interne des dépenses inclut les payables)

## Solution

**Principe** : une seule formule pour chaque total, réutilisée partout. La "Variation nette" doit strictement être `Encaissements_affiché - Décaissements_affiché`.

### Fichier : `src/components/forecasts/ForecastTable.tsx`

1. **Extraire deux fonctions de calcul** pour les totaux de section (income/expense) forecast, identiques à celles utilisées dans `renderSectionHeaderRow` :

```typescript
const getSectionForecastTotal = (type: 'income' | 'expense', monthIndex: number): number => {
  let total = getMonthTotal(type, monthIndex, 'forecast');
  if (type === 'expense') {
    const netVat = getNetVatForecast(months[monthIndex]);
    if (netVat > 0) total += netVat;
  }
  return total;
};

const getSectionActualTotal = (type: 'income' | 'expense', monthIndex: number): number => {
  return getMonthTotal(type, monthIndex, 'actual') + getUncategorized(type, months[monthIndex]);
};
```

2. **Utiliser ces fonctions dans `renderSectionHeaderRow`** au lieu du calcul inline (pas de changement de comportement, juste factorisation).

3. **Modifier `renderNetRow`** pour utiliser exactement ces mêmes fonctions :

```typescript
const incomeActual = getSectionActualTotal('income', monthIndex);
const expenseActual = getSectionActualTotal('expense', monthIndex);
const netActual = incomeActual - expenseActual;

const incomeForecast = getSectionForecastTotal('income', monthIndex);
const expenseForecast = getSectionForecastTotal('expense', monthIndex);
const netForecast = incomeForecast - expenseForecast;
```

4. **Supprimer le calcul dédoublé** avec `expenseForecastTtcAdjusted` (boucle sur les catégories avec max(forecast, payable)) dans `renderNetRow`.

5. **Même refactoring dans l'export Excel** (lignes ~576-600) pour garantir la cohérence dans les fichiers exportés.

### Impact

- La variation nette sera toujours = Encaissements - Décaissements, tel qu'affiché
- Les payables continuent d'être visibles dans leurs lignes dédiées par catégorie et dans la ligne "Dettes non catégorisées"
- Le calcul du solde de fin de mois (`getClosingBalance`) dans `useForecasts.ts` n'est PAS affecté (il a sa propre logique)
- Pas de régression sur les mois passés (qui n'utilisent que les actuals) ni futurs

