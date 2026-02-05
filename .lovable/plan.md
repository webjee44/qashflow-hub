
# Plan de mise en conformité PCG du Compte de Résultat

## Contexte

Le CTO a identifié des écarts entre le Compte de Résultat actuel (orienté "Contrôle de Gestion") et les normes bancaires françaises (PCG). Les banquiers attendent une Liasse Fiscale structurée par SIG (Soldes Intermédiaires de Gestion) et non un P&L orienté "Coûts fixes vs variables".

## Changements requis

### Phase 1 : Modifications de la base de données

**1.1 Ajouter un type de revenu sur bp_revenue_streams**

Nouvelle colonne pour distinguer :
- `merchandise` (707) : Ventes de marchandises (négoce/e-commerce)
- `production` (706) : Production vendue (services/artisanat)

```sql
ALTER TABLE bp_revenue_streams 
ADD COLUMN revenue_type TEXT DEFAULT 'production' 
CHECK (revenue_type IN ('merchandise', 'production'));
```

**1.2 Ajouter un type d'exploitation sur bp_financings**

Pour distinguer les subventions d'exploitation (74) des subventions d'investissement :

```sql
ALTER TABLE bp_financings 
ADD COLUMN is_operating_grant BOOLEAN DEFAULT true;
```

### Phase 2 : Intégration des Stocks (classe 603)

**2.1 Modification de useProfitLoss.ts**

Importer le hook `useStocks` et intégrer la variation de stocks dans le calcul :

- Récupérer les données de stocks par année fiscale
- Calculer : `Achats consommés = Achats + (Stock Initial - Stock Final)`
- Afficher une ligne "Variation des stocks" (compte 603/713)

Formule comptable :
```
Variation positive = Stock diminue = Charge (augmente le coût)
Variation négative = Stock augmente = Produit (réduit le coût)
```

### Phase 3 : Restructuration des produits d'exploitation

**3.1 Scinder le Chiffre d'Affaires**

Remplacer la ligne unique "Chiffre d'affaires" par :

```
I. PRODUITS D'EXPLOITATION
├── Ventes de marchandises (707)
├── Production vendue - Prestations de services (706)
├── Subventions d'exploitation (74)
└── TOTAL PRODUITS D'EXPLOITATION (I)
```

**3.2 Ajouter les subventions d'exploitation**

Filtrer les financings de type `grant` avec `is_operating_grant = true` et les inclure dans les produits d'exploitation avant l'EBE.

### Phase 4 : Reclassement des charges par nature PCG

**4.1 Nouvelle structure des charges d'exploitation**

```
II. CHARGES D'EXPLOITATION
├── Achats de marchandises (607)
├── Variation des stocks de marchandises (6037)
├── Achats de matières premières (601)
├── Variation des stocks de matières (6031)
├── Autres achats et charges externes (61/62)
│   ├── Sous-traitance (611)
│   ├── Locations (613)
│   ├── Entretien et réparations (615)
│   ├── Assurances (616)
│   ├── Études et recherches (617)
│   ├── Divers (618)
│   ├── Personnel extérieur (621)
│   ├── Rémunérations intermédiaires (622)
│   ├── Publicité, publications (623)
│   ├── Transports (624/625)
│   ├── Déplacements (626)
│   ├── Frais postaux et télécom (626)
│   ├── Services bancaires (627)
│   └── Divers (628)
├── Impôts, taxes et versements assimilés (63)
├── Salaires et traitements (641)
├── Charges sociales (645)
├── Autres charges de gestion courante (65)
└── Dotations aux amortissements (68)
```

**4.2 Déplacer le Crédit-bail**

Le crédit-bail (leasing) doit être dans les Services Extérieurs (612) et non après l'EBE :

```
Loyers de crédit-bail (612) → Impacte la VA et l'EBE
```

### Phase 5 : Calcul explicite des SIG (vue Banque)

**5.1 Ajouter les lignes SIG manquantes**

```
MARGE COMMERCIALE
= Ventes de marchandises - Coût d'achat des marchandises vendues

PRODUCTION DE L'EXERCICE
= Production vendue + Production stockée + Production immobilisée

VALEUR AJOUTÉE (VA)
= Marge commerciale + Production - Consommations en provenance des tiers (60/61/62)

EXCÉDENT BRUT D'EXPLOITATION (EBE) ← LIGNE CLÉ POUR LA BANQUE
= VA + Subventions (74) - Impôts (63) - Personnel (64)

RÉSULTAT D'EXPLOITATION
= EBE - Dotations aux amortissements (68) + Reprises - Autres charges (65)
```

**5.2 Mise à jour des calculs**

```typescript
// Marge Commerciale
const commercialMarginValues = years.map((_, i) => 
  merchandiseSalesValues[i] - merchandisePurchasesValues[i] - merchandiseStockVariationValues[i]
);

// Valeur Ajoutée
const vaValues = years.map((_, i) =>
  commercialMarginValues[i] + productionValues[i] - externalConsumptionValues[i]
);

// EBE (ligne la plus importante pour la banque)
const ebeValues = years.map((_, i) =>
  vaValues[i] + operatingGrantsValues[i] - taxesValues[i] - personnelValues[i]
);
```

### Phase 6 : Mise à jour du composant ProfitLossTable

**6.1 Nouveau visuel des sections**

| Section | Couleur | Style |
|---------|---------|-------|
| Produits (Revenus) | Emerald/Vert | Header vert foncé |
| Charges (Dépenses) | Rouge | Header rouge |
| SIG (Marges) | Bleu Primary | Gras, bordure |
| EBE | Bleu Primary | **Très visible**, bordure double |
| Résultat Net | Primary | Gras, taille augmentée |

### Phase 7 : Mises à jour des composants UI

**7.1 RevenueStreamDialog**

Ajouter un champ de sélection pour le type de revenu :

```typescript
<Select value={revenueType} onValueChange={setRevenueType}>
  <SelectItem value="production">Prestation de services (706)</SelectItem>
  <SelectItem value="merchandise">Vente de marchandises (707)</SelectItem>
</Select>
```

**7.2 FinancingDialog**

Ajouter un toggle pour les subventions :

```typescript
{financingType === 'grant' && (
  <Switch
    label="Subvention d'exploitation (74)"
    checked={isOperatingGrant}
    onCheckedChange={setIsOperatingGrant}
  />
)}
```

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `src/features/business-plan/hooks/useProfitLoss.ts` | Refonte majeure du calcul |
| `src/features/business-plan/components/ProfitLossTable.tsx` | Mise à jour du rendu |
| `src/constants/bpConstants.ts` | Ajout des nouvelles constantes PCG |
| `src/features/business-plan/dialogs/RevenueStreamDialog.tsx` | Ajout du champ revenue_type |
| `src/features/business-plan/dialogs/FinancingDialog.tsx` | Ajout du champ is_operating_grant |
| `src/services/revenueStreamService.ts` | Support du nouveau champ |
| `src/hooks/useBPRevenueStreams.ts` | Support du nouveau champ |
| Migration SQL | Ajout des colonnes revenue_type et is_operating_grant |

## Section technique détaillée

### Structure de données révisée pour PLRow

```typescript
export interface PLRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'sig' | 'total';
  values: number[];
  isExpense?: boolean;
  indent?: number;
  sectionType?: 'revenue' | 'expense' | 'result';
  pcgCode?: string; // Code PCG (ex: '707', '64', '68')
  isSIG?: boolean;  // Solde Intermédiaire de Gestion
}
```

### Nouvelle structure PLData.totals

```typescript
totals: {
  // Revenus
  merchandiseSales: number[];     // 707
  productionSold: number[];       // 706
  operatingGrants: number[];      // 74
  totalRevenue: number[];

  // Charges
  merchandisePurchases: number[]; // 607
  stockVariation: number[];       // 603/713
  externalServices: number[];     // 61/62
  taxes: number[];                // 63
  personnel: number[];            // 64
  depreciation: number[];         // 68
  
  // SIG
  commercialMargin: number[];
  grossMargin: number[];
  valueAdded: number[];
  ebitda: number[];               // EBE
  operatingResult: number[];
  financialResult: number[];
  netResult: number[];
}
```

### Calcul de la Marge Commerciale

```typescript
// Pour chaque flux de type "merchandise"
const merchandiseSalesValues = calculateYearlyValues(month => 
  streams
    .filter(s => s.revenue_type === 'merchandise')
    .reduce((sum, s) => sum + getRevenueForecast(s.id, month), 0)
);

// COGS des marchandises uniquement
const merchandiseCOGS = calculateYearlyValues(month => {
  return streams
    .filter(s => s.revenue_type === 'merchandise' && s.has_purchase_cost)
    .reduce((sum, s) => {
      const revenue = getRevenueForecast(s.id, month);
      return sum + (revenue * (s.purchase_price / 100));
    }, 0);
});

// Marge Commerciale = Ventes marchandises - Achats - Variation stocks marchandises
const commercialMarginValues = years.map((_, i) => 
  merchandiseSalesValues[i] - merchandiseCOGS[i] - getStockVariation(i + 1)
);
```

### Intégration des stocks

```typescript
// Dans useProfitLoss, ajouter :
const { getStockVariation, getTotalPurchases } = useStocks();

// Ligne de variation des stocks (peut être positive ou négative)
const stockVariationValues = years.map((_, yearIndex) => {
  return getStockVariation(yearIndex + 1); // fiscalYear est 1-indexed
});

// Affichage conditionnel
if (stockVariationValues.some(v => v !== 0)) {
  rows.push({ 
    label: 'Variation des stocks (603)', 
    type: 'item', 
    values: stockVariationValues, 
    isExpense: true, // ou false si négatif
    indent: 1,
    sectionType: 'expense',
    pcgCode: '603'
  });
}
```

## Points de vigilance

1. **Rétrocompatibilité** : Les données existantes doivent continuer à fonctionner avec `revenue_type = 'production'` par défaut

2. **Crédit-bail** : Actuellement affiché après les amortissements, doit être déplacé dans les Services Extérieurs (avant l'EBE)

3. **Rémunération dirigeant TNS** : Isoler pour montrer la capacité d'autofinancement avant rémunération si besoin

4. **Taxes** : Séparer les taxes sur salaires (63) de l'IS (69) qui reste après le RCAI

5. **EBE** : Doit être **très visible** car c'est le KPI clé pour les banquiers (capacité de remboursement)
