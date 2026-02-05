
# Plan : Supprimer les spinners des champs numériques

## Problème

Les champs `input type="number"` affichent des petites flèches haut/bas (spinners) par défaut dans les navigateurs. Ces boutons ne sont pas utilisés et encombrent l'interface.

## Solution

Ajouter une règle CSS globale dans `src/index.css` pour masquer ces spinners sur tous les navigateurs (Chrome, Safari, Firefox, Edge).

## Modification

**Fichier** : `src/index.css`

Ajouter dans `@layer base` :

```css
/* Hide number input spinners */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}
```

## Effet

- Tous les champs numériques de l'application perdront leurs flèches
- Les utilisateurs pourront toujours saisir des valeurs au clavier
- Fonctionne sur Chrome, Safari, Firefox, Edge

## Avantage

Une seule modification CSS globale = changement appliqué partout instantanément.
