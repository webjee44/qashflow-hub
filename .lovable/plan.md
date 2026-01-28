

# Plan : Gestion complète des Ruptures Conventionnelles

## Objectif

Implémenter un système complet de gestion des départs (rupture conventionnelle, licenciement, démission, etc.) avec :
- Champs conditionnels dans le formulaire employé
- Calcul automatique des charges sur indemnités selon la réglementation française 2026
- Intégration complète dans le Compte de Résultat (P&L) et la Trésorerie

---

## 1. Règles fiscales et sociales françaises 2026

### Indemnités de rupture conventionnelle

| Élément | Règle |
|---------|-------|
| **Exonération cotisations sociales** | Jusqu'à 2× PASS (≈96 120€ en 2026) |
| **Exonération impôt sur le revenu** | Jusqu'à 6× PASS (≈288 360€) |
| **Forfait social employeur** | **20%** sur la part exonérée de cotisations (depuis 2013) |
| **CSG/CRDS salarié** | Sur la partie excédant l'indemnité légale |

### Contribution patronale spécifique

Pour simplifier tout en restant précis, le système appliquera :
- **Forfait social 20%** sur le montant brut de l'indemnité (hypothèse : indemnité < 2 PASS)
- L'utilisateur saisit le **montant brut négocié** avec le salarié
- Le système calcule automatiquement le **coût employeur total** = Brut + 20%

### Types de départ supportés

| Type | Indemnité ? | Charges employeur |
|------|-------------|-------------------|
| Démission | Non | 0 |
| Fin de CDD | Oui (10% précarité) | Incluse dans salaire |
| Rupture conventionnelle | Oui | Forfait social 20% |
| Licenciement économique | Oui | Forfait social 20% |
| Licenciement personnel | Oui | Forfait social 20% |
| Départ retraite | Oui | Charges classiques |

---

## 2. Modifications de la base de données

Ajout de 2 colonnes à `bp_personnel` :

```sql
ALTER TABLE bp_personnel
ADD COLUMN departure_type TEXT DEFAULT NULL
  CHECK (departure_type IN (
    'resignation',           -- Démission
    'end_of_contract',       -- Fin CDD
    'conventional_termination', -- Rupture conventionnelle
    'economic_dismissal',    -- Licenciement économique
    'personal_dismissal',    -- Licenciement pour motif personnel
    'retirement',            -- Départ retraite
    NULL                     -- Pas de départ prévu
  )),
ADD COLUMN severance_amount NUMERIC DEFAULT NULL;
```

---

## 3. Mise à jour des constantes (`bpConstants.ts`)

Ajouter les types de départ avec leurs règles de calcul :

```typescript
export const DEPARTURE_TYPES = {
  resignation: { 
    label: 'Démission', 
    hasSeverance: false,
    employerContributionRate: 0,
  },
  end_of_contract: { 
    label: 'Fin de CDD', 
    hasSeverance: false, // Précarité incluse dans salaire
    employerContributionRate: 0,
  },
  conventional_termination: { 
    label: 'Rupture conventionnelle', 
    hasSeverance: true,
    employerContributionRate: 0.20, // Forfait social 20%
  },
  economic_dismissal: { 
    label: 'Licenciement économique', 
    hasSeverance: true,
    employerContributionRate: 0.20,
  },
  personal_dismissal: { 
    label: 'Licenciement personnel', 
    hasSeverance: true,
    employerContributionRate: 0.20,
  },
  retirement: { 
    label: 'Départ retraite', 
    hasSeverance: true,
    employerContributionRate: 0.45, // Charges classiques
  },
} as const;
```

---

## 4. Mise à jour du Dialog Employé (`EmployeeDialog.tsx`)

### Nouveau comportement UX

Quand une **date de fin** est saisie, une nouvelle section "Départ" apparaît :

```text
┌─────────────────────────────────────────────────────────────────┐
│ 📅 Date de fin                                                   │
│ ┌────────────────────┐                                          │
│ │ 2026-06-30         │ ← Déjà existant                          │
│ └────────────────────┘                                          │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 🚪 Conditions de départ                                    │   │
│ │ ────────────────────────────────────────────────────────  │   │
│ │                                                           │   │
│ │ Type de départ                                            │   │
│ │ ┌────────────────────────────┐                            │   │
│ │ │ Rupture conventionnelle ▼  │                            │   │
│ │ └────────────────────────────┘                            │   │
│ │                                                           │   │
│ │ Indemnité brute négociée (€)     [Si type avec indemnité] │   │
│ │ ┌────────────────────┐                                    │   │
│ │ │ 8 500              │                                    │   │
│ │ └────────────────────┘                                    │   │
│ │                                                           │   │
│ │ ┌─────────────────────────────────────────────────────┐   │   │
│ │ │ 💰 Coût employeur estimé                            │   │   │
│ │ │ ─────────────────────────────────────────────────── │   │   │
│ │ │ Indemnité brute           8 500 €                   │   │   │
│ │ │ Forfait social (20%)    + 1 700 €                   │   │   │
│ │ │ ─────────────────────────────────────────────       │   │   │
│ │ │ Coût total employeur     10 200 €                   │   │   │
│ │ │                                                     │   │   │
│ │ │ ℹ️ Versé en juin 2026                               │   │   │
│ │ └─────────────────────────────────────────────────────┘   │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### État du formulaire

Ajouter dans le state :
```typescript
const [departureType, setDepartureType] = useState<string | null>(null);
const [severanceAmount, setSeveranceAmount] = useState('');
```

Réinitialiser quand `endDate` devient vide.

---

## 5. Affichage dans le tableau Personnel (`PersonnelTable.tsx`)

Ajouter un badge et l'indemnité si départ prévu :

```text
┌────────────────────┬──────────┬─────────────┬────────────┬──────────────────┐
│ Nom / Poste        │ Contrat  │ Salaire     │ Début      │ Fin              │
├────────────────────┼──────────┼─────────────┼────────────┼──────────────────┤
│ Marie Martin       │ CDI      │ 2 800 €     │ Mar 2025   │ Juin 2026        │
│ Assistante         │          │             │            │ 🏷️ Rupt. conv.   │
│                    │          │             │            │ 8 500 € brut     │
└────────────────────┴──────────┴─────────────┴────────────┴──────────────────┘
```

---

## 6. Intégration dans le P&L (`useProfitLoss.ts`)

### Nouvelle fonction de calcul

```typescript
// Calcul des indemnités de départ pour un mois donné
const getSeverancePaymentsForMonth = (month: Date) => {
  const monthStart = startOfMonth(month);
  
  return personnel.reduce((sum, person) => {
    // Vérifier si c'est le mois de départ
    if (!person.end_date || !person.severance_amount) return sum;
    
    const endDate = parseISO(person.end_date);
    if (startOfMonth(endDate).getTime() !== monthStart.getTime()) return sum;
    
    // Calculer le coût employeur
    const departureConfig = DEPARTURE_TYPES[person.departure_type];
    const employerRate = departureConfig?.employerContributionRate ?? 0.20;
    const severance = Number(person.severance_amount) || 0;
    const employerCost = severance * (1 + employerRate);
    
    return sum + employerCost;
  }, 0);
};
```

### Position dans le P&L

Les indemnités seront affichées dans la section **Charges de personnel** :

```text
Charges de personnel
├── Salaires bruts                    120 000 €
├── Charges sociales patronales        54 000 €
├── Indemnités de départ               10 200 €  ← NOUVEAU
└── Total personnel salarié           184 200 €
```

### Mise à jour des totaux

- Ajouter `severancePayments: number[]` dans `PLData.totals`
- Inclure dans le calcul de `personnelValues` ou créer une ligne séparée
- Impacter l'EBE et le résultat net

---

## 7. Intégration dans la Trésorerie (`useBPCashFlow.ts`)

Les indemnités représentent un décaissement réel :

```typescript
// Dans le calcul des outflows
const severanceOutflow = getSeverancePaymentsForMonth(month);
outflows[i] += severanceOutflow;
```

---

## 8. Mise à jour du service (`personnelService.ts`)

Ajouter les champs dans l'interface et les méthodes CRUD :

```typescript
export interface BPPersonnel {
  // ... champs existants
  departure_type: string | null;
  severance_amount: number | null;
}
```

---

## 9. Fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `supabase/migrations/xxx.sql` | Ajout colonnes `departure_type` et `severance_amount` |
| `src/constants/bpConstants.ts` | Ajout `DEPARTURE_TYPES` avec taux |
| `src/lib/french-rates.ts` | Ajout constante `SEVERANCE_FORFAIT_SOCIAL = 0.20` |
| `src/services/personnelService.ts` | Mise à jour interface et helpers |
| `src/features/business-plan/dialogs/EmployeeDialog.tsx` | Section départ conditionnelle |
| `src/features/business-plan/components/PersonnelTable.tsx` | Badge départ + indemnité |
| `src/features/business-plan/hooks/useProfitLoss.ts` | Calcul indemnités dans P&L |
| `src/features/business-plan/hooks/useBPCashFlow.ts` | Décaissement indemnités |
| `src/integrations/supabase/types.ts` | Auto-généré après migration |

---

## 10. Résumé des avantages

- **Précision fiscale** : Forfait social 20% conforme à la réglementation 2026
- **UX intuitive** : Section départ uniquement visible si date de fin renseignée
- **Intégration complète** : P&L + Trésorerie mis à jour automatiquement
- **Flexibilité** : Supporte tous les types de départ courants
- **Visibilité** : Badge dans le tableau pour repérer les départs à venir

