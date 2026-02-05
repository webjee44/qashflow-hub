
# Correction du bug "Page blanche au 1er clic" dans le module Trésorerie

## Analyse du problème

Le problème vient d'un **conflit technique entre AnimatePresence et React Suspense** dans `AppLayout.tsx` :

```text
+-------------------+
|  AnimatePresence  |  <-- mode="wait" : attend la FIN de l'animation de sortie
|    mode="wait"    |      avant de monter le nouveau composant
+-------------------+
         |
         v
+-------------------+
|   motion.div      |  <-- key={pathname} : force un cycle mount/unmount
|  key=pathname     |      à chaque navigation
+-------------------+
         |
         v
+-------------------+
|    Suspense       |  <-- Le fallback ne s'affiche pas car AnimatePresence
|   fallback=...    |      "bloque" le cycle de rendu pendant l'exit
+-------------------+
         |
         v
+-------------------+
|     Outlet        |  <-- lazy() : suspend le rendu le temps du chargement
|    (lazy page)    |
+-------------------+
```

### Pourquoi la page blanche ?

1. L'utilisateur clique sur "Prévisions"
2. L'URL change, `AnimatePresence` avec `mode="wait"` attend que l'ancienne page termine son animation de **sortie** (300ms)
3. **Pendant ce temps**, la nouvelle page lazy-loaded déclenche un `Suspense` mais le `fallback` (PageLoader) n'apparaît pas car AnimatePresence n'a pas encore "libéré" le DOM
4. Résultat : l'écran reste vide jusqu'à ce que React retente le rendu (2e clic ou interaction)

## Solution technique

Supprimer `mode="wait"` d'AnimatePresence pour que les pages s'animent en parallèle. Cela permet à `Suspense` d'afficher immédiatement son `fallback` pendant que l'ancienne page sort.

| Avant | Après |
|-------|-------|
| `<AnimatePresence mode="wait">` | `<AnimatePresence>` |
| Animations séquentielles (bloquantes) | Animations parallèles (non-bloquantes) |
| Page blanche pendant la transition | Loader visible immédiatement |

### Optimisation additionnelle

Réduire la durée de transition de 300ms à 150ms pour une navigation plus réactive.

## Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `src/components/layout/AppLayout.tsx` | Retirer `mode="wait"` et réduire la durée de transition |

## Code avant/après

```typescript
// AVANT (problématique)
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
  >
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  </motion.div>
</AnimatePresence>

// APRÈS (corrigé)
<AnimatePresence>
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
  >
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  </motion.div>
</AnimatePresence>
```

## Risques et considérations

- **Changement visuel** : Les animations de pages seront légèrement différentes (superposition possible pendant la transition au lieu d'un enchaînement séquentiel)
- **Comportement identique** : La navigation et le lazy-loading fonctionneront exactement comme avant, mais sans blocage

## Alternative si le rendu superposé ne convient pas

Si l'effet visuel de superposition n'est pas souhaité, on peut garder `mode="wait"` mais déplacer le `Suspense` **au-dessus** d'`AnimatePresence` pour que le loader s'affiche avant même le début de l'animation. Cela nécessiterait une refonte plus importante de la structure.
