
# Modal de Détail des Transactions "Réel"

## Objectif

Permettre aux utilisateurs de cliquer sur une cellule "Réel" dans le tableau des previsions pour ouvrir un modal affichant le détail des transactions qui composent ce montant, inspiré de l'interface Zenfirst.

---

## Fonctionnalites du Modal

### En-tete du Modal
- **Fil d'Ariane** : Type (Encaissements/Decaissements) / Nom de la categorie
- **Selecteur de mois** : Boutons -/+ pour naviguer entre les mois sans fermer le modal
- **Resume** : 
  - Total du mois / Budget (ex: "15 802 EUR / 18 000 EUR")
  - Realise (X%) avec le montant
  - Budget (montant prevu)
  - Note (si disponible dans category_forecasts)

### Tableau des Transactions
- **Colonnes** :
  - Date (format "18 Dec 2025")
  - Libelle (description de la transaction)
  - Categorie (dropdown pour recategoriser)
  - Montant TTC
- **Pagination** : 10 transactions par page avec navigation
- **Tri** : Par date (decroissant par defaut)

### Actions Possibles
- Recategoriser une transaction depuis le dropdown
- Badge de validation (check vert) pour les transactions categorisees
- Bouton "..." pour actions supplementaires (future extension)

---

## Architecture Technique

### Nouveau Composant
```text
src/components/forecasts/TransactionDetailDialog.tsx
```

### Props du Composant
```typescript
interface TransactionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryType: 'income' | 'expense';
  initialMonth: Date;
  forecastAmount: number;
}
```

### Requete Supabase
```typescript
// Fetch transactions pour une categorie et un mois specifique
const { data } = await supabase
  .from('transactions')
  .select('*')
  .eq('category_id', categoryId)
  .gte('date', startOfMonth)
  .lt('date', endOfMonth)
  .is('deleted_at', null)
  .order('date', { ascending: false });
```

---

## Integration dans ForecastTable

### Modification de renderCell
La cellule "Reel" devient cliquable :
```typescript
// Cellule Reel - maintenant cliquable
<div 
  className={cn(
    "flex-1 px-3 py-2 text-right border-r border-border/50 bg-muted/20 cursor-pointer hover:bg-muted/40",
    hasActual && (isPositive ? "text-success" : "text-destructive")
  )}
  onClick={() => hasActual && openTransactionDetail(categoryId, monthIndex)}
>
  {hasActual ? formatValue(Math.abs(actual)) : '—'}
</div>
```

### Nouvel Etat dans ForecastTable
```typescript
const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
const [transactionDetailCategory, setTransactionDetailCategory] = useState<{
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
  monthIndex: number;
  forecast: number;
} | null>(null);
```

---

## Design UI

### Structure du Dialog
```text
+----------------------------------------------------------+
| Decaissements / Salaires                              X  |
+----------------------------------------------------------+
|                    [ - ]  Fev 2026  [ + ]                |
|                                                          |
|              Total du mois / Budget                      |
|              15 802 EUR / 18 000 EUR                     |
|                                                          |
|  +-----------------------+-----------------------+       |
|  | Realise (88%)         |            15 802 EUR |       |
|  +-----------------------+-----------------------+       |
|  | Budget                |            18 000 EUR |       |
|  +-----------------------+-----------------------+       |
|  | Note                  |                     - |       |
|  +-----------------------+-----------------------+       |
|                                                          |
|  Realise                                                 |
|  --------------------------------------------------------|
|  Date    | Libelle              | Categorie | Montant    |
|  --------|----------------------|-----------|------------|
|  18 Dec  | VIR REMISE Cloud...  | Salaires  | 15 802 EUR |
|  ...     | ...                  | ...       | ...        |
|  --------------------------------------------------------|
|                    < 1 > 10 / page                       |
+----------------------------------------------------------+
```

### Classes Tailwind Cles
- Modal large : `max-w-3xl`
- En-tete avec fond subtil : `bg-muted/30`
- Separateurs clairs entre sections
- Badge de validation : `text-success`
- Montants negatifs : `text-destructive`

---

## Fichiers a Modifier/Creer

| Fichier | Action |
|---------|--------|
| `src/components/forecasts/TransactionDetailDialog.tsx` | CREER |
| `src/components/forecasts/ForecastTable.tsx` | MODIFIER |

---

## Gestion de la Pagination

```typescript
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(10);

// Calcul des transactions affichees
const paginatedTransactions = transactions.slice(
  (page - 1) * pageSize,
  page * pageSize
);

const totalPages = Math.ceil(transactions.length / pageSize);
```

---

## Navigation entre Mois

Le selecteur de mois permet de naviguer sans fermer le modal :
```typescript
const [currentMonth, setCurrentMonth] = useState(initialMonth);

const handlePreviousMonth = () => {
  setCurrentMonth(prev => addMonths(prev, -1));
  setPage(1); // Reset pagination
};

const handleNextMonth = () => {
  setCurrentMonth(prev => addMonths(prev, 1));
  setPage(1);
};
```

Les donnees se rechargent automatiquement grace a la dependance dans useQuery.

---

## Indicateur de Progression

Barre de progression visuelle comparant realise vs budget :
```typescript
const progressPercent = forecastAmount > 0 
  ? Math.min((actualTotal / forecastAmount) * 100, 100) 
  : 0;

<Progress value={progressPercent} className="h-2" />
```

---

## Resume

Cette fonctionnalite permet aux utilisateurs de :
1. **Comprendre** d'ou vient chaque chiffre "Reel" 
2. **Naviguer** entre les mois sans quitter le modal
3. **Recategoriser** directement les transactions mal classees
4. **Comparer** visuellement le realise vs le budget

L'implementation suit le design Zenfirst en l'ameliorant avec une interface plus moderne et fluide.
