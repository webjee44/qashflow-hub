
# Plan : Réorganisation par Drag & Drop

## Objectif
Ajouter la possibilité de réorganiser l'ordre des catégories et des groupes via drag & drop, en plus de la fonctionnalité existante de déplacement vers un groupe.

---

## Résumé des changements

1. **Ajouter une colonne `sort_order`** à la table `categories` pour persister l'ordre
2. **Améliorer le drag & drop** pour détecter si on réordonne ou si on déplace vers un groupe
3. **Créer une fonction de réordonnancement** dans `useCategories`

---

## Étapes d'implémentation

### 1. Migration base de données
Ajouter la colonne `sort_order` (entier, nullable avec défaut 0) à la table `categories`.

### 2. Mise à jour du hook `useCategories.ts`
- Modifier la requête de fetch pour trier par `sort_order` puis par `name`
- Ajouter une mutation `reorderCategories` qui met à jour les `sort_order` en batch
- Modifier `getGroupedCategories` pour respecter le tri par `sort_order`

### 3. Mise à jour de `UnifiedCategoryList.tsx`
- Ajouter des états pour détecter la position de drop (avant/après un item)
- Afficher un indicateur visuel (ligne bleue) à l'endroit du drop
- Différencier les interactions :
  - Drop sur un **header de groupe** → déplacer dans le groupe
  - Drop **entre deux items** → réordonner à cette position
- Permettre également de réordonner les groupes eux-mêmes

### 4. Interface de props étendue
Ajouter `onReorder(itemId: string, targetId: string, position: 'before' | 'after')` aux props du composant.

---

## Détails techniques

### Structure du drag & drop amélioré

```text
┌─────────────────────────────────────────┐
│  [GROUPE A]  ← Drop ici = move to group │
├─────────────────────────────────────────┤
│  ── ligne bleue ──  ← Drop = insert     │
│  Catégorie 1                            │
│  ── ligne bleue ──  ← Drop = insert     │
│  Catégorie 2                            │
│  ── ligne bleue ──  ← Drop = insert     │
├─────────────────────────────────────────┤
│  [GROUPE B]                             │
└─────────────────────────────────────────┘
```

### Logique de détection de position
- Calculer la position verticale du curseur par rapport à chaque item
- Si dans la moitié supérieure → `position: 'before'`
- Si dans la moitié inférieure → `position: 'after'`

### Mise à jour du `sort_order`
Lors d'un réordonnancement :
1. Récupérer tous les items du même niveau (groupe ou non-groupé)
2. Retirer l'item déplacé
3. L'insérer à la nouvelle position
4. Recalculer les `sort_order` (0, 1, 2, 3...)
5. Mettre à jour en batch dans Supabase

---

## Fichiers impactés

| Fichier | Modification |
|---------|--------------|
| `supabase/migrations/` | Nouvelle migration pour `sort_order` |
| `src/hooks/useCategories.ts` | Ajout mutation `reorderCategories`, tri par `sort_order` |
| `src/components/categories/UnifiedCategoryList.tsx` | Logique D&D améliorée avec indicateurs visuels |
| `src/integrations/supabase/types.ts` | Auto-généré après migration |

---

## UX attendue

- **Grip visible** : L'icône de drag (⠿) apparaît au survol
- **Indicateur de position** : Ligne bleue entre les items pendant le drag
- **Feedback visuel** : L'item draggé devient semi-transparent
- **Persistance** : L'ordre est sauvegardé en base et restauré au rechargement
