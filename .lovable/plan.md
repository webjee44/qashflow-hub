Voici ce que j’ai vérifié dans la base et ce que je propose de corriger proprement.

## Constat vérifié

Sur le groupe **GROUPE TRADEFLIX**, il y a actuellement **12 comptes bancaires assignés aux sociétés du groupe** via la table de liaison qui fait foi (`company_bridge_accounts`).

Répartition :

- Cloud Vapor : 2 comptes
- Coachflix : 1 compte
- E-fumeur Internet : 3 comptes
- Tradeflix : 2 comptes
- Vapeflix : 1 compte
- Vapostore Lanester : 2 comptes
- Vapostore Vannes : 1 compte

Total assigné groupe : **12 comptes**.

Sur ta capture, on ne voit que **7 comptes**, et ce ne sont pas les bons :

- 2 comptes “Compte Cheques 1”
- 2 comptes “Compte De Chèques …”
- 3 comptes Vapeclub

Donc non : **tous les comptes du groupe Tradeflix ne sont pas affichés**, et **Vapeclub n’a effectivement rien à faire ici**.

## Cause racine

Le composant des paramètres bancaires charge les comptes à partir de `companies.bridge_user_uuid`.

Or dans les données :

- dans le groupe Tradeflix, une société (`E-fumeur Internet`) porte par erreur / historiquement le `bridge_user_uuid` `d20d...`
- ce même `bridge_user_uuid` correspond à des comptes Vapeclub et ZARA
- le vrai périmètre métier du groupe Tradeflix est pourtant déjà représenté correctement par `company_bridge_accounts`

Donc l’UI affiche des comptes “visibles par Bridge user”, au lieu d’afficher les comptes réellement assignés aux sociétés de l’organisation.

C’est exactement la dérive qu’on voulait éviter : la source technique Bridge pollue le périmètre métier.

## Correction proposée

### 1. Remettre la source de vérité au bon endroit

Dans `BankAccountsCard`, remplacer la logique principale de chargement :

- ne plus afficher les comptes à partir de tous les `bridge_user_uuid` présents sur les sociétés de l’org
- charger d’abord toutes les sociétés de l’organisation courante
- charger ensuite les assignations `company_bridge_accounts` de ces sociétés
- afficher les `bridge_accounts` correspondant à ces assignations

Résultat attendu : sur GROUPE TRADEFLIX, l’écran affichera les **12 comptes assignés au groupe**, pas les comptes Vapeclub/ZARA liés au mauvais `bridge_user_uuid`.

### 2. Garder les comptes non assignés uniquement dans un espace de configuration contrôlé

Pour ne pas perdre la capacité d’assigner de nouveaux comptes après une synchronisation, je conserverai une logique propre :

- comptes assignés à l’organisation : affichés normalement
- comptes non assignés mais issus d’une connexion bancaire explicitement reliée à l’organisation : affichables comme “Non assigné”
- comptes déjà assignés à une autre organisation : exclus de l’écran

Cela évite que Vapeclub apparaisse dans Tradeflix tout en gardant la possibilité d’assigner de nouveaux comptes légitimes.

### 3. Corriger la mise à jour des compteurs et soldes

Le bouton “Enregistrer” met actuellement à jour les compteurs seulement pour `companies` du hook courant, ce qui peut être incomplet ou incohérent.

Je vais le faire recalculer sur la liste complète des sociétés de l’organisation affichée, à partir de `company_bridge_accounts`.

### 4. Nettoyer l’affichage société

Le sélecteur utilisera uniquement les sociétés de l’organisation courante comme destinations possibles.

Si un compte est assigné à une société hors organisation, il ne doit pas apparaître dans cet écran. C’est plus sain que d’afficher “Société inconnue”.

## Impact attendu

Après correction :

- GROUPE TRADEFLIX affiche les 12 comptes du groupe
- les comptes Vapeclub disparaissent de l’écran Tradeflix
- les comptes restent assignables aux bonnes sociétés du groupe
- `company_bridge_accounts` reste la source de vérité unique
- on évite un patch local ou une exclusion en dur de Vapeclub

## Validation prévue

Après implémentation, je vérifierai :

- que la requête de données renvoie bien 12 comptes pour GROUPE TRADEFLIX
- que Vapeclub n’est plus présent dans `/parametres#accounts` côté Tradeflix
- que les sociétés dans le sélecteur correspondent uniquement aux sociétés du groupe
- que la sauvegarde d’assignation continue de fonctionner sans supprimer des assignations hors périmètre
- que les tests existants passent si disponibles