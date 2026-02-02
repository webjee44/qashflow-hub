
# Plan : Intégration des Dettes Fournisseurs dans les Prévisions

## Objectif

Afficher les dettes fournisseurs (factures de type `payable`) dans le tableau de prévisions, en les répartissant sur les mois correspondants selon la règle suivante :
- **Factures échues** (due_date < aujourd'hui) → placées à la fin du mois en cours
- **Factures en attente** → placées sur leur mois d'échéance (due_date)

---

## Architecture de la Solution

```text
+----------------+     +------------------+     +-------------------+
|   invoices     | --> | useForecasts.ts  | --> | ForecastTable.tsx |
|   (payable)    |     | + query factures |     | + ligne "Dettes   |
|                |     | + getPayableFlow |     |   à payer"        |
+----------------+     +------------------+     +-------------------+
```

---

## Modifications Fichier par Fichier

### 1. `src/hooks/useForecasts.ts`

**Ajouts :**
- Nouvelle query pour récupérer les factures `payable` de la table `invoices`
- Helper `getPayableOutflow(month: Date): number` qui calcule le montant TTC des dettes à payer pour un mois donné

**Logique de placement :**
```typescript
const getPayableOutflow = (month: Date): number => {
  const today = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(today);
  const targetStart = startOfMonth(month);
  const targetEnd = endOfMonth(month);
  
  return payableInvoices
    .filter(inv => {
      const dueDate = new Date(inv.due_date);
      
      // Facture échue → fin du mois en cours
      if (dueDate < today) {
        return targetStart <= currentMonthEnd && currentMonthEnd <= targetEnd;
      }
      
      // Facture normale → mois de l'échéance
      return dueDate >= targetStart && dueDate <= targetEnd;
    })
    .reduce((sum, inv) => sum + Number(inv.amount_ttc), 0);
};
```

**Export additionnel :**
- `payableInvoices` : liste brute des factures fournisseurs
- `getPayableOutflow` : helper pour récupérer le montant par mois
- `payablesLoading` : état de chargement

### 2. `src/components/forecasts/ForecastTable.tsx`

**Ajouts UI :**
- Nouvelle ligne **"📤 Dettes à payer"** après la section Décaissements
- Style distinctif : icône `ArrowUpRight`, fond rouge léger (`bg-destructive/10`)
- Affichage du montant TTC prévu par mois (non éditable, lecture seule)

**Position dans le tableau :**
```text
📈 Encaissements
   ...
   Total Encaissements TTC

📉 Décaissements  
   ...
   Total Décaissements TTC

📤 Dettes à payer (NOUVEAU)
   → Montant des factures fournisseurs à régler ce mois

💰 TVA à payer
Solde Net TTC (mis à jour pour inclure les dettes)
```

**Intégration dans le Solde Net :**
- Modifier `renderNetRow()` pour soustraire `getPayableOutflow(month)` du solde net

### 3. `src/components/forecasts/ForecastChart.tsx`

**Mise à jour :**
- Inclure les dettes fournisseurs dans les barres "Dépenses" (outflows)
- Le solde cumulé reflétera la projection de trésorerie avec les dettes

---

## Détails Techniques

### Structure des données

| Champ | Utilisation |
|-------|-------------|
| `due_date` | Détermine le mois de placement |
| `amount_ttc` | Montant affiché (flux de trésorerie réel) |
| `type = 'payable'` | Filtre pour les dettes fournisseurs |
| `status = 'pending'` | Seules les factures non payées |

### Règle de placement (rappel)

| Situation | Mois de placement |
|-----------|-------------------|
| `due_date < today` (échue) | Fin du mois en cours |
| `due_date >= today` | Mois de la `due_date` |

---

## Fichiers à Modifier

| Fichier | Action |
|---------|--------|
| `src/hooks/useForecasts.ts` | Ajouter query invoices + helper getPayableOutflow |
| `src/components/forecasts/ForecastTable.tsx` | Ajouter ligne dettes + modifier Solde Net |
| `src/components/forecasts/ForecastChart.tsx` | Intégrer dettes dans les dépenses du graphique |

---

## Résultat Attendu

Le prévisionnel affichera :
1. Les flux manuels par catégorie (existant)
2. **Les dettes fournisseurs à payer par mois (nouveau)**
3. Un solde net intégrant les dettes prévues

L'utilisateur verra clairement quand les dettes fournisseurs doivent être réglées et leur impact sur la trésorerie prévisionnelle.
