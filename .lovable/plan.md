
# Correction de l'intégration des Financements dans le P&L

## Problème identifié

Le hook `useProfitLoss.ts` ne récupère pas correctement les données de `/bp/financements` car :

1. **Bug de typo sur le type de financement** : Le code filtre sur `financing_type === 'leasing'` (ligne 358) alors que la base de données stocke `'lease'`
2. **Calcul des intérêts simpliste** : Les intérêts sont calculés comme `principal * rate` chaque mois, ce qui ne prend pas en compte l'amortissement du capital

## Fichiers à modifier

| Fichier | Correction |
|---------|------------|
| `src/features/business-plan/hooks/useProfitLoss.ts` | Corriger `'leasing'` → `'lease'` et améliorer le calcul des intérêts |

## Corrections détaillées

### 1. Corriger le type de financement pour le crédit-bail (ligne 358)

```typescript
// AVANT (incorrect)
financings.filter(f => f.financing_type === 'leasing')

// APRÈS (correct)
financings.filter(f => f.financing_type === 'lease')
```

### 2. Améliorer le calcul des intérêts (lignes 368-380)

Le calcul actuel est incorrect pour un prêt amortissable. Il faut utiliser le tableau d'amortissement pour calculer les intérêts réels de chaque mois.

**Formule correcte** : Pour un mois donné dans un prêt amortissable, les intérêts sont calculés sur le capital restant dû à ce moment, pas sur le capital initial.

```typescript
const getMonthlyInterestExpense = (month: Date): number => {
  if (!showFinancing) return 0;
  return financings.filter(f => f.financing_type === 'loan').reduce((sum, fin) => {
    const startDate = parseISO(fin.start_date);
    const monthStart = startOfMonth(month);
    
    // Vérifier si le prêt est actif ce mois
    if (monthStart < startOfMonth(startDate)) return sum;
    
    // Calculer le numéro du mois dans le prêt (0-indexed)
    const monthIndex = differenceInMonths(monthStart, startOfMonth(startDate));
    const durationMonths = fin.duration_months || 60;
    
    if (monthIndex >= durationMonths) return sum; // Prêt terminé
    
    // Utiliser getLoanScheduleEntry pour le calcul correct des intérêts
    const entry = getLoanScheduleEntry(
      Number(fin.amount),
      Number(fin.interest_rate),
      durationMonths,
      monthIndex
    );
    
    return sum + entry.interest;
  }, 0);
};
```

### 3. Ajouter l'import manquant

```typescript
import { getLoanScheduleEntry } from '@/lib/french-rates';
import { differenceInMonths } from 'date-fns';
```

## Impacts

Après cette correction :
- Les **loyers de crédit-bail** (`lease`) apparaîtront dans les Services Extérieurs (avant l'EBE)
- Les **intérêts d'emprunt** (`loan`) apparaîtront correctement dans les Charges Financières, calculés selon le tableau d'amortissement réel

## Section technique

La fonction `getLoanScheduleEntry` existe déjà dans `french-rates.ts` et retourne pour chaque mensualité :
- `capital` : part de remboursement du capital
- `interest` : part d'intérêts
- `remaining` : capital restant dû après cette mensualité

Cette approche garantit que les intérêts diminuent progressivement au fil du temps (comportement normal d'un prêt amortissable à taux fixe).
