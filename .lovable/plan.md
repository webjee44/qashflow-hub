

# Donnees de demonstration pour les Previsions de tresorerie

## Objectif

Meme logique que le Business Plan : pre-remplir le tableau de previsions avec des montants realistes par categorie pour que l'utilisateur voie immediatement un tableau "vivant" au lieu de lignes vides. Un bouton "Supprimer les donnees de demo" nettoie tout en un clic.

## Donnees a seeder

Pour les categories par defaut qui existent deja (creees automatiquement par `useCategories`), on insere 6 mois de previsions (mois courant + 5 suivants) :

**Encaissements :**
- Ventes : 8 000, 8 500, 9 000, 9 500, 10 000, 10 500 EUR/mois (croissance)
- Prestations : 5 000, 5 200, 5 400, 5 600, 5 800, 6 000 EUR/mois

**Decaissements :**
- Salaires : 4 500 EUR/mois (stable)
- Loyer : 1 200 EUR/mois (stable)
- Fournisseurs : 2 000, 2 100, 2 200, 2 300, 2 400, 2 500 EUR/mois
- Marketing : 800, 900, 1 000, 1 100, 1 200, 1 300 EUR/mois
- Logiciels : 350 EUR/mois (stable)

## Approche technique

### 1. Colonne `is_demo` sur `category_forecasts`

Ajouter `is_demo boolean DEFAULT false` pour identifier les lignes de demo.

### 2. Edge function `seed-forecast-demo-data`

Recoit `company_id` en parametre. Elle :
- Recupere les categories existantes de la company
- Mappe chaque categorie par nom aux montants predefinis
- Insere 6 mois de `category_forecasts` avec `is_demo = true`

### 3. Declenchement automatique

Dans la page `Forecasts.tsx`, verifier au montage si des forecasts existent. Si aucune et pas de flag localStorage `forecast-demo-seeded-{companyId}`, appeler la fonction de seed.

### 4. Banniere + suppression

Reutiliser le meme pattern que `DemoDataBanner` du BP :
- Hook `useForecastDemoData` qui detecte les lignes `is_demo = true` dans `category_forecasts`
- Composant `ForecastDemoBanner` avec bouton de suppression
- Affiche en haut de la page Previsions

## Details techniques

**Fichiers crees :**
- `supabase/functions/seed-forecast-demo-data/index.ts`
- `src/hooks/useForecastDemoData.ts`
- `src/components/forecasts/ForecastDemoBanner.tsx`

**Fichiers modifies :**
- `supabase/migrations/` -- ajout colonne `is_demo` sur `category_forecasts`
- `src/pages/Forecasts.tsx` -- ajout banniere + appel seed automatique

**Impact :** Aucun impact sur les utilisateurs existants (colonne default `false`). Seules les nouvelles companies sans previsions recevront les donnees de demo.

