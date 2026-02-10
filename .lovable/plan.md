
## Permettre l'edition manuelle sur les cellules "% du CA"

### Principe

Actuellement, les cellules en mode `percent_of_revenue` sont en lecture seule et calculees automatiquement. L'idee est de permettre a l'utilisateur de cliquer sur une cellule pour saisir un montant en dur, avec :

1. Une **sauvegarde manuelle** dans la table `category_forecasts` (qui existe deja)
2. Un **indicateur visuel** (icone crayon / badge) signalant que la cellule est en override manuel
3. La possibilite de **revenir au calcul auto** (supprimer l'override)

### Fonctionnement

```text
Cellule % du CA
   |
   +-- Pas d'override en base --> calcul auto (% x CA HT)
   |                               fond violet, tooltip explicatif
   |
   +-- Override present en base --> montant saisi en dur
                                    fond violet + icone crayon
                                    tooltip "Valeur manuelle - clic droit pour revenir en auto"
```

### Modifications techniques

**1. `src/hooks/useForecasts.ts` - getForecast()**

Dans la logique `percent_of_revenue`, verifier d'abord si un forecast manuel existe dans `category_forecasts` pour cette cellule. Si oui, retourner ce montant au lieu du calcul automatique.

Ajouter un helper `isManualOverride(categoryId, month)` qui retourne `true` si une entree existe en base pour une categorie en mode `percent_of_revenue`.

Ajouter une fonction `clearForecastOverride(categoryId, month)` pour supprimer l'entree manuelle et revenir au calcul auto.

**2. `src/components/forecasts/ForecastTable.tsx` - renderCell()**

Pour les cellules `isVariable` (bloc actuel lignes 391-443) :
- Rendre la cellule **cliquable** pour entrer en mode edition (reutiliser la meme logique que les cellules manuelles)
- Afficher un **petit icone crayon** quand la cellule a un override manuel
- Ajouter un **menu contextuel** (clic droit ou bouton) pour "Revenir au calcul automatique"
- Conserver le fond violet mais ajouter un indicateur subtil (bordure ou icone) pour distinguer auto vs manuel
- Afficher un **toast d'avertissement** au premier clic : "Le calcul automatique sera desactive pour cette cellule"

**3. Base de donnees**

Aucune migration necessaire. La table `category_forecasts` gere deja les montants par categorie/mois. La presence d'une ligne pour une categorie `percent_of_revenue` signifie "override manuel".

### Details UX

- **Cellule auto** : fond violet, tooltip avec la formule (% x CA), cliquable pour editer
- **Cellule overridee** : fond violet + petit icone Edit3, tooltip "Valeur manuelle", menu contextuel pour reset
- **Premier clic d'edition** : popover de confirmation "Le calcul auto sera desactive pour cette cellule. Continuer ?"
- **Reset** : via menu contextuel (DropdownMenu) sur la cellule, option "Revenir au calcul auto" qui supprime la ligne en base

### Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useForecasts.ts` | Priorite au forecast manuel, helpers `isManualOverride` et `clearForecastOverride` |
| `src/components/forecasts/ForecastTable.tsx` | Cellules variables editables, indicateur visuel, menu contextuel reset |
