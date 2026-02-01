
# Import depuis Business Plan vers Prévisions

## Objectif
Ajouter un bouton "Import depuis BP" sur la page `/previsions` qui permet d'importer automatiquement le C.A. du Business Plan vers les prévisions de trésorerie, converti en TTC (montant + TVA).

## Flux utilisateur

```text
1. Clic sur "Import depuis BP" 
   |
   v
2. Modal s'ouvre avec la liste des flux de revenus du BP
   - Affichage: nom du flux, montant HT année 1, taux TVA, montant TTC calculé
   - Checkbox pour sélectionner les flux à importer
   |
   v
3. Sélection de la catégorie de destination
   - Dropdown: catégorie "Ventes" ou autre catégorie income existante
   - Option de créer une nouvelle catégorie si nécessaire
   |
   v
4. Aperçu des montants par mois (TTC)
   |
   v
5. Clic "Importer"
   - Upsert des prévisions dans category_forecasts
   - Source = 'bp_import' pour tracer l'origine
```

## Données récupérées du BP

Pour chaque flux de revenus (`bp_revenue_streams`):
- **Montant mensuel HT** via `getForecast(streamId, month)`
- **Taux de TVA** via `stream.vat_rate` (ex: 0.20 = 20%)
- **Montant TTC** = Montant HT × (1 + taux TVA)

Les 6 premiers mois de l'année fiscale du BP seront mappés sur les 6 mois de prévisions du module trésorerie.

## Fichiers à créer

```text
src/components/forecasts/BPImportDialog.tsx   # Dialog d'import
```

## Fichiers à modifier

```text
src/pages/Forecasts.tsx                       # Ajout du bouton
src/components/forecasts/ForecastTable.tsx    # (optionnel) header actions
```

## Composant BPImportDialog

Interface multi-étapes:

**Étape 1: Sélection des flux**
- Liste des flux de revenus actifs du BP
- Checkbox pour chaque flux
- Affichage montant HT Année 1, TVA, Total TTC
- Total sélectionné en bas

**Étape 2: Mapping catégorie**
- Dropdown pour choisir la catégorie de destination (type income)
- Les montants de tous les flux sélectionnés seront agrégés par mois

**Étape 3: Aperçu et confirmation**
- Tableau des 6 mois avec montants TTC
- Bouton "Importer"

## Logique de calcul TTC

```typescript
// Pour chaque mois
const monthlyTTC = selectedStreams.reduce((sum, stream) => {
  const monthlyHT = getForecast(stream.id, month);
  const vatRate = stream.vat_rate || 0.20; // Défaut 20%
  return sum + (monthlyHT * (1 + vatRate));
}, 0);
```

## Section technique

### Hook useRevenueStreams
- Déjà disponible avec `streams`, `getForecast`, `bpStartDate`
- Le taux TVA est stocké dans `stream.vat_rate` (format décimal: 0.20 = 20%)

### Hook useForecasts
- Méthode `upsertForecast` déjà disponible
- Accepte `categoryId`, `month`, `expectedAmount`
- Source sera ajouté: 'bp_import'

### Mapping des mois
Les mois du BP (basés sur `bp_start_date`) doivent être alignés avec les 6 prochains mois de prévisions:

```typescript
// BP: février 2026, mars 2026, avril 2026...
// Prévisions: les 6 prochains mois à partir de today
// On mappe mois à mois selon l'index
```

### Gestion des doublons
Si des prévisions existent déjà pour la catégorie/mois:
- Écrasement (upsert) avec les nouvelles valeurs
- Toast d'avertissement avant import

## Estimation
- Fichiers à créer: 1
- Fichiers à modifier: 1-2
- Complexité: Faible à moyenne
