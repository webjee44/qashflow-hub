

# Refonte complète de la gestion des groupes

## Problème actuel

L'implémentation actuelle des groupes pose plusieurs problèmes d'UX critiques :

1. **Invisibilité** : Les groupes existants sont noyés dans la liste des catégories
2. **Actions cachées** : Impossible de savoir comment éditer ou supprimer un groupe
3. **Pas d'édition en masse** : Pour associer plusieurs catégories à un groupe, il faut les éditer une par une
4. **Distinction visuelle faible** : Les groupes ne ressortent pas assez visuellement

---

## Solution proposée : Interface à 2 niveaux

### 1. Section dédiée "Gestion des groupes"

Ajouter une section distincte au-dessus des tableaux de catégories :

```text
┌────────────────────────────────────────────────────────────────┐
│ 📁 Groupes                                              [+ Créer] │
├────────────────────────────────────────────────────────────────┤
│  🟡 Fournisseurs (3)                                    ✎  🗑  │
│  🔴 RH / Rémunération (4)                               ✎  🗑  │
│  🟢 Frais Généraux (5)                                  ✎  🗑  │
│  🔵 Transport (2)                                       ✎  🗑  │
└────────────────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- Liste claire de tous les groupes existants (revenus + dépenses)
- Badge de couleur + compteur d'enfants
- Boutons d'action toujours visibles (pas au survol)
- Clic sur un groupe = ouvre l'éditeur

### 2. Mode d'édition en masse (bulk edit)

Ajouter un bouton "Organiser" qui active le mode sélection :

```text
┌─────────────────────────────────────────────────────────────────┐
│ Dépenses                                        [✓ Organiser]   │
├─────────────────────────────────────────────────────────────────┤
│ [✓] Toutatis                              20%                    │
│ [✓] Flavor District                       20%                    │
│ [ ] Logiciels                             20%                    │
│ [✓] Marketing                             20%                    │
│ [ ] Loyer                                 20%                    │
└─────────────────────────────────────────────────────────────────┘
     [ 3 sélectionnées ] → [Assigner au groupe ▼] [Retirer du groupe]
```

**Fonctionnalités** :
- Checkboxes pour sélection multiple
- Barre d'actions contextuelle en bas
- Dropdown pour choisir le groupe cible
- Option "Retirer du groupe" pour les catégories déjà groupées

### 3. Distinction visuelle renforcée dans les tableaux

Dans `/reglages-tresorerie` et `/previsions`, les groupes seront clairement distingués :

```text
┌──────────────────────────────────────────────────────────────────┐
│ Dépenses                                                    (12) │
├──────────────────────────────────────────────────────────────────┤
│ ▼ FOURNISSEURS                                              (3)  │  ← Groupe : majuscules, gras, fond distinct
│       Toutatis                             20%              ✎ 🗑 │  ← Catégorie : indentation + style normal
│       Flavor District                      20%              ✎ 🗑 │
│       Autres fournisseurs                  20%              ✎ 🗑 │
├──────────────────────────────────────────────────────────────────┤
│ ▶ RH / RÉMUNÉRATION                                         (4)  │  ← Groupe replié
├──────────────────────────────────────────────────────────────────┤
│   Loyer                                    20%              ✎ 🗑 │  ← Catégorie sans groupe
│   Marketing                                20%              ✎ 🗑 │
└──────────────────────────────────────────────────────────────────┘
```

**Différences visuelles Groupe vs Catégorie** :

| Élément | Groupe | Catégorie |
|---------|--------|-----------|
| Texte | **MAJUSCULES + Gras** | Normal |
| Fond | `bg-muted/50` distinct | Transparent |
| Indentation | Aucune (aligné à gauche) | `pl-8` (24px) |
| Icône | Chevron ▼/▶ | Pastille couleur |
| Séparateur | Bordure au-dessus | Aucune |

---

## Fichiers à créer/modifier

```text
src/components/categories/GroupsManager.tsx     # NOUVEAU - Section de gestion des groupes
src/components/categories/CategoryTable.tsx     # Refonte avec checkboxes + bulk actions
src/components/categories/BulkAssignDialog.tsx  # NOUVEAU - Dialog d'assignation en masse
src/pages/Categories.tsx                        # Intégration du GroupsManager
src/components/forecasts/ForecastTable.tsx      # Amélioration visuelle des groupes
```

---

## Détails techniques

### Nouveau composant GroupsManager

```typescript
// Affiche une carte avec tous les groupes existants
// Permet création, édition, suppression directe
export function GroupsManager({
  groups,           // CategoryGroup[]
  onCreateGroup,    // () => void
  onEditGroup,      // (group) => void  
  onDeleteGroup,    // (id, deleteChildren) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Groupes</CardTitle>
        <Button onClick={onCreateGroup}>Créer un groupe</Button>
      </CardHeader>
      <CardContent>
        {/* Liste des groupes avec actions visibles */}
      </CardContent>
    </Card>
  );
}
```

### Mode sélection dans CategoryTable

```typescript
const [selectionMode, setSelectionMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// Barre d'actions bulk
{selectionMode && selectedIds.size > 0 && (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 
                  bg-card shadow-lg rounded-lg p-3 flex items-center gap-3">
    <span>{selectedIds.size} sélectionnée(s)</span>
    <Select>
      <SelectTrigger>Assigner au groupe</SelectTrigger>
      {/* Options : groupes existants */}
    </Select>
    <Button variant="outline">Retirer du groupe</Button>
  </div>
)}
```

### Styles CSS distincts pour groupes

```typescript
// Ligne de groupe
<TableRow className="bg-muted/50 border-t-2 border-border font-semibold">
  <TableCell className="uppercase tracking-wide text-sm">
    {group.name}
  </TableCell>
</TableRow>

// Ligne de catégorie enfant
<TableRow className="pl-8">
  <TableCell className="font-normal text-foreground">
    {category.name}
  </TableCell>
</TableRow>
```

---

## Bénéfices attendus

| Avant | Après |
|-------|-------|
| Groupes invisibles | Section dédiée avec liste claire |
| Actions cachées au survol | Boutons toujours visibles |
| Édition catégorie par catégorie | Sélection multiple + assignation en masse |
| Distinction visuelle faible | Majuscules + gras + fond distinct |
| UX confuse | Interface claire type Zenfirst |

---

## Estimation

- **Fichiers à modifier** : 5
- **Complexité** : Moyenne-élevée
- **Points clés** :
  - Nouveau composant GroupsManager
  - État de sélection multiple dans CategoryTable
  - Barre d'actions bulk contextuelle
  - Refonte CSS des lignes de groupe

