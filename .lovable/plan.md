

# Plan : Améliorer les dettes fournisseurs et le modal de détail

## Contexte

Actuellement :
1. **Dettes fournisseurs** : Toutes les factures fournisseurs vont sur une seule ligne "Dettes à payer" même si elles ont une `category_id` associée
2. **Modal de détail** : Quand on clique sur un montant, on voit uniquement les transactions réelles sans distinction entre engagé, prévu, etc.

## Objectif

1. **Intégrer les dettes fournisseurs par catégorie** : Si une dette fournisseur a une catégorie, elle doit apparaître sur la ligne de cette catégorie (dans la colonne "Prévu")
2. **Améliorer le modal de détail** : Distinguer visuellement :
   - Dépenses réelles (transactions bancaires)
   - Dépenses engagées (factures fournisseurs à payer)
   - Prévisions (montants saisis manuellement)

---

## 1. Intégrer les dettes fournisseurs par catégorie

### Modifications dans `src/hooks/useForecasts.ts`

**a) Enrichir la requête des factures payables** (lignes ~314-329)

Ajouter `category_id` au select :

```typescript
const { data: payableInvoices = [], isLoading: payablesLoading } = useQuery({
  queryKey: ['payable-invoices', user?.id, currentCompany?.id],
  queryFn: async () => {
    let query = supabase
      .from('invoices')
      .select('id, due_date, amount_ttc, partner_name, status, category_id')  // ← ajouter category_id
      .eq('type', 'payable')
      .eq('status', 'pending')
      .order('due_date');
    // ...
  },
});
```

**b) Ajouter une fonction `getPayableOutflowByCategory`** (~ligne 357)

```typescript
// Helper to get payable outflow for a specific category and month
const getPayableOutflowByCategory = useCallback((categoryId: string, month: Date): number => {
  const today = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(today);
  const targetStart = startOfMonth(month);
  const targetEnd = endOfMonth(month);
  
  return payableInvoices
    .filter(inv => {
      // Must match category
      if (inv.category_id !== categoryId) return false;
      
      const dueDate = new Date(inv.due_date);
      
      // Overdue -> place at end of current month
      if (isBefore(dueDate, today)) {
        return !isBefore(targetEnd, today) && !isBefore(currentMonthEnd, targetStart);
      }
      
      // Normal invoice -> place at its due_date month
      return dueDate >= targetStart && dueDate <= targetEnd;
    })
    .reduce((sum, inv) => sum + Number(inv.amount_ttc), 0);
}, [payableInvoices]);

// Helper to get payable outflow for UNcategorized invoices
const getPayableOutflowUncategorized = useCallback((month: Date): number => {
  // Same logic but filter inv.category_id === null
}, [payableInvoices]);
```

**c) Retourner les nouvelles fonctions** (~ligne 375)

```typescript
return {
  // ... existing
  getPayableOutflowByCategory,
  getPayableOutflowUncategorized,
};
```

---

### Modifications dans `src/components/forecasts/ForecastTable.tsx`

**a) Récupérer les nouvelles fonctions** (~ligne 60)

```typescript
const { 
  // ... existing
  getPayableOutflowByCategory,
  getPayableOutflowUncategorized,
} = useForecasts();
```

**b) Modifier `renderCell` pour additionner dettes + prévisions** (~lignes 300-350)

Pour les cellules "Prévu" (future et current month), additionner :
- Le forecast manuel de la catégorie
- Les dettes fournisseurs associées à cette catégorie

```typescript
const forecast = getForecast(categoryId, month);
const payableForCategory = type === 'expense' 
  ? getPayableOutflowByCategory(categoryId, month) 
  : 0;
const totalForecast = forecast + payableForCategory;
```

Afficher un indicateur visuel si des dettes sont incluses (icône ou couleur différente).

**c) Modifier `renderPayablesRow` pour ne montrer que les non-catégorisées** (~lignes 1138-1193)

La ligne "Dettes à payer" ne doit afficher que les factures SANS catégorie :

```typescript
const renderPayablesRow = () => {
  // Check if there are any uncategorized payables
  const hasUncategorizedPayables = months.some(month => 
    getPayableOutflowUncategorized(month) > 0
  );
  
  if (!hasUncategorizedPayables) return null;  // Hide row if empty
  
  return (
    <tr className="...">
      <td>⚠️ Dettes non catégorisées</td>
      {months.map((month, monthIndex) => {
        const payableAmount = getPayableOutflowUncategorized(month);
        // ...render cells
      })}
    </tr>
  );
};
```

---

## 2. Améliorer le modal de détail (`TransactionDetailDialog`)

### Modifications dans `src/components/forecasts/TransactionDetailDialog.tsx`

**a) Ajouter la récupération des factures fournisseurs** (~ligne 107)

```typescript
// Fetch payable invoices for this category and month
const { data: payableInvoices = [], isLoading: payablesLoading } = useQuery({
  queryKey: ['payable-invoices-detail', categoryId, format(currentMonth, 'yyyy-MM')],
  queryFn: async () => {
    // Fetch invoices with category_id = categoryId 
    // AND due_date in target month (with overdue logic)
    // AND status = 'pending'
  },
  enabled: open && !!categoryId && categoryType === 'expense',
});
```

**b) Calculer les totaux séparés** (~ligne 157)

```typescript
const actualTotal = useMemo(() => {
  return transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}, [transactions]);

const committedTotal = useMemo(() => {
  return payableInvoices.reduce((sum, inv) => sum + Number(inv.amount_ttc), 0);
}, [payableInvoices]);

const grandTotal = actualTotal + committedTotal;
```

**c) Refondre la section résumé** (~lignes 228-260)

Afficher 3 blocs distincts au lieu de 2 :

```text
┌─────────────────────────────────────────────────────┐
│            RÉSUMÉ - Février 2026                    │
├─────────────────────────────────────────────────────┤
│  💰 Réalisé (bank)     │  1 500 €    │  ██████░░░  │
│  📄 Engagé (factures)  │    800 €    │  ███░░░░░░  │
│  📊 Prévu (manuel)     │  2 000 €    │  ░░░░░░░░░  │
├─────────────────────────────────────────────────────┤
│  TOTAL vs BUDGET       │  2 300 € / 2 000 €  (115%)│
└─────────────────────────────────────────────────────┘
```

**d) Afficher 2 sections dans le tableau** (~lignes 262-340)

```text
┌─────────────────────────────────────────────────────┐
│  Transactions bancaires (3)                         │
├────────┬────────────────────┬────────┬─────────────┤
│ Date   │ Libellé            │ Cat.   │ Montant     │
├────────┼────────────────────┼────────┼─────────────┤
│ 5 fév  │ AMAZON PRIME       │ ✓      │ -500 €      │
│ ...    │                    │        │             │
├─────────────────────────────────────────────────────┤
│  📄 Factures à payer (2)                            │
├────────┬────────────────────┬────────┬─────────────┤
│ Éch.   │ Fournisseur        │ N°     │ Montant TTC │
├────────┼────────────────────┼────────┼─────────────┤
│ 28 fév │ Fournisseur A      │ F-001  │ -400 €      │
│ ...    │                    │        │             │
└─────────────────────────────────────────────────────┘
```

**e) Props additionnelles** (~ligne 46)

```typescript
interface TransactionDetailDialogProps {
  // ... existing
  payableAmount?: number;  // Montant des dettes pour cette catégorie/mois
}
```

---

## 3. Mettre à jour l'interface `PayableInvoice`

Dans `src/hooks/useForecasts.ts` (ligne ~10) :

```typescript
export interface PayableInvoice {
  id: string;
  due_date: string;
  amount_ttc: number;
  partner_name: string;
  status: string;
  category_id: string | null;  // ← ajouter
  invoice_number?: string;     // ← ajouter pour le modal
}
```

---

## Fichiers impactés

| Fichier | Type de modification |
|---------|---------------------|
| `src/hooks/useForecasts.ts` | Enrichir query + nouvelles helpers |
| `src/components/forecasts/ForecastTable.tsx` | Intégrer dettes par catégorie |
| `src/components/forecasts/TransactionDetailDialog.tsx` | Refonte complète du modal |

---

## Résultat attendu

1. **Une dette avec catégorie** : S'affiche sur la ligne de la catégorie (colonne Prévu), avec une icône 📄 indiquant qu'elle inclut des factures
2. **Une dette sans catégorie** : S'affiche sur une ligne "⚠️ Dettes non catégorisées" (alerte visuelle pour inciter à catégoriser)
3. **Clic sur un montant** : Ouvre un modal détaillé qui sépare clairement :
   - Les transactions bancaires déjà passées
   - Les factures fournisseurs à payer (engagé)
   - Le budget prévu (comparaison)

---

## Bénéfices

- **Précision** : Les prévisions de trésorerie par catégorie incluent maintenant les dettes fournisseurs
- **Clarté** : L'utilisateur voit immédiatement d'où viennent les montants
- **Incitation** : Les dettes non catégorisées sont mises en évidence pour encourager la catégorisation

