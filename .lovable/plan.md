

# ✅ Corrections Implémentées : Revenus du PDF Business Plan

## Diagnostic Initial

Le PDF Business Plan affichait **0 € de revenus** car la table `bp_revenue_forecasts` n'était jamais requêtée.

---

## Corrections Appliquées

### 1. ✅ Récupération des prévisions de revenus

**Fichier :** `supabase/functions/generate-bp-pdf/index.ts`

- Ajout de la requête `bp_revenue_forecasts` dans le Promise.all initial
- Ajout de `revenueForecasts: any[]` à l'interface `FinancialData`

### 2. ✅ Nouveau calcul des revenus basé sur les prévisions

**Logique implémentée :**
1. Pour chaque mois de l'année 1, chercher une prévision explicite dans `revenueForecasts`
2. Si `amount > 0` → utiliser cette valeur (saisie volontaire)
3. Si `amount === 0` → considérer comme "non saisi", fallback au calcul auto (SaaS) ou 0 (variable)
4. Pour les années 2+, appliquer les taux de croissance sur la base de l'année 1

**Fonctions ajoutées :**
- `formatDateYYYYMM01()` - Formatage de date pour lookup
- `getMonthlyRevenueForStream()` - Récupération du revenu mensuel avec fallback
- `calculateYearlyRevenue()` refactorisé - Somme des 12 mois depuis les prévisions

### 3. ✅ Rémunération des dirigeants complète

**Règle appliquée :** Dirigeants = `bp_directors` + charges fixes typées "présidence/dirigeant/refacturation"

**Fonctions ajoutées :**
- `calculateDirectorTableCosts()` - Somme des bp_directors
- `calculateDirectorFixedExpenses()` - Détection des charges fixes de direction via regex
- `calculateYearlyDirectorCosts()` refactorisé - Total des deux sources

**Mots-clés détectés :** `prési|dirig|refact|gérant|pdg|dg|directeur`

### 4. ✅ Validation des données améliorée

- Warning si CA = 0 mais charges présentes
- Suggestion de vérifier `/bp/revenus`

---

## Edge Function Déployée

La fonction `generate-bp-pdf` a été redéployée avec toutes les corrections.

---

## Tests Recommandés

1. Créer un flux "variable" avec des montants mensuels saisis → Le CA doit refléter ces montants
2. Créer un flux "subscription" sans prévisions → Le CA doit utiliser le calcul MRR auto
3. Ajouter une charge fixe "Rémunération présidence" → Elle doit apparaître dans les coûts dirigeants
4. Exporter le PDF et vérifier la cohérence avec l'interface web
