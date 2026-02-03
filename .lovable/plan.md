

# Plan: Vue Tableau pour /transactions avec Select de Catégorie

## Objectif

Transformer la liste des transactions actuelle (vue "cards") en une vraie vue tableau HTML avec :
- Colonnes : Checkbox | Date | Libellé | Catégorie (Select) | Montant TTC | Actions
- Un `<Select>` propre et net dans la colonne Catégorie (comme sur la capture)
- Couleur jaune sur fond si non catégorisé

---

## Approche technique

### 1. Créer un nouveau composant `TransactionTableRow.tsx`

Ce composant affichera une ligne de tableau avec :

```text
+------+------------+----------------------------------+------------------------------+---------------+------+
|  ☐   |   Date     |           Libellé                |         Catégorie            |  Montant TTC  |  ⋯  |
+------+------------+----------------------------------+------------------------------+---------------+------+
|  ☐   | 28 Jan 2026| VOTRE REMISE PRELEVMT...         | [Select: Ventes         ▾]  |  +21 308,91 € |  ⋯  |
+------+------------+----------------------------------+------------------------------+---------------+------+
```

**Caractéristiques du Select :**
- Fond jaune/ambre si "Sélectionnez une catégorie" (non catégorisé)
- Fond blanc/neutre quand catégorisé
- Groupes "Encaissements" et "Décaissements" dans les options
- Pastille de couleur pour chaque catégorie
- Option "Créer une catégorie" en haut

### 2. Modifier `TransactionsView.tsx`

Remplacer la liste virtualisée actuelle par un `<Table>` avec :

**Header :**
```tsx
<TableHeader>
  <TableRow>
    <TableHead className="w-10">
      <Checkbox /> {/* Select all */}
    </TableHead>
    <TableHead className="w-28">Date</TableHead>
    <TableHead>Libellé</TableHead>
    <TableHead className="w-56">Catégorie</TableHead>
    <TableHead className="w-32 text-right">Montant TTC</TableHead>
    <TableHead className="w-10"></TableHead>
  </TableRow>
</TableHeader>
```

**Body :** Utiliser les composants Table de shadcn avec virtualisation pour la performance.

### 3. Implémenter le Select de catégorie

Utiliser le composant `Select` de shadcn/ui :

```tsx
<Select 
  value={transaction.category_id || "uncategorized"}
  onValueChange={(value) => onUpdateCategory(transaction.id, value === "uncategorized" ? null : value)}
>
  <SelectTrigger 
    className={cn(
      "w-full",
      !transaction.category_id && "bg-amber-100 border-amber-300 text-amber-700"
    )}
  >
    <SelectValue placeholder="Sélectionnez une catégorie" />
  </SelectTrigger>
  <SelectContent className="max-h-80">
    <SelectItem value="create-new">
      <PlusCircle /> Créer une catégorie
    </SelectItem>
    <SelectSeparator />
    
    <SelectGroup>
      <SelectLabel>Encaissements</SelectLabel>
      {incomeCategories.map(cat => (
        <SelectItem key={cat.id} value={cat.id}>
          <span className="w-3 h-3 rounded-full" style={{backgroundColor: cat.color}} />
          {cat.name}
        </SelectItem>
      ))}
    </SelectGroup>
    
    <SelectGroup>
      <SelectLabel>Décaissements</SelectLabel>
      {expenseCategories.map(cat => (
        <SelectItem key={cat.id} value={cat.id}>
          <span className="w-3 h-3 rounded-full" style={{backgroundColor: cat.color}} />
          {cat.name}
        </SelectItem>
      ))}
    </SelectGroup>
  </SelectContent>
</Select>
```

### 4. Ajouter le menu d'actions (⋯)

Un `DropdownMenu` avec une icône `MoreHorizontal` pour :
- Retirer la catégorie
- Créer une règle d'automatisation
- Autres actions futures

---

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `src/components/transactions/TransactionTableRow.tsx` | **Créer** - Nouveau composant ligne tableau |
| `src/components/transactions/TransactionsView.tsx` | **Modifier** - Remplacer la liste par un Table |
| `src/components/transactions/TransactionRow.tsx` | Conserver (backup) ou supprimer après migration |

---

## Style du Select non catégorisé (comme la capture)

```css
/* Non catégorisé - fond ambre */
.category-select-uncategorized {
  background-color: hsl(48, 96%, 89%);  /* amber-100 */
  border-color: hsl(45, 93%, 47%);       /* amber-400 */
  color: hsl(32, 81%, 29%);              /* amber-800 */
}
```

---

## Résultat attendu

```text
┌──┬────────────┬──────────────────────────────────────────┬────────────────────────────┬─────────────┬───┐
│☐ │    Date    │                 Libellé                  │         Catégorie          │ Montant TTC │   │
├──┼────────────┼──────────────────────────────────────────┼────────────────────────────┼─────────────┼───┤
│☐ │ 28 Jan 2026│ VOTRE REMISE PRELEVMT DU 260126...       │ [🔵 Ventes            ▾]  │+21 308,91 € │ ⋯ │
│☐ │ 28 Jan 2026│ PRLV SEPA HUMANIS PREVOY 601815...       │ [⚠ Sélect. catégorie  ▾]  │  2 542,78 € │ ⋯ │
│☐ │ 26 Jan 2026│ PRLV SEPA We Doo Account INV/2025...     │ [⚠ Sélect. catégorie  ▾]  │    282,96 € │ ⋯ │
│☐ │ 26 Jan 2026│ PAIEMENT CB 2501 ST ETIENNE...           │ [🔴 Fournisseurs      ▾]  │     76,06 € │ ⋯ │
└──┴────────────┴──────────────────────────────────────────┴────────────────────────────┴─────────────┴───┘

⚠ = Fond jaune/ambre pour non catégorisé
```

- Les lignes non catégorisées ont un select avec fond ambre bien visible
- Le select inclut les pastilles de couleur des catégories
- Le menu ⋯ permet d'accéder aux actions secondaires
- Conservation de la virtualisation pour les performances (1900+ transactions)

