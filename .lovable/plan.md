
# Correctif : Fiabilité 100% de l'export PDF du Business Plan

## Probleme identifie

Le PDF exporte des chiffres differents de la vue web car il utilise **deux sources de donnees independantes** :
- Le hook `useProfitLoss` (calculs complexes, corrects) pour la section P&L
- Les donnees brutes (personnel, fixedExpenses, etc.) avec des calculs simplifies pour les sections detail (charges, personnel, investissements)

Les calculs simplifies du PDF ignorent : les dates de debut/fin, les frequences de paiement, les taux de charges detailles, les indemnites de depart, etc.

## Solution : Source unique de verite

Faire en sorte que **TOUTES les valeurs financieres du PDF proviennent exclusivement de `plData`** (le meme objet que la vue web). Les donnees brutes ne seront utilisees que pour les informations descriptives (noms, dates, categories).

## Modifications techniques

### 1. BPDocument.tsx - Refonte des sections detail

**Section Charges Previsionnelles** :
- Les charges fixes : garder le listing descriptif (nom, categorie, montant/mois) mais le total annuel utilisera `plData.totals.fixedExpenses[yearIndex]` au lieu de `monthly_amount * 12`
- Les charges variables : listing descriptif uniquement (nom, type, pourcentage), pas de totaux recalcules

**Section Personnel** :
- Salaries : listing descriptif (poste, date embauche, brut mensuel, taux charges) mais le total "Cout annuel" utilisera `plData.totals.personnelCosts[yearIndex]`
- Dirigeants : idem avec `plData.totals.directorsCosts[yearIndex]`

**Section Investissements** :
- Listing descriptif inchange (nom, categorie, montant, duree amortissement)
- Total utilisant `plData.totals.depreciation` pour la dotation annuelle

**Section Resume Executif** :
- Deja correct (utilise `plData.totals`) - aucun changement

**Section Revenue** :
- Deja correct (utilise `plData.totals.revenue`) - aucun changement

### 2. Section P&L (PnlSection) - Aucun changement
Cette section rend deja `plData.rows` directement, c'est un miroir fidele de la vue web.

### 3. Sections Cash Flow, Bilan, Plan de Financement
- Deja alimentees par les hooks dedies (cashFlowData, bsData, fpData) - aucun changement

### 4. Suppression des props raw data inutiles de BPDocument
- Retirer `revenueStreams`, `fixedExpenses`, `variableExpenses`, `personnel`, `directors`, `investments` des props de BPDocument
- Ajouter a la place les totaux pre-calcules necessaires depuis `plData.totals`
- Simplifier BPExportDialog en retirant les 6 requetes Supabase dediees aux donnees brutes

## Fichiers impactes

1. **src/features/business-plan/pdf/BPDocument.tsx** - Refonte majeure : toutes les valeurs financieres depuis plData
2. **src/features/business-plan/dialogs/BPExportDialog.tsx** - Suppression des requetes raw data, passage de plData uniquement

## Resultat attendu

- Zero ecart possible entre la vue web et le PDF : meme hook, meme objet de donnees
- Les sections detail restent informatives (noms, parametres) sans recalculer de totaux
- Le P&L du PDF est un miroir exact de la table interactive
