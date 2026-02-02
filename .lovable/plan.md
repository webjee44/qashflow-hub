

# Plan : Refonte de la vue Groupes dans /reglages-tresorerie

## Objectif

Remplacer la vue actuelle des groupes (grille de cartes compactes) par une vue en liste hiérarchique similaire à `/previsions`, avec un CTA "Ajouter un groupe" en tête et la possibilité de glisser-déposer les catégories dans les groupes.

---

## Problème Actuel

L'interface actuelle présente :
1. Un composant `GroupsManager` séparé affichant les groupes en grille de cartes
2. Deux tables `CategoryTable` distinctes (Revenus / Dépenses) plus bas
3. Pas de cohérence visuelle avec `/previsions` où les groupes et catégories sont dans une seule colonne hiérarchique

---

## Solution Proposée

### Vue Unifiée

Fusionner l'affichage des groupes et catégories en une seule liste hiérarchique par type :

```text
📈 REVENUS
┌──────────────────────────────────────────────────┐
│ [+ Ajouter un groupe]                            │
├──────────────────────────────────────────────────┤
│ ▼ VENTES DE SERVICES          [edit] [delete]   │
│     · Consulting                                 │
│     · Formation                                  │
│     · Support technique                          │
├──────────────────────────────────────────────────┤
│ ▼ PRODUITS                    [edit] [delete]   │
│     · Licences                                   │
│     · Abonnements                                │
├──────────────────────────────────────────────────┤
│ (catégories non groupées)                        │
│     · Autres revenus                             │
└──────────────────────────────────────────────────┘

📉 DÉPENSES
┌──────────────────────────────────────────────────┐
│ [+ Ajouter un groupe]                            │
│ ...                                              │
└──────────────────────────────────────────────────┘
```

### Création de Groupe Simplifiée

Nouveau flux de création en 2 étapes :
1. **Clic sur "Ajouter un groupe"** → le type (revenu/dépense) est déjà connu (selon la section)
2. **Dialog simplifié** → nom + couleur uniquement, pas de sélection de catégories initiale

### Glisser-Déposer (Drag & Drop)

- Chaque catégorie peut être glissée vers un groupe du même type
- Indicateur visuel lors du survol d'un groupe cible
- Retirer d'un groupe = glisser vers la zone "non groupées"

---

## Modifications Techniques

### 1. Nouveau Composant `UnifiedCategoryList`

Remplace `GroupsManager` + `CategoryTable` par un composant unique qui :
- Affiche un CTA "Ajouter un groupe" en tête de chaque section
- Liste les groupes avec leurs catégories enfants indentées
- Supporte le drag & drop pour réorganiser

```typescript
interface UnifiedCategoryListProps {
  type: 'income' | 'expense';
  groups: CategoryGroup[];
  onCreateGroup: (type: 'income' | 'expense') => void;
  onEditGroup: (group: Category) => void;
  onDeleteGroup: (groupId: string, deleteChildren: boolean) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (id: string, reassignToId: string | null) => void;
  onMoveToGroup: (categoryId: string, groupId: string | null) => void;
}
```

### 2. Modification du `GroupDialog`

Simplifier pour la création :
- Supprimer le sélecteur de catégories en mode création
- Garder le sélecteur uniquement en mode édition
- Accepter un `defaultType` et le verrouiller (pas de switch revenu/dépense)

### 3. Implémentation du Drag & Drop

Utiliser l'API native HTML5 Drag & Drop :
- `draggable="true"` sur les lignes catégories
- `onDragStart`, `onDragOver`, `onDrop` sur les zones cibles
- État local pour le feedback visuel (highlight du groupe cible)

### 4. Page `TreasurySettings`

- Supprimer le composant `GroupsManager` actuel
- Remplacer les deux `CategoryTable` par deux `UnifiedCategoryList`
- Adapter les handlers pour passer le type lors de la création de groupe

---

## Style Visuel (cohérence avec /previsions)

| Element | Style |
|---------|-------|
| En-tête groupe | `bg-muted/50`, texte MAJUSCULES GRAS, icône chevron |
| Catégorie enfant | Indentée (`pl-8`), pastille couleur, nom |
| Catégorie hover | `bg-muted/30`, actions apparaissent |
| Drop zone active | `ring-2 ring-primary bg-primary/5` |
| CTA Ajouter groupe | Bouton outline en tête de liste |

---

## Fichiers à Modifier / Créer

| Fichier | Action |
|---------|--------|
| `src/components/categories/UnifiedCategoryList.tsx` | **Créer** - Nouveau composant fusionné |
| `src/components/categories/GroupDialog.tsx` | Simplifier le mode création (pas de sélection catégories) |
| `src/pages/TreasurySettings.tsx` | Remplacer GroupsManager + CategoryTables par UnifiedCategoryList |
| `src/components/categories/GroupsManager.tsx` | **Supprimer** (plus utilisé) |

---

## Interactions Utilisateur

### Créer un groupe
1. Cliquer sur "+ Ajouter un groupe" dans la section Revenus/Dépenses
2. Renseigner le nom et choisir une couleur
3. Le groupe apparaît vide dans la liste
4. Glisser les catégories vers ce groupe

### Modifier un groupe
- Cliquer sur le nom du groupe ou l'icône edit
- Dialog avec nom, couleur, et liste des catégories actuelles

### Déplacer une catégorie
- Glisser-déposer vers le groupe cible
- Ou utiliser le mode sélection existant pour le bulk assign

---

## Avantages

1. **Cohérence** : Même structure visuelle que `/previsions`
2. **Simplicité** : Une seule liste au lieu de deux composants séparés
3. **Intuitivité** : Drag & drop naturel pour organiser
4. **Efficacité** : Moins de clics pour créer un groupe et y ajouter des catégories

