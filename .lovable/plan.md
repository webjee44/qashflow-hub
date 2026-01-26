
## Menus Distincts par Application

### Objectif

Afficher uniquement le menu correspondant à l'application active :

```text
┌─────────────────────────────┐
│ Sur /bp/* (Business Plan)   │
├─────────────────────────────┤
│ BUSINESS PLAN               │
│ • Revenus                   │
│ • Charges                   │
│ • Équipe                    │
│ • Investissements           │
│ • Financements              │
│ • ...                       │
│                             │
│ [Paramètres du BP visible]  │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Sur /dashboard, etc.        │
├─────────────────────────────┤
│ TRÉSORERIE                  │
│ • Tableau de bord           │
│ • Prévisions                │
│ • Transactions              │
│ • Réglages                  │
│                             │
│ [Paramètres du BP masqué]   │
└─────────────────────────────┘
```

### Logique Actuelle vs Nouvelle

| Élément | Actuellement | Nouveau comportement |
|---------|--------------|---------------------|
| Menu BP | Toujours visible | Visible uniquement si `isBusinessPlan` (route `/bp/*`) |
| Menu Trésorerie | Visible si `!bpEnabled` | Visible uniquement si `isTreasury` ET `showTreasuryModule` |
| Paramètres BP | Toujours visible | Visible uniquement si `isBusinessPlan` |
| Visite guidée | Toujours visible | Visible uniquement si `isBusinessPlan` |

### Modification Technique

**Fichier** : `src/components/layout/Sidebar.tsx`

**Changements** :

1. Utiliser `isBusinessPlan` et `isTreasury` du hook `useAppMode()` pour conditionner l'affichage des sections

2. Modifier la section "Paramètres du BP" (lignes 220-241) :
   - Afficher uniquement si `isBusinessPlan` est `true`

3. Modifier la section navigation (lignes 244-336) :
   - Menu Trésorerie : afficher si `isTreasury && showTreasuryModule`
   - Menu BP : afficher si `isBusinessPlan`

4. Adapter l'icône du mode collapsed (lignes 201-218) :
   - Afficher l'icône correspondant au mode actuel

```tsx
// Pseudo-code de la nouvelle logique
const { isBusinessPlan, isTreasury } = useAppMode();

// Dans la navigation :
{/* Menu Trésorerie - Uniquement en mode Trésorerie */}
{isTreasury && showTreasuryModule && (
  <>
    <div>Trésorerie</div>
    {treasuryNavItems.map(...)}
  </>
)}

{/* Menu BP - Uniquement en mode Business Plan */}
{isBusinessPlan && (
  <>
    <div>Business Plan</div>
    {filteredBPNavItems.map(...)}
  </>
)}
```

### Résultat Attendu

- Navigation sur `/bp/revenus` → Seul le menu Business Plan est visible
- Navigation sur `/dashboard` → Seul le menu Trésorerie est visible (si activé)
- Transition fluide grâce à la synchronisation automatique du mode avec la route
- Les boutons "Paramètres du BP" et "Visite guidée" n'apparaissent qu'en mode BP
