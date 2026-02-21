

# Mise en valeur du mois en cours : Reel vs Prevu

## Constat actuel

Le mois en cours affiche deja deux sous-colonnes "Reel" et "Prevu", mais visuellement il se fond trop avec les autres mois. On ne voit pas d'un coup d'oeil ou on en est par rapport aux previsions.

## Inspirations Zenfirst

L'ecran Zenfirst montre pour le mois courant :
- Un en-tete de colonne clairement mis en avant (fond colore distinct)
- Pour chaque categorie : affichage **"Reel / Prevu"** avec une **barre de progression** en dessous
- Les barres sont vertes (encaissements) ou rouges (decaissements) et montrent le % de realisation
- Les totaux du mois courant montrent aussi ce format avec barre

## Modifications proposees

### 1. En-tete du mois courant plus visible
- Ajouter un fond `bg-primary/10` plus marque sur l'en-tete du mois courant + une bordure gauche/droite coloree `border-x-2 border-primary/30`
- Mettre le nom du mois en couleur primaire

### 2. Barres de progression dans les cellules du mois courant
Pour chaque cellule du mois en cours (categories, totaux, variation nette), ajouter sous les valeurs une mini barre de progression :
- **Encaissements** : barre verte, % = reel / prevu
- **Decaissements** : barre rouge, % = reel / prevu  
- Largeur de la barre = `min(100%, (reel/prevu) * 100)%`
- Si reel depasse prevu : barre a 100% avec couleur plus intense

### 3. Lignes de synthese (totaux, soldes) du mois courant
- Les lignes "Total Encaissements", "Total Decaissements", "Variation nette" et "Solde de fin de mois" du mois courant auront aussi une barre de progression
- Le solde de fin de mois montre la progression vers la prevision

## Details techniques

### Fichier : `src/components/forecasts/ForecastTable.tsx`

**Nouveau composant interne `ProgressBar`** :
```tsx
const ProgressBar = ({ actual, forecast, type }: { actual: number; forecast: number; type: 'income' | 'expense' | 'balance' }) => {
  if (forecast === 0 && actual === 0) return null;
  const pct = forecast > 0 ? Math.min(100, (actual / forecast) * 100) : (actual > 0 ? 100 : 0);
  const colorClass = type === 'income' ? 'bg-success' : type === 'expense' ? 'bg-destructive' : 'bg-primary';
  const overBudget = forecast > 0 && actual > forecast;
  return (
    <div className="w-full h-1.5 bg-muted/50 rounded-full mt-1">
      <div className={cn(colorClass, overBudget && "opacity-80", "h-full rounded-full transition-all")}
        style={{ width: `${pct}%` }} />
    </div>
  );
};
```

**Modification de `renderCell` (mois courant)** : ajouter `<ProgressBar>` sous les valeurs dans la sous-colonne "Reel" du mois courant.

**Modification du header `<thead>`** : renforcer le style du mois courant avec un fond plus visible, une bordure coloree, et le nom du mois en `text-primary font-bold`.

**Modification des lignes de totaux** (`renderTtcRow`, `renderNetRow`, `renderClosingBalanceRow`) : ajouter la barre de progression pour le mois courant.

### Fichier unique concerne
- `src/components/forecasts/ForecastTable.tsx`

## Resultat attendu
Le mois en cours ressort immediatement dans le tableau avec :
- Un en-tete visuellement distinct (fond colore + bordures)
- Des barres de progression montrant en un clin d'oeil le taux de realisation reel/prevu par categorie
- Une lecture instantanee du type "on est a 70% des encaissements prevus ce mois"

