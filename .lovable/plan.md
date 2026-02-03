

# Plan de Correction : Revenus absents du PDF Business Plan

## Diagnostic Final

Le PDF Business Plan affiche **0 € de revenus** alors que l'utilisateur a saisi des prévisions mensuelles dans `/bp/revenus`. Ceci est dû à un bug critique dans l'Edge Function `generate-bp-pdf` :

**La table `bp_revenue_forecasts` n'est jamais requêtée.** Le PDF utilise uniquement les paramètres du flux (bp_revenue_streams) pour calculer les revenus, mais si l'utilisateur utilise le modèle "variable" et saisit les montants mois par mois, ces données sont totalement ignorées.

---

## Corrections à Apporter

### 1. Récupérer les prévisions de revenus

**Fichier :** `supabase/functions/generate-bp-pdf/index.ts`
**Lignes :** ~70-94 (bloc Promise.all)

Ajouter la requête pour `bp_revenue_forecasts` dans le fetch initial :

```typescript
const [
  // ... existing queries
  { data: revenueForecasts }
] = await Promise.all([
  // ... existing queries
  supabase.from('bp_revenue_forecasts').select('*').eq('company_id', companyId)
]);
```

### 2. Mettre à jour l'interface FinancialData

**Fichier :** `supabase/functions/generate-bp-pdf/index.ts`
**Lignes :** ~19-31

```typescript
interface FinancialData {
  // ... existing properties
  revenueForecasts: any[]; // Ajouter cette ligne
}
```

### 3. Refactorer `calculateYearlyRevenue`

**Fichier :** `supabase/functions/generate-bp-pdf/index.ts`

La fonction actuelle utilise uniquement `monthly_price × initial_subscribers × growth`. 

La nouvelle logique doit :
1. Pour chaque flux, itérer sur les mois de l'année
2. Chercher une prévision explicite (`amount > 0`) dans `revenueForecasts`
3. Si trouvée → utiliser cette valeur
4. Si `amount === 0` → considérer comme "non saisi", utiliser le fallback (calcul auto pour SaaS, ou 0 pour variable)
5. Pour les années 2+, projeter depuis l'année 1 avec les taux de croissance annuels

```typescript
const getMonthlyRevenue = (streamId: string, month: Date): number => {
  const stream = financialData.revenueStreams.find(s => s.id === streamId);
  if (!stream) return 0;
  
  const monthStr = formatDateYYYYMMDD(month);
  const forecast = financialData.revenueForecasts.find(
    f => f.stream_id === streamId && f.month === monthStr
  );
  
  // Prévision explicite avec montant > 0
  if (forecast?.amount && forecast.amount > 0) {
    return forecast.amount;
  }
  
  // Fallback pour modèle subscription
  if (stream.model === 'subscription') {
    // Calcul MRR auto
  }
  
  // Modèle variable sans saisie = 0
  return 0;
};

const calculateYearlyRevenue = (year: number): number => {
  // Year 0: somme des revenus mensuels (de bpStartDate à +12 mois)
  // Year 1+: projeter depuis Year 0 avec growth_rate_year2/3/4
};
```

### 4. Corriger la rémunération des dirigeants

**Règle choisie :** Dirigeants = bp_directors + charges fixes typées "présidence" ou "dirigeant"

Ajouter une fonction pour détecter les charges fixes de rémunération de direction :

```typescript
const getDirectorRemuneration = (): number => {
  // Somme des bp_directors
  const directorsTotal = financialData.directors.reduce((sum, d) => {
    const rem = d.monthly_remuneration || 0;
    const charges = rem * (d.charges_rate || 0);
    return sum + (rem + charges) * 12;
  }, 0);
  
  // Somme des charges fixes typées "présidence" / "dirigeant" / "refacturation"
  const fixedDirectorExpenses = financialData.fixedExpenses
    .filter(e => /prési|dirig|refact/i.test(e.name || ''))
    .reduce((sum, e) => sum + (e.monthly_amount || 0) * 12, 0);
  
  return directorsTotal + fixedDirectorExpenses;
};
```

### 5. Vérifier le tri chronologique des colonnes

S'assurer que le P&L affiche toujours N, N+1, N+2 dans le bon ordre :

```typescript
const getYearlyColumns = (): number[] => {
  const startYear = new Date(bpStartDate).getFullYear();
  return Array.from({ length: years }, (_, i) => startYear + i);
};
```

---

## Fichiers Impactés

| Fichier | Type de modification |
|---------|---------------------|
| `supabase/functions/generate-bp-pdf/index.ts` | Majeure (récupération données + calcul revenus) |

---

## Tests Recommandés

Après implémentation :
1. Créer un flux "variable" avec des montants mensuels saisis
2. Exporter le PDF et vérifier que le CA correspond aux montants saisis
3. Créer un flux "subscription" (SaaS) et vérifier le calcul auto
4. Tester un BP sans aucune prévision (doit afficher 0 € avec warning)
5. Vérifier l'ordre des colonnes (2026, 2027, 2028)

---

## Bénéfices

- Les revenus saisis dans `/bp/revenus` seront enfin pris en compte dans le PDF
- Le document sera cohérent avec ce que l'utilisateur voit dans l'interface web
- Les ratios financiers (point mort, EBITDA) seront calculés correctement

