
# Plan : Refonte UX du Tableau de Prévisions - Colonnes Dynamiques

## Objectif

Simplifier l'affichage du tableau de prévisions en affichant uniquement les colonnes pertinentes selon la période temporelle :

| Période | Colonnes affichées |
|---------|-------------------|
| Mois passés | Réel uniquement |
| Mois en cours | Réel + Prévu |
| Mois futurs | Prévu uniquement |

---

## Logique Temporelle

```text
Aujourd'hui : Février 2026

Déc 2025    Jan 2026    Fév 2026    Mar 2026    Avr 2026
   │           │           │           │           │
   ▼           ▼           ▼           ▼           ▼
 [Réel]     [Réel]    [Réel|Prévu]  [Prévu]    [Prévu]
  passé      passé       actuel      futur      futur
```

---

## Modifications Techniques

### 1. Nouveau Helper de Détection Temporelle

Créer une fonction pour déterminer le type de période de chaque mois :

```typescript
type MonthPeriodType = 'past' | 'current' | 'future';

const getMonthPeriodType = (month: Date): MonthPeriodType => {
  const today = new Date();
  const currentMonthStart = startOfMonth(today);
  const monthStart = startOfMonth(month);
  
  if (isBefore(monthStart, currentMonthStart)) return 'past';
  if (isSameMonth(month, today)) return 'current';
  return 'future';
};
```

### 2. Refonte des En-têtes de Colonnes (thead)

Les sous-colonnes "Réel" / "Prévu" seront conditionnelles :

- **Passé** : Une seule sous-colonne "Réel"
- **Actuel** : Deux sous-colonnes "Réel" + "Prévu"
- **Futur** : Une seule sous-colonne "Prévu"

```text
Avant :
┌─────────┬─────────┬─────────┬─────────┐
│ Jan 26  │ Fév 26  │ Mar 26  │ Avr 26  │
├────┬────┼────┬────┼────┬────┼────┬────┤
│Réel│Prévu│Réel│Prévu│Réel│Prévu│Réel│Prévu│
└────┴────┴────┴────┴────┴────┴────┴────┘

Après :
┌─────────┬─────────────┬─────────┬─────────┐
│ Jan 26  │   Fév 26    │ Mar 26  │ Avr 26  │
├─────────┼──────┬──────┼─────────┼─────────┤
│  Réel   │ Réel │ Prévu│  Prévu  │  Prévu  │
└─────────┴──────┴──────┴─────────┴─────────┘
```

### 3. Refonte des Cellules de Données

Chaque fonction de rendu (`renderCell`, `renderGroupRow`, `renderTotalRow`, etc.) sera mise à jour pour :

- **Passé** : Afficher uniquement la valeur "Réel" (cellule simple, lecture seule)
- **Actuel** : Afficher les deux valeurs (Réel cliquable + Prévu éditable)
- **Futur** : Afficher uniquement la valeur "Prévu" (cellule simple, éditable)

### 4. Largeur Dynamique des Colonnes

- Colonnes simples (passé/futur) : `min-w-[90px]`
- Colonne double (actuel) : `min-w-[160px]`

---

## Fonctions à Modifier

| Fonction | Modification |
|----------|-------------|
| `renderCell` | Afficher 1 ou 2 sous-cellules selon la période |
| `renderGroupRow` | Idem |
| `renderTotalRow` | Idem |
| `renderVatRow` | Idem |
| `renderTtcRow` | Idem |
| `renderUncategorizedRow` | Idem |
| `renderVatToPayRow` | Idem |
| `renderPayablesRow` | Idem |
| `renderNetRow` | Idem |
| En-têtes `<thead>` | Sous-colonnes conditionnelles |

---

## Avantages UX

1. **Clarté** : Pas de colonnes "Prévu" vides sur les mois passés (inutiles)
2. **Focus** : L'attention est portée sur les données pertinentes
3. **Compacité** : Le tableau est moins large, plus lisible
4. **Logique métier** : Correspond au raisonnement comptable (le prévu passé n'a plus de sens)

---

## Fichiers à Modifier

| Fichier | Action |
|---------|--------|
| `src/components/forecasts/ForecastTable.tsx` | Refonte complète des rendus de cellules et en-têtes |
| `src/components/forecasts/ForecastChart.tsx` | Adapter si nécessaire (déjà gère isPast) |

---

## Points d'Attention

- **Cellules éditables** : Seules les colonnes "Prévu" du mois en cours et futur restent éditables
- **Clic sur Réel** : Toujours possible pour ouvrir le détail des transactions (mois passés et actuel)
- **Mois en cours** : La comparaison Réel vs Prévu reste visible pour le suivi

---

## Résultat Attendu

Un tableau plus épuré où :
- Les mois passés montrent uniquement ce qui s'est passé (Réel)
- Le mois en cours permet de comparer Réel vs Prévu
- Les mois futurs ne montrent que les projections (Prévu éditable)
