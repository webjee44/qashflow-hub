## PR 2 — Corrections financières (sur moteur unifié PR 1)

### Cause racine
Les états ne se réconcilient pas car chaque statement applique sa propre logique sur les mêmes inputs, sans contrat partagé :
- Le P&L ventile par catégorie mais la tréso ré-agrège par "name.includes('capital')" (heuristique string fragile).
- Le bilan déduit la trésorerie par équilibre forcé `Passif - Actif fixe - BFR` au lieu de reprendre `cashFlow.balance` (la balance bilan ≠ balance tréso).
- Les dettes fiscales/sociales sont approximées (`personnelCosts × 0.10`) au lieu de venir d'un échéancier réel.
- Les charges sociales personnel sont comptées 2 fois (via `personnelCosts` qui inclut déjà `employer_charges` ET via `payrollTaxes`).
- Les remboursements de prêts en tréso = `monthly_payment` (capital+intérêts), mais en P&L seul l'intérêt est en charge → l'amortissement capital n'apparaît nulle part dans le bilan (dette ne décroît pas correctement vs capital remboursé).
- Cloud Vapor : streams de négoce classés en 706 (services) car `revenue_type` par défaut à `production`.

### Stratégie : 5 lots séquentiels, chacun = 1 PR atomique

Chaque lot :
1. ajoute son test de non-régression dans `engine-parity.cloud-vapor.test.ts` (fige les nouveaux invariants)
2. ne touche QU'À l'engine (pas de hook, pas d'UI, pas de PDF — PR 1 garantit déjà la propagation)
3. produit un delta chiffré documenté (avant/après sur Cloud Vapor)

---

### Lot 2.1 — Source unique de la trésorerie (réconciliation Bilan ↔ Cash Flow)
**Symptôme** : Bilan trésorerie ≠ Cash Flow `finalBalance` année par année.
**Fix** : `computeBalanceSheet` reçoit `cashFlowData` et lit `cash[year] = cashFlowData.balance[lastMonthOfYear]`. La ligne "Trésorerie" du bilan devient dérivée, pas calculée par soustraction. Le total passif s'équilibre via les capitaux propres + dettes (et non l'inverse).
**Invariant testé** : `balanceSheet.cash[i] === cashFlow.balance[lastMonthOfYearI]` pour tout i.
**Risque** : faible. Touche 1 fonction. Aucune régression P&L.
**Impact CTO** : résout le point #1 (réconciliation).

### Lot 2.2 — Suppression de la double-comptabilisation charges sociales
**Symptôme** : `personnelCosts` (P&L) inclut déjà `gross + employerCharges`. La tréso ressort en plus `payrollTaxes` séparément → cash sortie ≈ 1.4× la réalité.
**Fix** : décider une convention unique :
- `personnelCosts` P&L = salaires bruts uniquement
- `payrollTaxes` P&L = charges patronales (URSSAF) calculées sur les bruts actifs
- Tréso somme `personnel + payrollTaxes` (déjà le cas) → plus de double comptage
Mettre à jour `computePL.getPayrollTaxesForMonth` pour qu'il calcule TOUTES les charges patronales (y compris `employer_charges_rate` perso) et retirer `employer_charges` de `personnelCosts`.
**Invariant testé** : `cashFlow.outflows.personnel + payrollTaxes` (sur 12 mois) = somme des coûts employeur P&L (brut + URSSAF + charges perso).
**Risque** : moyen. Modifie le calcul P&L. Le total reste identique mais la ventilation change.
**Impact CTO** : résout l'écart cash vs P&L sur masse salariale.

### Lot 2.3 — Amortissement des emprunts dans le bilan
**Symptôme** : `bankLoansValues` du bilan utilise déjà `getLoanScheduleEntry.remaining` (ok), mais le P&L ne sort que les intérêts. Le remboursement capital (= cash sortant en tréso) n'a pas de contre-partie comptable côté passif → bilan déséquilibré sur prêts.
**Fix** : vérifier que `cashFlow.outflows.loanPayments` = `interest + principal` cohérent avec `bankLoans[i] - bankLoans[i-1] = -principal_year_i`. Ajouter ligne explicite "Remboursement d'emprunts" en tréso (déjà `loanPayments`) mais documenter qu'elle = intérêt (P&L) + capital (réduction passif).
Tests d'équilibre : `Σ(loanPayments cash year) = Σ(interest P&L year) + (bankLoans[y-1] - bankLoans[y])`.
**Risque** : faible. Vérification + test. Aucun calcul à changer si la formule actuelle est correcte ; sinon corriger `getLoanScheduleEntry`.
**Impact CTO** : résout l'inconnue sur dette financière.

### Lot 2.4 — Dettes fiscales/sociales basées sur l'échéancier réel
**Symptôme** : `taxDebtsValues = corporateTax + personnelCosts × 0.10`. Magique.
**Fix** : remplacer par :
- Dette IS : `corporateTax_année - acomptes payés en année` (acomptes IS = 4 fois/an si > seuil)
- Dette URSSAF : 1 mois de payrollTaxes (cycle mensuel) ou 3 mois (DSN trimestrielle PME)
- Dette TVA : `vat.balance` du dernier mois si > 0
**Invariant testé** : pas de constante magique, formule = (charges N - paiements cash N) au 31/12.
**Risque** : moyen. Touche bilan + nouveau besoin d'expliciter les paiements fiscaux mensuels.
**Impact CTO** : résout le point "10% arbitraire".

### Lot 2.5 — Détection capital/subvention robuste (fin des heuristiques string)
**Symptôme** : `name.includes('capital')` pour détecter les apports en cash flow. Cassé si renommé.
**Fix** : utiliser `financing_type` strict :
- `equity_contribution` (nouveau type ou `current_account` avec flag `is_capital`)
- `grant` avec `is_operating_grant=false` → bilan + tréso investissement
- `grant` avec `is_operating_grant=true` → P&L produits
Migration nullable : si type absent, fallback sur l'heuristique actuelle avec warning console (transitoire).
**Risque** : faible si fallback conservé. Migration data optionnelle.
**Impact CTO** : robustesse.

### Hors PR 2 (planifiés pour PR 3+)
- Cloud Vapor revenue_type : c'est un fix data, pas code. À traiter via UI BP "type de revenu" + script de re-classification une fois.
- Refonte PDF (PR 4 du plan original).
- Validateur global "états réconciliés" (PR 3).

---

### Ordre d'exécution recommandé
**2.1 → 2.3 → 2.2 → 2.4 → 2.5**

Raison : 2.1 (réconciliation tréso↔bilan) débloque les invariants de réconciliation. 2.3 valide la dette financière sans rien changer. 2.2 change la convention salariale (le plus à risque) une fois les autres invariants en place. 2.4 et 2.5 sont des nettoyages.

Chaque lot = 1 commit, 1 test fixé, 1 delta chiffré sur Cloud Vapor avant le suivant.
