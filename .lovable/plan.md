## Problème

Dans la modale "Créer une automatisation ?", quand on modifie le pattern (ou le critère de montant), la liste "X transaction(s) similaire(s)" en dessous semble ne pas réagir.

## Cause racine

Dans `src/components/transactions/SuggestAutomationDialog.tsx`, la fonction `findSimilarTransactions` applique `.slice(0, 5)` **avant** de retourner le résultat. Le compteur affiché (`liveSimilarTransactions.length`) est donc plafonné à 5.

Conséquences :
- Tant que le pattern matche plus de 5 transactions, raffiner ne change ni le badge ni la liste → impression de gel.
- Le compteur n'a jamais reflété le nombre réel de transactions affectées par la règle, ce qui est trompeur juste avant la création de la règle.

C'est un mélange des responsabilités : la fonction de matching doit retourner la **vérité** (toutes les correspondances), pas une vue tronquée. Le tronçonnage est une préoccupation d'affichage.

## Correction (1 fichier)

`src/components/transactions/SuggestAutomationDialog.tsx`

1. Retirer `.slice(0, 5)` de `findSimilarTransactions` → la fonction retourne désormais toutes les correspondances.
2. Au rendu, afficher le **total réel** dans le badge (`liveSimilarTransactions.length`) et appliquer `.slice(0, 5)` uniquement sur le `.map(...)` de la preview.
3. Si le total dépasse 5, ajouter une mention discrète "+ N autres" sous la liste pour garder la transparence.

## Résultat

- Le compteur réagit en direct à chaque modification du pattern, montant ou compte bancaire.
- L'utilisateur voit le vrai nombre de transactions qui seront catégorisées par la règle avant de la créer.
- Aucune logique métier dupliquée, séparation propre entre matching (vérité) et affichage (preview limitée).
