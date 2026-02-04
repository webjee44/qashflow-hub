
# Plan : Supprimer les totaux multi-années de tout le module Business Plan

## Problème identifié

La colonne "Total sur X ans" et les métriques cumulées sur plusieurs années n'ont pas de sens en comptabilité. Un compte de résultat s'analyse année par année, jamais en additionnant les exercices.

## Fichiers à modifier

### 1. Tableau P&L - `ProfitLossTable.tsx`

**Supprimer :**
- La colonne header "Total (X ans)" (lignes 88-93)
- La colonne header "%CA" (ligne 94)
- Les cellules Total et %CA dans chaque ligne (lignes 99, 131-148)

**Résultat :** Le tableau affichera uniquement les colonnes Année 1, Année 2, Année 3 (selon bp_years)

### 2. Page P&L - `ProfitLoss.tsx`

**Modifier les 4 cards du haut :**
- Actuellement : affichent "CA Total (3 ans)" avec le détail "An X: ..."
- Après : afficheront uniquement la **dernière année** ou l'**année sélectionnée**

Les cards deviendront dynamiques et afficheront les valeurs de l'année choisie dans le sélecteur.

### 3. Hook useProfitLoss - `useProfitLoss.ts`

**Supprimer :**
- L'objet `grandTotal` de l'interface `PLData` (lignes 52-69)
- Le calcul de `grandTotal` via `sumAll()` (lignes 757-780)
- L'export de `grandTotal` dans le return

**Conserver :**
- Les fonctions `getGrossMargin()` et `getEBITDAMargin()` mais les recalculer par année
- Le calcul par année dans `totals` reste intact

### 4. Tableau Cash Flow - `BPCashFlowTable.tsx`

**Supprimer :**
- La ligne "Solde final" avec totalInflows/totalOutflows (lignes 267-287)

Le tableau terminera simplement avec le dernier mois de la projection.

### 5. Tableau Plan de Financement - `FundingPlanTable.tsx`

**Supprimer :**
- La colonne "Total" du header (ligne 75)
- Le calcul et affichage du total par ligne (lignes 80, 111-119)

### 6. ScenarioCard - `ScenarioCard.tsx`

**Supprimer :**
- La section "Total (X ans)" avec CA total, Charges totales, Résultat cumulé (lignes 135-150)

**Conserver :**
- Le "Résultat Année 1" qui est pertinent pour comparer les scénarios

### 7. Hook Cash Flow - `useBPCashFlow.ts`

**Supprimer :**
- Les propriétés `totalInflows` et `totalOutflows` de l'interface et du calcul

**Conserver :**
- `finalBalance` qui représente le solde en fin de période (utile)

---

## Détail technique

### Interface PLData après modification

```typescript
export interface PLData {
  years: FiscalYear[];
  rows: PLRow[];
  totals: {
    revenue: number[];       // Par année
    cogs: number[];
    fixedExpenses: number[];
    // ... tous les autres restent par année
    netResult: number[];
  };
  // grandTotal: SUPPRIMÉ
  tva: { ... };
}
```

### ProfitLossTable après modification

```tsx
<TableHeader>
  <TableRow>
    <TableHead>Libellé</TableHead>
    {data.years.map((year, i) => (
      <TableHead key={i}>Année {i + 1}</TableHead>
    ))}
    {/* Plus de colonne Total ni %CA */}
  </TableRow>
</TableHeader>
```

### Cards P&L dynamiques (nouvelle logique)

```tsx
// Utiliser selectedYear pour afficher les valeurs
<Card>
  <CardContent>
    <p className="text-sm">Chiffre d'affaires</p>
    <p className="text-2xl font-bold">
      {formatCurrency(data.totals.revenue[selectedYear])}
    </p>
    <p className="text-xs">Année {selectedYear + 1}</p>
  </CardContent>
</Card>
```

---

## Résumé des suppressions

| Composant | Élément supprimé |
|-----------|------------------|
| ProfitLossTable | Colonnes "Total" et "%CA" |
| ProfitLoss page | Cards avec totaux cumulés → Année sélectionnée |
| useProfitLoss | Interface et calcul `grandTotal` |
| BPCashFlowTable | Ligne "Solde final" avec totaux |
| FundingPlanTable | Colonne "Total" |
| ScenarioCard | Section "Total (X ans)" |
| useBPCashFlow | `totalInflows`, `totalOutflows` |

---

## Impact sur les autres composants

- `RatiosCard` : Utilise déjà `yearIndex` donc pas d'impact
- `BreakEvenChart` : Utilise déjà `yearIndex` donc pas d'impact
- `BPExportDialog` : À vérifier si utilise grandTotal → adapter si besoin
