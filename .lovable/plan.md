
# Plan : Simplification - Liste unifiée avec un modal unifié

## Analyse du problème

Actuellement :
- 2 onglets séparés (Charges fixes / Charges variables)
- 2 modales différentes avec des champs très différents
- Navigation complexe pour l'utilisateur

## Solution proposée

### 1. Suppression des onglets - Une seule liste unifiée

Afficher toutes les charges dans un seul tableau avec un **badge distinctif** pour identifier les charges variables.

```text
+--------------------------------------------------+
| Charges                              [+ Ajouter] |
+--------------------------------------------------+
| Nom             | Catégorie    | Montant   | ... |
|-----------------|--------------|-----------|-----|
| Loyer bureau    | 🏢 Loyer      | 2 000€   |     |
| Commission vte  | [Variable]   | 5% du CA  |     |
| Assurance       | 🛡️ Assurance | 150€     |     |
| Frais livraison | [Variable]   | 2€/unité  |     |
+--------------------------------------------------+
```

### 2. Badge distinctif pour les charges variables

Un petit badge coloré `Variable` affiché uniquement sur les lignes de charges variables :
- Couleur : `bg-amber-500/10 text-amber-600 border-amber-500/30`
- Icône : `Percent` pour indiquer le caractère proportionnel

### 3. Modal unifié avec sections conditionnelles

Un seul modal avec un switch pour choisir le type :

```text
+-----------------------------------------------+
| Nouvelle charge                               |
+-----------------------------------------------+
| Nom : [________________]                      |
|                                               |
| Type :  [● Fixe]  [○ Variable]                |
|                                               |
| --- Si FIXE ---                               |
| Catégorie | Périodicité | Montant             |
| [________]| [Mensuel ▼] | [____€]             |
|                                               |
| --- Si VARIABLE ---                           |
| Catégorie | Flux lié | Type calcul            |
| [________]| [Tous ▼] | [● %] [○ €/u]          |
| Valeur : [____%] ou [___€/unité]              |
|                                               |
| [Coût des ventes] (switch)                    |
+-----------------------------------------------+
| Dates début/fin | Notes                       |
| TVA (commun aux deux)                         |
+-----------------------------------------------+
```

## Modifications techniques

### 1. Créer `ExpenseDialog.tsx` (modal unifié)

Nouveau fichier qui combine les deux modales existantes :
- Switch en haut pour choisir Fixe/Variable
- Affiche conditionnellement les champs spécifiques
- Réutilise les constantes existantes (`FIXED_EXPENSE_CATEGORIES`, `VARIABLE_EXPENSE_CATEGORIES`)

### 2. Créer `ExpenseTable.tsx` (liste unifiée)

Nouveau composant qui affiche les deux types de charges :
- Fetch les deux listes (`useBPFixedExpenses` + `useVariableExpenses`)
- Tri par nom
- Badge `Variable` avec icône `Percent` sur les charges variables
- Colonnes adaptées : Nom, Type/Catégorie, Montant/Valeur, Période/Flux, Actions

### 3. Simplifier `Expenses.tsx`

- Supprimer les Tabs
- Utiliser le nouveau `ExpenseTable` unifié
- Utiliser le nouveau `ExpenseDialog` unifié
- Conserver les fonctionnalités : templates, édition en masse (pour les fixes uniquement)

### 4. Badge Variable - Design

```tsx
{isVariable && (
  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">
    <Percent className="h-3 w-3 mr-1" />
    Variable
  </Badge>
)}
```

## Avantages

1. **Plus simple** : Une seule vue, pas de navigation entre onglets
2. **Plus clair** : Badge visuel immédiat pour distinguer les types
3. **Plus rapide** : Un seul clic pour créer n'importe quelle charge
4. **Flexible** : Le switch dans le modal permet de changer de type facilement

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `src/features/business-plan/components/ExpenseTable.tsx` | Créer (liste unifiée) |
| `src/features/business-plan/dialogs/ExpenseDialog.tsx` | Créer (modal unifié) |
| `src/pages/BusinessPlan/Expenses.tsx` | Modifier (simplifier) |
| `src/features/business-plan/components/index.ts` | Exporter nouveau composant |
| `src/features/business-plan/dialogs/index.ts` | Exporter nouveau dialog |
