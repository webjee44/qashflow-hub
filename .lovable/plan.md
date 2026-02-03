

# Plan : Ajouter une ligne "Solde au 1er du mois" dans le tableau Prévisions

## Contexte

L'utilisateur souhaite voir une ligne de solde bancaire au-dessus de la section "Encaissements" dans le tableau de trésorerie `/previsions`. Cette ligne doit afficher :
- **Mois passés** : Le solde réel basé sur les transactions Bridge
- **Mois courant et futurs** : Le solde prévisionnel calculé

## Approche technique

### 1. Calcul du solde

Le solde à une date donnée = Solde actuel (Bridge) - mouvements depuis cette date

**Pour le mois courant** : on utilise le `bank_balance` de la company (synchronisé via Bridge)

**Pour les mois passés** : on reconstitue le solde en retranchant du solde actuel les transactions survenues après ce mois

**Pour les mois futurs** : on part du solde actuel et on ajoute les encaissements/décaissements prévisionnels (net TTC) de chaque mois

### 2. Modifications dans `src/hooks/useForecasts.ts`

**a) Ajouter une fonction `getOpeningBalance`**

```typescript
// Calculer le solde au 1er jour d'un mois donné
const getOpeningBalance = useCallback((month: Date): { balance: number; isActual: boolean } => {
  const currentBankBalance = currentCompany?.bank_balance ?? 0;
  const todayMonth = startOfMonth(new Date());
  const targetMonth = startOfMonth(month);
  
  if (isSameMonth(month, new Date())) {
    // Mois courant : retourner le solde actuel
    return { balance: currentBankBalance, isActual: true };
  }
  
  if (isBefore(targetMonth, todayMonth)) {
    // Mois passé : reconstruire le solde au 1er du mois
    // = solde actuel - toutes les transactions du mois cible jusqu'à aujourd'hui
    const transactionsSinceTarget = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= targetMonth && txDate < todayMonth;
    });
    const netSince = transactionsSinceTarget.reduce((sum, tx) => sum + tx.amount, 0);
    return { balance: currentBankBalance - netSince, isActual: true };
  }
  
  // Mois futur : calculer le solde prévisionnel
  // = solde actuel + somme des nets prévisionnels des mois intermédiaires
  let projectedBalance = currentBankBalance;
  for (let m = todayMonth; isBefore(m, targetMonth); m = addMonths(m, 1)) {
    const monthNet = getMonthNetForecast(m); // income - expenses (TTC)
    projectedBalance += monthNet;
  }
  return { balance: projectedBalance, isActual: false };
}, [currentCompany, transactions, categories, forecasts, payableInvoices]);
```

**b) Exposer la fonction dans le return**

```typescript
return {
  // ... existant
  getOpeningBalance,
};
```

### 3. Modifications dans `src/components/forecasts/ForecastTable.tsx`

**a) Ajouter la fonction `renderOpeningBalanceRow`**

```typescript
const renderOpeningBalanceRow = () => {
  return (
    <tr className="font-semibold bg-primary/5 border-b-2 border-primary/30">
      <td className="p-3 sticky left-0 z-10 bg-primary/5 border-r border-border text-primary">
        🏦 Solde au 1er du mois
      </td>
      {months.map((month, monthIndex) => {
        const { balance, isActual } = getOpeningBalance(month);
        const periodType = getMonthPeriodType(month);
        
        // Même layout que les autres lignes
        if (periodType === 'past') {
          return (
            <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
              <div className={cn(
                "px-3 py-2 text-right font-bold",
                balance >= 0 ? "text-primary" : "text-destructive"
              )}>
                {formatValue(balance)}
              </div>
            </td>
          );
        }
        
        if (periodType === 'future') {
          return (
            <td key={monthIndex} className="p-0 border-r border-border min-w-[90px]">
              <div className={cn(
                "px-3 py-2 text-right font-bold text-muted-foreground italic",
                balance >= 0 ? "" : "text-destructive"
              )}>
                {formatValue(balance)}
              </div>
            </td>
          );
        }
        
        // Mois courant : afficher uniquement le réel (pas de prévu)
        return (
          <td key={monthIndex} className="p-0 border-r border-border min-w-[160px]">
            <div className="flex">
              <div className={cn(
                "flex-1 px-3 py-2 text-right border-r border-border/50 font-bold",
                balance >= 0 ? "text-primary" : "text-destructive"
              )}>
                {formatValue(balance)}
              </div>
              <div className="flex-1 px-3 py-2 text-right text-muted-foreground">
                —
              </div>
            </div>
          </td>
        );
      })}
    </tr>
  );
};
```

**b) Insérer la ligne avant "Encaissements"**

Dans le `<tbody>` (lignes ~1479-1506), ajouter `{renderOpeningBalanceRow()}` juste avant la section Encaissements :

```tsx
<tbody>
  {/* Opening Balance Row */}
  {renderOpeningBalanceRow()}  {/* ← NOUVELLE LIGNE */}
  
  {/* Income Section */}
  <tr className="bg-success/5">
    <td colSpan={months.length + 1} className="p-2 font-semibold text-success border-b border-border">
      📈 Encaissements
    </td>
  </tr>
  {/* ... reste du code */}
</tbody>
```

### 4. Récupérer les données nécessaires

Dans `useForecasts.ts`, il faudra également récupérer toutes les transactions de la période pour pouvoir recalculer les soldes passés.

La requête existante `actuals` récupère déjà les transactions groupées par catégorie et mois. On devra ajouter une requête similaire mais non groupée pour avoir le total net par mois :

```typescript
// Fetch all transactions for balance calculation
const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
  queryKey: ['all-transactions-for-balance', user?.id, currentCompany?.id, startMonthStr, endMonthStr],
  queryFn: async () => {
    // Fetch transactions from earliest displayed month to today
    let query = supabase
      .from('transactions')
      .select('amount, date, type')
      .gte('date', startMonthStr)
      .is('deleted_at', null);

    if (currentCompany) {
      query = query.or(`company_id.eq.${currentCompany.id},company_id.is.null`);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  enabled: !!user?.id && !!startMonthStr,
});
```

---

## Fichiers impactés

| Fichier | Modification |
|---------|--------------|
| `src/hooks/useForecasts.ts` | Ajouter requête transactions + fonction `getOpeningBalance` |
| `src/components/forecasts/ForecastTable.tsx` | Ajouter `renderOpeningBalanceRow` + appel dans tbody |

---

## Résultat attendu

```text
┌─────────────────┬─────────┬─────────────┬─────────┬─────────┐
│                 │ Jan 26  │   Fév 26    │ Mar 26  │ Avr 26  │
│                 │  Réel   │ Réel │Prévu │  Prévu  │  Prévu  │
├─────────────────┼─────────┼──────┼──────┼─────────┼─────────┤
│ 🏦 Solde 1er    │ 125 000 │127 450│  —  │ 130 000 │ 135 000 │  ← NOUVELLE LIGNE
├─────────────────┼─────────┴──────┴──────┴─────────┴─────────┤
│ 📈 Encaissements│          ... données existantes ...       │
│ Total Encaiss.  │                                           │
├─────────────────┼───────────────────────────────────────────┤
│ 📉 Décaissements│          ... données existantes ...       │
│ Total Décaiss.  │                                           │
├─────────────────┼───────────────────────────────────────────┤
│ Solde Net TTC   │                                           │
└─────────────────┴───────────────────────────────────────────┘
```

- **Mois passés** : Solde réel (police normale)
- **Mois courant** : Solde réel uniquement (colonne Prévu = "—")
- **Mois futurs** : Solde prévisionnel (police italique/grisée pour indiquer la projection)

