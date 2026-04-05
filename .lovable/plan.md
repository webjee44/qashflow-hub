
Objectif

Rétablir l’invariant métier du module prévisions :
`Solde de début de mois + Variation nette du mois = Solde de fin de mois`
pour la colonne Réel comme pour la colonne Prévu.

Cause racine

Le problème n’est plus la ligne “Variation nette du mois”.
Elle est désormais calculée correctement.

Le vrai bug est plus profond :
- `ForecastTable` affiche les totaux via `forecastDisplayTotals.ts`
- mais `useForecasts.getOpeningBalance()` / `getClosingBalance()` continuent d’utiliser une autre logique historique (`getMonthNetForecast`)
- cette logique historique réinjecte les factures fournisseurs / payables et applique une logique TTC différente
- `ForecastChart` ajoute aussi les payables dans les barres futures

Résultat : l’UI affiche une variation nette prévisionnelle de `30 072 €`, mais le moteur de solde utilise un autre delta mensuel, donc il calcule un solde de fin incohérent (`-23 388 €`).

Approche retenue

Ne surtout pas patcher uniquement la ligne “Solde de fin de mois”.
Ce serait une rustine locale.

La correction propre consiste à remettre une seule source de vérité au niveau du moteur de prévisions, puis à faire consommer cette même logique par :
- le tableau
- le calcul des soldes
- le graphe
- l’export Excel

Plan d’implémentation

1. Centraliser les totaux affichés dans le hook métier
- déplacer la logique “displayed totals” au niveau de `useForecasts`
- exposer des helpers du style :
  - `getDisplayedSectionTotalsForMonth(type, month)`
  - `getDisplayedNetTotalsForMonth(month)`
- réutiliser `forecastDisplayTotals.ts` au lieu de recalculer localement dans `ForecastTable`

2. Réécrire le moteur de solde prévisionnel sur cette source de vérité
- remplacer l’usage de `getMonthNetForecast()` dans `getOpeningBalance()` et `getClosingBalance()`
- calculer les ouvertures futures par chaînage :
  `opening(m+1) = opening(m) + displayedNetForecast(m)`
- calculer la clôture prévisionnelle du mois courant avec ce même delta affiché
- conserver le chemin “réel”, qui est déjà cohérent dans ton screenshot

3. Aligner tous les consommateurs visuels
- `ForecastTable` : utiliser les helpers du hook pour les headers, la variation nette et le solde de fin
- export Excel : utiliser exactement les mêmes helpers
- `ForecastChart` / `BalanceChart` : supprimer la logique parallèle qui réajoute les payables dans les flux principaux

4. Garder les payables, mais à la bonne place
- conserver l’affichage informatif des factures fournisseurs dans les cellules / indicateurs dédiés
- ne plus les laisser modifier en douce le calcul principal du solde affiché
- si on veut garder une vision “liquidité prudente” plus tard, elle devra être une métrique séparée et explicitement nommée, pas le `Solde de fin de mois` principal

Détails techniques

Fichiers concernés :
- `src/hooks/useForecasts.ts`
- `src/components/forecasts/ForecastTable.tsx`
- `src/components/forecasts/ForecastChart.tsx`
- `src/components/dashboard/BalanceChart.tsx`
- `src/lib/forecastDisplayTotals.ts` (ou utilitaire voisin si on factorise davantage)

Tests à ajouter / renforcer :
- cas de régression exact Cloud Vapor :
  `14 332 + 30 072 = 44 404`
- continuité inter-mois :
  `closing(M) = opening(M+1)`
- parité tableau / graphe / export
- non-régression sur le calcul Réel

Impact attendu

- les soldes prévisionnels affichés vont changer, car ils cesseront d’utiliser l’ancienne logique “liquidity/payables”
- en échange, le produit redeviendra arithmétiquement cohérent et compréhensible
- aucun changement base de données
- correction purement applicative et structurelle

Pourquoi cette approche est meilleure qu’un patch rapide

Un patch dans la ligne de clôture masquerait seulement le symptôme.
Le graphe, les ouvertures futures et l’export resteraient faux.

Ici on corrige la cause racine :
il ne restera plus deux moteurs de calcul concurrents pour la même information métier.
