
# Charges variables liees au CA dans les Previsions de Tresorerie

## Analyse du besoin

Tu as des categories de depenses (ex: "Toutatis") dont le montant depend du chiffre d'affaires (ex: 20% du CA TTC). Aujourd'hui, la seule facon de les prevoir est de saisir manuellement un montant fixe chaque mois. Tu veux que le previsionnel calcule automatiquement ces charges en fonction du CA prevu.

## Comment font les concurrents

- **Agicap / Fygr** : Permettent de creer des "regles de prevision" sur une categorie (montant fixe, % du CA, saisonnalite). Le % du CA est le mode le plus utilise pour les charges variables.
- **Runway** : Modelise tout comme des formules (drivers), chaque ligne pouvant etre `= X% * autre ligne`.
- **Approche standard** : La methode la plus repandue est d'ajouter un **mode de prevision** directement sur la categorie elle-meme : "fixe" (montant saisi) ou "variable" (% d'une base de calcul).

## Solution proposee : Mode de prevision par categorie

Ajouter un champ `forecast_mode` sur chaque categorie de depense, configurable depuis le dialogue de categorie. Deux modes :

1. **Manuel** (par defaut, comportement actuel) : L'utilisateur saisit un montant en euros
2. **% du CA** : L'utilisateur saisit un pourcentage ; le montant est calcule automatiquement a partir du total des encaissements prevus

### Pourquoi cette approche plutot que les "Engagements" ?

Les engagements (factures fournisseurs) sont des flux **confirmes** avec une date d'echeance precise. Les charges variables sont des **projections** basees sur l'activite future. Melanger les deux rendrait le tableau moins fiable. La bonne solution est d'automatiser le calcul previsionnel, pas de forcer l'utilisateur a creer des engagements fictifs.

### UX dans le tableau

- Les cellules des categories en mode "% du CA" affichent la valeur **calculee automatiquement** (non editable)
- Un petit badge `% 20%` apparait a cote du nom de la categorie pour signaler le mode variable
- Au survol de la cellule, un tooltip montre le detail : "20% x 54 960 EUR (CA prevu) = 10 992 EUR"
- Pour les mois passes : le systeme affiche le **reel** (transactions bancaires) comme aujourd'hui, pas le calcul theorique

## Modifications techniques

### 1. Migration base de donnees : table `categories`

Ajouter deux colonnes :
- `forecast_mode` : TEXT, defaut `'manual'`, valeurs possibles `'manual'` | `'percent_of_revenue'`
- `forecast_percent` : NUMERIC, defaut `0`, le pourcentage a appliquer (ex: 20 pour 20%)

### 2. `src/hooks/useCategories.ts`

- Ajouter les champs `forecast_mode` et `forecast_percent` a l'interface `Category`
- Mettre a jour les mutations create/update pour supporter ces champs

### 3. `src/components/categories/CategoryDialog.tsx`

- Ajouter une section "Mode de prevision" dans le formulaire (visible uniquement pour les categories de type `expense`)
- Selecteur : "Manuel" ou "% du CA"
- Si "% du CA" : afficher un champ pour saisir le pourcentage

### 4. `src/hooks/useForecasts.ts`

- Modifier `getForecast()` : pour les categories en mode `percent_of_revenue`, calculer dynamiquement le montant a partir du total des encaissements prevus du meme mois
- Modifier `getMonthTotal()` et `getMonthNetForecast()` pour integrer les charges calculees
- **Logique de calcul** : `montant = (forecast_percent / 100) * Total Encaissements HT du mois`
- **Important** : utiliser le total HT des encaissements (pas TTC) comme base, car les charges variables sont generalement exprimees en % du CA HT

### 5. `src/components/forecasts/ForecastTable.tsx`

- **Cellules non-editables** : Pour les categories `percent_of_revenue`, rendre la cellule en lecture seule avec une couleur de fond differente (ex: `bg-violet-500/10`)
- **Badge dans le nom** : Afficher un badge `% 20%` a cote du nom de la categorie
- **Tooltip au survol** : Montrer la formule detaillee (pourcentage x CA prevu = montant)
- **Mois passes** : Conserver l'affichage du reel (aucun changement)

### 6. Impact sur les calculs existants

- `renderTtcRow` (Total Decaissements) : inclura automatiquement les charges calculees car elles transitent par `getMonthTotal`
- `getMonthNetForecast` (Solde Net) : idem, le solde sera exact
- `getOpeningBalance` (Solde au 1er du mois) : pas impacte (utilise le reel pour les mois passes)
- **Pas de reference circulaire** : Les charges variables dependent des *encaissements* prevus, pas des decaissements. Pas de boucle infinie.

## Resultat attendu

- L'utilisateur configure une seule fois le % sur la categorie
- Quand il modifie ses previsions de CA (encaissements), les charges variables se recalculent instantanement
- Le tableau reste lisible : les cellules calculees sont visuellement distinctes
- Pour les mois passes, on affiche toujours les mouvements bancaires reels
