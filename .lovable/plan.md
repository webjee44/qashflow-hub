

# Donnees de demonstration pour le Business Plan

## Objectif

Reduire le churn a l'onboarding en pre-remplissant le Business Plan avec des donnees de demonstration realistes. L'utilisateur voit immediatement un BP "vivant" (graphiques, P&L, cash flow) au lieu d'un ecran vide. Un bouton "Supprimer les donnees de demo" permet de nettoyer en un clic.

## Approche

### 1. Edge function `seed-bp-demo-data`

Creer une edge function qui insere des donnees de demo pour un BP donne. Elle sera appelee automatiquement apres la creation du premier BP. Les donnees inserees :

- **2 flux de revenus** avec forecasts mensuels (12 mois) :
  - "Prestations de services" (variable, montants progressifs de 5 000 a 12 000 EUR/mois)
  - "Abonnements SaaS" (subscription, 50 abonnes a 49 EUR/mois, +8% croissance)
- **5 charges fixes** (template "conseil" simplifie) :
  - Loyer bureau (800 EUR), Assurance RC Pro (150 EUR), Outils SaaS (100 EUR), Comptabilite (180 EUR), Marketing (300 EUR)
- **1 salarie** : "Developpeur Full-Stack", salaire brut 3 500 EUR
- **1 investissement** : "Materiel informatique", 5 000 EUR, amorti sur 3 ans

Toutes les lignes creees auront un champ metadata `is_demo: true` pour les identifier (via une colonne `is_demo` ajoutee aux tables concernees).

### 2. Colonne `is_demo` sur les tables BP

Ajouter une colonne `is_demo boolean DEFAULT false` sur :
- `bp_revenue_streams`
- `bp_revenue_forecasts`
- `bp_fixed_expenses`
- `bp_personnel`
- `bp_investments`

### 3. Appel automatique apres creation du BP

Dans `useCurrentBusinessPlan`, apres la creation reussie du BP, appeler l'edge function `seed-bp-demo-data` avec le `business_plan_id` et `company_id`.

Un flag localStorage `bp-demo-seeded-{companyId}` empechera de re-seeder si l'utilisateur a deja supprime les donnees demo.

### 4. Banniere "Donnees de demonstration" + bouton supprimer

Ajouter un composant `DemoDataBanner` affiche en haut des pages BP quand des donnees `is_demo = true` existent. Il affichera :

```
Donnees de demonstration chargees pour vous aider a demarrer.
[Supprimer les donnees de demo]
```

Le bouton supprime toutes les lignes `is_demo = true` de la company en une seule action (via un appel RPC ou des deletes cascades). Une fois supprimees, la banniere disparait.

### 5. Composant `DemoDataBanner`

Place dans les pages BP (RevenueAssumptions, Expenses, Team, Investments) ou dans le layout BP commun. Il utilise un hook `useDemoData` qui :
- Verifie si des lignes `is_demo = true` existent pour la company
- Fournit une fonction `clearDemoData()` qui supprime toutes ces lignes
- Retourne `hasDemoData: boolean`

## Details techniques

**Fichiers crees :**
- `supabase/functions/seed-bp-demo-data/index.ts` -- edge function d'insertion
- `src/hooks/useBPDemoData.ts` -- hook pour detecter/supprimer les donnees demo
- `src/components/onboarding/DemoDataBanner.tsx` -- banniere UI

**Fichiers modifies :**
- `supabase/migrations/` -- ajout colonne `is_demo` sur 5 tables
- `src/features/business-plan/hooks/useCurrentBusinessPlan.ts` -- appel seed apres creation
- `src/pages/BusinessPlan/RevenueAssumptions.tsx` -- ajout `DemoDataBanner`
- `src/pages/BusinessPlan/Expenses.tsx` -- ajout `DemoDataBanner`
- `src/pages/BusinessPlan/Team.tsx` -- ajout `DemoDataBanner`
- `src/pages/BusinessPlan/Investments.tsx` -- ajout `DemoDataBanner`

**Impact :** Les utilisateurs existants ne sont pas affectes (colonne `is_demo` default `false`). Seuls les nouveaux BP auto-crees recevront les donnees de demo.

