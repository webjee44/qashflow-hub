

# Correction du calcul des soldes prévisionnels dans `useForecasts.ts`

## Diagnostic confirmé

Votre analyse est exacte. Le code actuel dans `getOpeningBalance` a deux bugs symétriques causés par l'utilisation directe de `currentBankBalance` (solde live du jour) au lieu du solde d'ouverture du mois en cours :

1. **Mois futurs (ligne 772)** : `projectedBalance = currentBankBalance` puis boucle sur les mois entiers depuis `todayMonth` → double-comptage des transactions déjà incluses dans le solde live
2. **Mois passés fallback (ligne 768)** : `currentBankBalance - netBetween` mais `netBetween` exclut les transactions du mois en cours (filtre `txDate < todayMonth`) → soldes passés décalés du net intra-mois

## Plan de correction

**Fichier unique : `src/hooks/useForecasts.ts`**, fonction `getOpeningBalance` (lignes 685-778)

### Changement

Calculer d'abord le **solde d'ouverture du mois en cours** (`currentMonthOpening = currentBankBalance - net des transactions depuis le 1er du mois`), puis l'utiliser comme point d'ancrage pour :
- Les mois passés (fallback) : `currentMonthOpening - netBetween` au lieu de `currentBankBalance - netBetween`
- Les mois futurs : `projectedBalance = currentMonthOpening` au lieu de `currentBankBalance`

Le calcul du mois en cours (lignes 717-734) fait déjà exactement ce calcul — on le centralise simplement en amont.

### Détail technique

```text
getOpeningBalance(month):
  
  1. Calculer currentMonthOpening une seule fois :
     = currentBankBalance - Σ(transactions depuis le 1er du mois courant)
  
  2. Mois courant (inchangé, utilise déjà ce calcul) :
     → Vérifier override du mois précédent
     → Sinon retourner currentMonthOpening
  
  3. Mois passés - fallback (ligne 768) :
     AVANT: currentBankBalance - netBetween  
     APRÈS: currentMonthOpening - netBetween
  
  4. Mois futurs (ligne 772-776) :
     AVANT: projectedBalance = currentBankBalance
     APRÈS: projectedBalance = currentMonthOpening
```

Les chemins avec snapshots/overrides ne sont pas affectés — ils utilisent déjà des valeurs de référence correctes.

### Note sur tx.amount

Le stockage actuel utilise des montants positifs avec un champ `type` séparé (`income`/`expense`). La ternaire `tx.type === 'income' ? amount : -amount` est cohérente avec ce modèle. Pas de changement nécessaire.

