
# Plan : Masquer les catégories sans montant

## Résumé
Masquer automatiquement les catégories qui n'ont **aucun montant** (ni réel, ni prévu) sur la période affichée dans `/previsions`.

## Solution proposée (légère, sans régression)

### Approche : Filtrage au niveau du rendu
Ajouter un helper `hasAnyAmount` qui vérifie si une catégorie a au moins un montant sur les mois affichés, puis filtrer les catégories dans `renderGroupedSection`.

### Modification unique dans `ForecastTable.tsx`

```typescript
// Nouveau helper (à ajouter dans le composant)
const hasAnyAmount = useCallback((categoryId: string): boolean => {
  return months.some(month => {
    const forecast = getForecast(categoryId, month);
    const actual = Math.abs(getActual(categoryId, month));
    return forecast > 0 || actual > 0;
  });
}, [months, getForecast, getActual]);
```

### Modification de `renderGroupedSection`

```typescript
const renderGroupedSection = (groups: CategoryGroup[], type: 'income' | 'expense', startIndex: number) => {
  let currentIndex = startIndex;
  
  return groups.map((group) => {
    const groupId = group.group?.id || 'ungrouped';
    const isCollapsed = group.group ? collapsedGroups.has(groupId) : false;
    
    // ✅ Filtrer les catégories sans montants
    const visibleChildren = group.children.filter(cat => hasAnyAmount(cat.id));
    
    // ✅ Ne pas afficher le groupe si aucune catégorie visible
    if (visibleChildren.length === 0 && group.group) return null;
    
    const elements = [];
    
    if (group.group && visibleChildren.length > 0) {
      elements.push(renderGroupRow({ ...group, children: visibleChildren }, type));
    }
    
    if (!isCollapsed) {
      elements.push(
        <AnimatePresence key={`children-${groupId}`}>
          {visibleChildren.map((category) => {
            const row = renderCategoryRow(category, currentIndex, type, !!group.group);
            currentIndex++;
            return row;
          })}
        </AnimatePresence>
      );
    }
    
    return elements;
  });
};
```

## Avantages

| Aspect | Détail |
|--------|--------|
| **Performance** | Calcul léger (réutilise les données déjà en mémoire) |
| **Pas de régression** | Les catégories avec montants restent visibles |
| **Comportement intuitif** | Dès qu'un montant est saisi, la catégorie apparaît |
| **Code minimal** | ~15 lignes modifiées |

## Comportement attendu

- ✅ Catégorie avec prévision → Visible
- ✅ Catégorie avec transaction réelle → Visible
- ✅ Catégorie sans rien sur la période → Masquée
- ✅ Groupe entièrement vide → Masqué
- ✅ Si on étend la période et qu'une catégorie a des données → Réapparaît

## Fichier à modifier

| Fichier | Action |
|---------|--------|
| `src/components/forecasts/ForecastTable.tsx` | Ajouter helper + filtrer dans renderGroupedSection |
