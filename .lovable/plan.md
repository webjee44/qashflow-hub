

## Simplification "Point Zéro" — Forward-Only — ✅ TERMINÉ

### Ce qui a été fait

1. **`bridge-sync` — Snapshot initial "Point Zéro"** : Après chaque full-sync, si aucun snapshot n'existe pour la company, le système calcule `Live Balance - Σ transactions depuis le 1er du mois` et insère un snapshot unique au 1er du mois courant. Cela se fait une seule fois, au moment de la première connexion bancaire.

2. **`useForecasts.ts` — `getOpeningBalance` simplifié** :
   - **Passé/Courant** : Lecture directe du snapshot. Si absent → `{ noData: true }` (mois pré-inscription)
   - **Futur** : Snapshot courant + Σ net forecasts en marche avant
   - ❌ Supprimé : `getSnapshotForEndOfMonth`, fallback `liveBankBalance` dans le calcul d'ouverture, `initialBalance`

3. **`useForecasts.ts` — `getClosingBalance` simplifié** :
   - Utilise `getOpeningBalance(nextMonth)` comme fermeture
   - Propage `noData` pour les mois sans snapshot
   - Override manuel toujours supporté

4. **UI `ForecastTable.tsx`** : Les mois sans snapshot (pré-inscription) affichent `—` en gris italique au lieu de `0 €`.

### Architecture résultante

```
Point Zéro = Live Balance au moment de l'inscription - Σ transactions du mois
Passé       → Snapshot au 1er du mois (ou "—" si pré-inscription)
Courant     → Snapshot au 1er du mois
Futur       → Snapshot courant + Σ forecasts nets (walk forward)
```

Aucune reconstitution rétroactive. Aucun chargement massif de transactions. Aucun fallback complexe.
