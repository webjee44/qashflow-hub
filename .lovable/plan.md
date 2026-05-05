## PR 4 — Refonte du PDF "qualité expert-comptable"

### Objectif
Le PDF actuel est "présentable" mais ne passe pas une revue banquier/DAF. PR 4 le transforme en livrable comptable sérieux : structure normée, traçabilité, badge de réconciliation, annexes obligatoires.

PR 1 a déjà unifié la source (`useBPModel`). PR 3 fournit le rapport de validation. PR 4 = uniquement présentation et complétude.

### Structure cible (sections du PDF)

1. **Page de garde**
   - Société, SIRET (si dispo), période couverte (24 mois / 3 exercices), date d'export, version du moteur (`engine_version`)
   - Badge réconciliation : `validation.ok ? "États réconciliés" : "X écarts détectés"` + détail en annexe

2. **Synthèse exécutive** (1 page)
   - CA, EBE, Résultat net, Trésorerie finale par exercice
   - Point bas trésorerie + mois
   - Seuil de rentabilité

3. **Compte de résultat** (PCG strict)
   - Déjà OK, garder le rendu actuel mais ajouter :
     - codes PCG visibles à gauche (706, 707, 60x, 61, 62, 63, 64, 65, 68, 69)
     - colonne % du CA par ligne
     - sous-totaux SIG explicites : Marge commerciale, Production, Valeur ajoutée, EBE, RE, Résultat avant impôt, Résultat net

4. **Bilan**
   - Déjà OK, ajouter :
     - ligne "ÉQUILIBRE ACTIF=PASSIF" avec delta affiché en bas
     - mention "Trésorerie issue du tableau de flux" (signal au lecteur que c'est dérivé)

5. **Tableau de flux de trésorerie** (vue annuelle, pas mensuelle)
   - Format normé : Flux exploitation / investissement / financement
   - Aujourd'hui le PDF affiche du mensuel cumulé → refonte en agrégation annuelle conforme

6. **Plan de financement** (3 ans)
   - Déjà OK, ajouter ratio Ressources/Emplois et CAF cumulée

7. **Ratios financiers + seuil de rentabilité**
   - Déjà OK, ajouter benchmarks sectoriels génériques (info, pas recommandation)

8. **Annexes** (nouveau)
   - **Hypothèses** : taux de croissance par stream, délais clients/fournisseurs, taux IS, taux URSSAF, méthode amortissement
   - **Détail des emprunts** : tableau d'amortissement année par année (capital restant dû, intérêts, capital remboursé)
   - **Détail du personnel** : effectif moyen, masse salariale brute, charges patronales, par poste
   - **Détail des investissements** : nature, montant, date, durée, dotation annuelle
   - **Rapport de réconciliation** (issu de PR 3) : liste des codes d'écarts, sévérité, montant, explication. Si tout est vert → "Aucun écart détecté".

### Implémentation

**Fichier principal** : `src/features/business-plan/pdf/BPDocument.tsx` (existe déjà après PR 1, prend `model: BPFinancialModel`).

Découpage en sous-composants pour lisibilité :
```
pdf/
├── BPDocument.tsx              (orchestrateur, prop unique `model`)
├── sections/
│   ├── CoverPage.tsx
│   ├── ExecutiveSummary.tsx
│   ├── ProfitLossSection.tsx   (refacto existant)
│   ├── BalanceSheetSection.tsx (refacto existant)
│   ├── CashFlowSection.tsx     (refonte annuelle)
│   ├── FundingPlanSection.tsx  (refacto existant)
│   ├── RatiosSection.tsx       (refacto existant)
│   └── annexes/
│       ├── HypothesesAnnex.tsx
│       ├── LoanScheduleAnnex.tsx
│       ├── PersonnelAnnex.tsx
│       ├── InvestmentsAnnex.tsx
│       └── ReconciliationAnnex.tsx  (consomme model.validation)
└── shared/
    ├── PDFTable.tsx            (composant table normalisée)
    ├── PDFHeader.tsx           (header de section avec code PCG)
    └── styles.ts               (palette imprimable, fonts, tailles)
```

**Règles de présentation** :
- Police : serif sobre pour le corps (ex Times) + sans-serif pour titres. Pas d'emoji, pas de couleur primaire vive sur PDF imprimé.
- Couleurs : noir, gris, bleu sobre `#1e3a5f` pour titres uniquement. Plus de gradient.
- Format A4 portrait, marges 20mm, n° de page "X / N"
- En-tête répété : nom société + "Business Plan 2026-2028" (dynamique)
- Pied : date d'export + version moteur + URL qashflow.io

### Données nécessaires (via `model`)
Tout est déjà dans `BPFinancialModel` après PR 1+3 :
- `model.pl`, `model.balanceSheet`, `model.cashFlow`, `model.fundingPlan`, `model.ratios`
- `model.validation` (PR 3)
- `model.input.investments`, `financings`, `personnel` pour les annexes
- `model.engineVersion` (à ajouter — constante string `'1.0.0'`)

### Tests
- `BPDocument.snapshot.test.tsx` : rendu React-PDF en buffer + snapshot du nombre de pages et taille (détecte régressions silencieuses).
- Test que `ReconciliationAnnex` rend bien tous les `validation.issues`.
- Test que les totaux affichés == valeurs `model.totals` (parité écran/PDF).

### QA visuel (mandatoire)
Conversion PDF → images via `pdftoppm`, inspection page par page :
- vérifier qu'aucun tableau ne déborde
- vérifier équilibre Actif = Passif visible en bas du bilan
- vérifier que l'annexe réconciliation affiche le bon contenu selon `validation.ok`
- vérifier en-têtes/pieds répétés sur chaque page

### Hors périmètre PR 4
- Pas de correction financière (PR 2)
- Pas d'export Excel/Word (autre PR)
- Pas de signature électronique / horodatage (autre PR)
- Pas de personnalisation utilisateur (logo, couleurs) — version "neutre banquier" uniquement V1

### Livrables
- Refonte modulaire de `BPDocument` en sections
- 5 annexes (Hypothèses, Emprunts, Personnel, Investissements, Réconciliation)
- Cash Flow refondu en présentation annuelle normée
- Page de garde + synthèse exécutive
- Codes PCG visibles, % du CA, SIG explicites
- Tests snapshot + QA visuel documenté

### Bénéfice final
Combiné aux PR 1/3 (et PR 2 quand exécutée), le PDF devient :
- réconciliable (badge + annexe explicite)
- traçable (engine_version, date, hypothèses)
- complet (annexes obligatoires d'un dossier de financement)
- conforme PCG dans la présentation

→ Passe la revue banquier/DAF.
