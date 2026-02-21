
# Catégorie "Virement intercompte" -- neutralisation en trésorerie

## Contexte

Quand un virement est fait du compte A vers le compte B (même entreprise), deux transactions apparaissent : une sortie (-5000) et une entrée (+5000). En net, l'impact trésorerie est nul. Aujourd'hui, ces mouvements polluent les encaissements/décaissements et faussent les totaux.

## Solution proposée

Créer une catégorie système **"Virement intercompte"** qui :
1. Est créée automatiquement par société (non supprimable)
2. Les transactions catégorisées avec cette catégorie sont **exclues** des totaux encaissements/décaissements et du graphique prévisionnel

---

## Etapes techniques

### 1. Ajouter une colonne `is_system` sur la table `categories`

Migration SQL :
- `ALTER TABLE categories ADD COLUMN is_system boolean NOT NULL DEFAULT false;`
- Cette colonne empêchera la suppression côté frontend

### 2. Créer automatiquement la catégorie au chargement

Dans `useCategories.ts` :
- Lors de `initializeDefaultCategories`, ajouter la catégorie "Virement intercompte" avec `is_system: true`, type `expense`, icone `ArrowLeftRight`, couleur gris neutre
- Ajouter une fonction `ensureSystemCategories()` appelée au chargement qui vérifie si la catégorie système existe et la crée si absente (même si les catégories par défaut ont déjà été initialisées)

### 3. Empêcher la suppression côté UI

- `CategoryCard.tsx` : masquer le bouton supprimer si `category.is_system === true`
- `UnifiedCategoryList.tsx` : idem dans les menus contextuels
- `CategoryDialog.tsx` : rendre le nom en lecture seule pour les catégories système
- `useCategories.ts` : ajouter un guard dans `deleteCategory` qui refuse la suppression si `is_system`

### 4. Exclure du tableau de prévisions

Dans `ForecastTable.tsx` :
- Filtrer les transactions catégorisées "Virement intercompte" des calculs de totaux encaissements et décaissements
- Ne pas afficher de ligne pour cette catégorie dans le tableau (ou l'afficher en grisé avec un total toujours nul)

### 5. Exclure du graphique

Dans `ForecastChart.tsx` :
- Exclure les montants "Virement intercompte" des barres income/expense et du calcul de solde net

### 6. Mettre à jour le type TypeScript

- Ajouter `is_system?: boolean` dans l'interface `Category`
- Mettre à jour le schema Zod `categorySchema` dans `src/lib/schemas.ts`
- Mettre à jour `CategoryInsert` dans `categoryApi.ts`

### 7. Exclure du dashboard

Dans les hooks/composants du dashboard (`useDashboardStats.ts`, `CategoryBreakdown.tsx`), exclure aussi les transactions "Virement intercompte" des statistiques pour ne pas gonfler artificiellement les entrées/sorties.

---

## Résumé des fichiers modifiés

| Fichier | Modification |
|---|---|
| Migration SQL | Ajout colonne `is_system` |
| `src/features/categories/hooks/useCategories.ts` | Création auto + guard suppression |
| `src/features/categories/api/categoryApi.ts` | Ajout `is_system` dans l'insert |
| `src/lib/schemas.ts` | Ajout `is_system` au schema Zod |
| `src/components/categories/CategoryCard.tsx` | Masquer bouton supprimer si système |
| `src/components/categories/UnifiedCategoryList.tsx` | Masquer suppression si système |
| `src/components/forecasts/ForecastTable.tsx` | Exclure des totaux |
| `src/components/forecasts/ForecastChart.tsx` | Exclure des barres |
| `src/hooks/useDashboardStats.ts` | Exclure des stats |
