
# Amélioration de l'affichage hiérarchique des groupes

## Problème identifié
Les groupes de catégories existent dans la base de données (via `parent_id`) mais l'affichage actuel ne les met pas suffisamment en valeur :
- Dans `/reglages-tresorerie` : les catégories sont listées d'affilée, difficile de voir la hiérarchie
- Dans `/previsions` : idem, pas de vraie structure visuelle
- Contrairement à Zenfirst qui montre clairement les groupes pliables avec indentation

---

## Solution proposée

### 1. Améliorer le tableau des catégories (`/reglages-tresorerie`)

**Avant** : Liste plate avec indentation minimale
**Après** : Sections visuellement distinctes comme Zenfirst

Modifications :
- Groupe affiché comme une barre distincte (fond coloré, police plus grande)
- Bouton `+`/`-` explicite pour plier/déplier
- Catégories enfants clairement indentées sous leur groupe
- Ligne de connexion verticale entre groupe et enfants
- Par défaut : groupes repliés pour une vue épurée

### 2. Améliorer la table des prévisions (`/previsions`)

Même logique :
- Les groupes deviennent des lignes cliquables avec sous-total
- Quand le groupe est replié : on voit juste le total du groupe
- Quand déplié : les catégories enfants apparaissent indentées
- Par défaut : **replié** pour une vue claire

### 3. Option "Tout replier / Tout déplier"

Ajouter des boutons dans l'en-tête pour gérer tous les groupes d'un coup.

---

## Maquette visuelle (style Zenfirst)

```text
┌─────────────────────────────────────────────────────────────┐
│ Dépenses                                               (12) │
├─────────────────────────────────────────────────────────────┤
│ [−] Fournisseurs                                       (3)  │  ◄── Groupe (cliquable)
│      ├─ Toutatis                              20%     ✎ 🗑  │  ◄── Enfant indenté
│      ├─ Flavor District                       20%     ✎ 🗑  │
│      └─ Autres fournisseurs                   20%     ✎ 🗑  │
├─────────────────────────────────────────────────────────────┤
│ [+] RH / Rémunération                                  (4)  │  ◄── Groupe replié
├─────────────────────────────────────────────────────────────┤
│ [−] Frais Généraux                                     (5)  │
│      ├─ Transport sur ventes                  20%     ✎ 🗑  │
│      ├─ Logiciels                             20%     ✎ 🗑  │
│      └─ [−] Honoraires                         (3)          │  ◄── Sous-groupe
│           ├─ Avocat                           20%     ✎ 🗑  │
│           ├─ Comptables                       20%     ✎ 🗑  │
│           └─ Coachflix                        20%     ✎ 🗑  │
├─────────────────────────────────────────────────────────────┤
│    Loyer                                      20%     ✎ 🗑  │  ◄── Catégorie sans groupe
│    Marketing                                  20%     ✎ 🗑  │
└─────────────────────────────────────────────────────────────┘
```

---

## Fichiers à modifier

```text
src/components/categories/CategoryTable.tsx      # Refonte complète de l'affichage
src/components/forecasts/ForecastTable.tsx       # Mêmes améliorations
src/hooks/useCategories.ts                       # Aucun changement (logique OK)
```

---

## Section technique

### Modifications CategoryTable.tsx

1. **Ajouter état par défaut replié**
```typescript
// Initialiser tous les groupes comme repliés par défaut
const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
  const saved = localStorage.getItem(COLLAPSED_KEY);
  if (saved) return new Set(JSON.parse(saved));
  // Par défaut : tous les groupes repliés
  return new Set(groups.filter(g => g.group).map(g => g.group!.id));
});
```

2. **Améliorer le rendu visuel des groupes**
- Séparateur visuel (border-top) avant chaque groupe
- Fond distinct (bg-muted/50)
- Icône `ChevronRight`/`ChevronDown` plus visible
- Compteur de catégories enfants

3. **Indentation des enfants**
- `pl-8` au lieu de `pl-4`
- Ligne de connexion verticale continue (border-left)
- Dernier enfant avec `└─` au lieu de `├─`

### Modifications ForecastTable.tsx

1. **Groupes repliés par défaut**
```typescript
// Tous les groupes repliés au chargement
const defaultCollapsed = new Set(
  [...incomeGroups, ...expenseGroups]
    .filter(g => g.group)
    .map(g => g.group!.id)
);
```

2. **Ligne de groupe avec totaux agrégés**
- Quand replié : affiche la somme des enfants
- Cliquable pour déplier
- Style distinct (bg-muted, font-semibold)

3. **Boutons "Tout replier/déplier"**
```typescript
<Button variant="ghost" size="sm" onClick={collapseAll}>
  <ChevronsUpDown className="w-4 h-4" />
</Button>
```

---

## Bénéfices attendus

- Vue épurée par défaut (groupes repliés)
- Navigation intuitive (clic pour déplier)
- Hiérarchie claire (indentation + connecteurs)
- Cohérence avec Zenfirst (familiarité utilisateur)
- Persistance de l'état (localStorage)

---

## Estimation

- Fichiers à modifier : 2
- Complexité : Moyenne
- Points clés :
  - CSS d'indentation et connecteurs
  - État replié par défaut
  - Animation fluide au déploiement
