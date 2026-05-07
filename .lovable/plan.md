## Cause racine

Le PDF n’invente pas ces erreurs : il expose un rapport de validation produit par le moteur BP (`validateBPModel`). Le problème est en amont : certains modules du moteur ne partagent pas encore exactement les mêmes flux comptables.

Concrètement, les écarts viennent surtout de trois points structurels :

1. **Bilan non équilibré** : le bilan prend la trésorerie depuis le cash-flow, mais le passif n’est pas ajusté pour absorber l’écart via une ligne comptable cohérente. Résultat : `actif ≠ passif`.
2. **Apports mal alignés** : le plan de financement traite actuellement la `trésorerie initiale` comme un apport en capital, alors que le cash-flow ne fait pas entrer cette trésorerie comme flux de l’année. Cela crée un décalage entre cash-flow, bilan et plan de financement.
3. **Contrôles trop exposés au client final** : l’export PDF affiche les anomalies techniques au lieu de garantir un document bancaire propre ou de bloquer l’export si le moteur détecte une vraie incohérence métier.

## Objectif produit

Faire en sorte qu’un utilisateur Qashflow puisse exporter un BP propre, prêt à envoyer à une banque, sans messages techniques rouges ni rapport d’anomalies visibles dans le document final.

## Plan d’implémentation

### 1. Corriger le moteur de bilan à la source

- Garder la trésorerie du bilan comme **source unique depuis le cash-flow**.
- Ajouter une ligne comptable propre d’équilibrage côté passif, par exemple **report à nouveau / ajustement d’ouverture**, pour que le bilan reste équilibré sans masquer la trésorerie réelle.
- Ne pas faire de patch local dans le PDF : la correction doit vivre dans `computeBalanceSheet`, car c’est là que se construit l’état financier.

### 2. Corriger le plan de financement

- Ne plus assimiler automatiquement `initial_cash` à un apport en capital annuel.
- Calculer la variation de trésorerie du plan de financement à partir de la même vérité que le cash-flow / bilan.
- Aligner `fundingPlan.balance` avec la variation réelle de cash d’une année à l’autre.

### 3. Revoir la validation BP

- Transformer les contrôles de réconciliation en garde-fous internes plutôt qu’en contenu client.
- Conserver les invariants importants côté tests et moteur.
- Ne plus générer de bannière rouge “écarts détectés” sur la couverture d’un export destiné à la banque.

### 4. Nettoyer l’export PDF

- Retirer l’annexe de réconciliation des sections exportées par défaut.
- Retirer les alertes techniques de la page de couverture.
- Si une incohérence bloquante persiste après correction moteur, empêcher l’export avec un message simple côté interface, plutôt que produire un PDF dégradé.

### 5. Ajouter/mettre à jour les tests

- Remplacer les tests `todo` actuels par de vrais tests stricts :
  - bilan équilibré chaque année ;
  - trésorerie bilan = trésorerie cash-flow ;
  - plan de financement aligné avec la variation de trésorerie ;
  - validation sans erreur bloquante sur le fixture minimal.
- Mettre à jour le snapshot golden uniquement parce que les chiffres corrigés changent intentionnellement.

## Impact attendu

- Le BP exporté ne montrera plus d’erreurs techniques au client ou à la banque.
- Les états financiers seront plus cohérents entre compte de résultat, bilan, trésorerie et financement.
- Le problème sera corrigé au niveau du moteur, pas masqué dans le PDF.
- Les tests empêcheront une régression future sur ce sujet.