## Contexte

Tu signales un résultat net de **−892 K€** sur Cloud Vapor. J'ai audité le code (`useProfitLoss.ts`) **et** les données BP en base. Mon analyse ne reproduit pas ce chiffre.

## Ce que j'ai vérifié

### 1. Les "suspects classiques" évoqués sont déjà OK dans le code

- **Taux salariés / dirigeants** : code = `salary * Number(p.employer_charges_rate)`. En base, les taux Cloud Vapor sont bien stockés en décimal (`0.383`, `0.513`, `0.898`, …), donc **pas de ×100**. Idem charges_rate dirigeants (table vide pour Cloud Vapor).
- **Taux d'intérêt** : `getLoanScheduleEntry` divise par 100 à l'intérieur (`annualRatePercent / 100 / 12`), et les taux en base sont au bon format (0.73, 4.35, etc.). Cohérent.
- **Growth/churn** : `getRevenueForecast` divise par 100. Cloud Vapor a une seule année de forecast manuel (2026), donc growth_rate n'est pas appliqué.
- **Double comptage COGS / services extérieurs** : le code utilise `category === 'cogs'` d'un côté et `category !== 'cogs'` de l'autre — c'est **mutuellement exclusif**. Pas de double compte (le `is_cogs !== false` mentionné dans le ticket n'existe plus dans le code actuel).
- **Stream `Ventes B2B`** : `has_purchase_cost = false`, `purchase_price = 0`. Plus de double comptage avec "Achats flacons".

### 2. Estimation manuelle 2026 (à partir des données réelles en base)

```
CA HT                                    3 004 678
- Achats matières (44,3% CA)            -1 331 072
- Services extérieurs variables (3,02%)    -90 741
- Charges externes fixes (rent, marketing,
  prof_fees, insurance, banking, telecom,
  travel, utilities)                       ~−420 000
- Personnel (salaires + charges)           −179 108
- Autres charges 65 (ajustement 12 647 €
  + divers)                                ~−160 000
- Fournitures bureau (606)                  ~−36 000
- Impôts/taxes (63)                         ~−15 000
- Dotations amortissements                  ~−28 000
- Intérêts                                  ~−10 000
                                          -----------
RCAI estimé                                 ~+735 000
- IS                                        ~−170 000
                                          -----------
Résultat net estimé                         ~+560 000
```

Donc **le −892 K€ ne s'explique ni par les données ni par la logique de calcul actuelle**. Il y a un facteur que je ne vois pas depuis l'analyse statique.

### 3. Anomalies réelles repérées en passant

- **38 lignes `bp_fixed_expenses` avec `category = 'services'`** (Location GRENKE 3 616 €/mois, Location Peugeot, sous-traitance, etc., ~8 000 €/mois). La category `services` **n'est référencée dans AUCUN filtre** du P&L. Ces dépenses sont donc actuellement **complètement ignorées** (~96 K€/an perdues côté charges → résultat artificiellement gonflé). C'est un bug propre, indépendant du −900 K€.
- L'ajustement Q1 (12 647 €/mois) a été créé en `category='other'` → correctement compté dans "Autres charges de gestion courante (65)".

## Plan d'action proposé

### Étape 1 — Instrumenter le P&L (bloquant)

Ajouter un `console.debug` (déclenché par flag `?debug=pnl` dans l'URL ou paramètre dev) qui dump pour chaque année :

```
CA total / par stream
COGS variables (category='cogs')
COGS issus de purchase_cost streams
Services extérieurs variables (category!='cogs')
Charges fixes par category (rent, services, marketing, …)
Salaires bruts / charges sociales / total
Dirigeants
Amortissements
Leasing
Intérêts
RCAI / IS / Net
```

Tu lances la page avec ce flag et me copies le dump. **C'est la seule façon fiable** de localiser la ligne qui crée le trou.

### Étape 2 — Corriger les 2 vrais bugs identifiés

**A. `category='services'` orpheline** dans le filtre des services extérieurs :

```ts
const serviceCategories = [
  'rent', 'insurance', 'telecom', 'marketing',
  'professional_fees', 'banking', 'travel', 'utilities',
  'services',  // ← MANQUANT
];
```

**B. Hardener `normalizeRate`** (ceinture + bretelles, même si la base est saine aujourd'hui) :

```ts
// src/lib/rateUtils.ts
export const normalizeRate = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n > 1 ? n / 100 : n;
};
```

À utiliser dans `getPersonnelBreakdownForMonth`, `getDirectorsBreakdownForMonth`, `getRevenueForecast` (growth/churn), `calculateVariableExpenseForMonth` (percentage déjà géré en /100, mais on protège). + tests unitaires.

### Étape 3 — Tests de non-régression

Ajouter `useProfitLoss.test.ts` avec scénario type :
- CA 1 000 000, COGS 60% via variable expense, salaires 100 K, charges 45%, charges fixes 50 K
- Vérifier que résultat ne diverge jamais d'un facteur 100 (garde-fou normalisation).

### Étape 4 (conditionnelle) — Selon résultat de l'étape 1

Une fois le dump obtenu, on identifie la ligne fautive et on corrige la cause racine (pas un patch). Hypothèses à explorer si rien n'apparaît :
- cache React Query non invalidé (tu vois un calcul ancien)
- un BP secondaire/scenario actif avec multiplicateurs pourris
- un investissement avec `depreciation_years` à 0 ou 1 (division/durée courte explosive)

## Ce que je **refuse** de faire

- Corriger en dur le résultat ou ajouter un facteur correctif "ad hoc"
- Modifier les données Cloud Vapor avant d'avoir compris la cause
- Patcher l'UI pour cacher le chiffre

## Décision

Tu valides ?
1. J'ajoute l'instrumentation debug + je corrige `category='services'` + `normalizeRate` + tests
2. Tu lances la page Compte de Résultat avec `?debug=pnl`, tu me colles le dump
3. On corrige la cause racine du −900 K€ identifiée à l'étape 2