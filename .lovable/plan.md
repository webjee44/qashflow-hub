

# Refonte des soldes dans le tableau de previsions

## Problemes identifies

1. **"Solde Net TTC"** est un nom trompeur : c'est la variation nette du mois (encaissements - decaissements), pas un solde bancaire. Les utilisateurs confondent.
2. **"Solde au 1er du mois"** est correct dans la logique mais ne montre pas le solde de fin de mois, ce qui empeche de voir l'evolution du solde bancaire cumule.
3. L'utilisateur ne peut pas lire directement : "je commence le mois a X, il se passe Y, je finis a Z".

## Solution proposee

Restructurer le tableau pour afficher clairement 3 lignes de synthese :

```text
+------------------------------+----------+----------+----------+
|                               | Janv     | Fev      | Mars     |
+------------------------------+----------+----------+----------+
| Solde de debut de mois        | 50 000   | 55 000   | 48 000   |
|   Encaissements (detail...)   |          |          |          |
|   Total Encaissements TTC     | 30 000   | 25 000   | 32 000   |
|   Decaissements (detail...)   |          |          |          |
|   Total Decaissements TTC     | 25 000   | 32 000   | 28 000   |
| Variation nette du mois       | +5 000   | -7 000   | +4 000   |
| Solde de fin de mois          | 55 000   | 48 000   | 52 000   |
+------------------------------+----------+----------+----------+
```

Le solde de fin du mois N = solde de debut du mois N+1 (coherence garantie).

## Modifications techniques

### 1. Renommer "Solde Net TTC" en "Variation nette du mois"
- Fichier : `src/components/forecasts/ForecastTable.tsx`, fonction `renderNetRow()`
- Changer le label de "Solde Net TTC" a "Variation nette du mois"
- Le calcul reste identique (encaissements TTC - decaissements TTC)

### 2. Ajouter une ligne "Solde de fin de mois"
- Fichier : `src/components/forecasts/ForecastTable.tsx`
- Nouvelle fonction `renderClosingBalanceRow()`
- Calcul : `solde debut du mois + variation nette = solde fin de mois`
- Pour les mois passes : solde debut + flux reels
- Pour les mois futurs : solde debut + flux previsionnels
- Style : ligne en gras avec fond colore, rouge si negatif

### 3. Ajouter un helper `getClosingBalance` dans useForecasts
- Fichier : `src/hooks/useForecasts.ts`
- Logique : `getOpeningBalance(month).balance + getMonthNetForecast(month)` pour le futur
- Pour les mois passes : `getOpeningBalance(nextMonth).balance` (le solde d'ouverture du mois suivant = cloture du mois courant)

### 4. Repositionner les lignes dans le tableau
- Ordre final dans le `<tbody>` :
  1. Solde de debut de mois (existant, renomme depuis "Solde au 1er du mois")
  2. Section Encaissements (inchange)
  3. Total Encaissements TTC (inchange)
  4. Section Decaissements (inchange)
  5. TVA a decaisser (inchange)
  6. Total Decaissements TTC (inchange)
  7. Dettes non categorisees (inchange)
  8. **Variation nette du mois** (ex "Solde Net TTC")
  9. **Solde de fin de mois** (nouveau)

### 5. Impact sur le graphique
- Fichier : `src/components/forecasts/ForecastChart.tsx`
- Ajouter une courbe "Solde projete" qui montre l'evolution du solde de fin de mois dans le temps (optionnel, a confirmer)

## Fichiers concernes
- `src/hooks/useForecasts.ts` : ajout de `getClosingBalance`
- `src/components/forecasts/ForecastTable.tsx` : renommage + nouvelle ligne + reorganisation

## Resultat attendu
L'utilisateur voit clairement pour chaque mois : solde initial, flux entrants/sortants, et solde final. Le solde de fin de mois N est identique au solde de debut du mois N+1, garantissant la coherence de la projection.

