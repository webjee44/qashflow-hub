
# Import Zenfirst sur /reglages-tresorerie

## Objectif
Ajouter un module d'import de fichiers CSV/XLSX exportes depuis Zenfirst directement dans l'onglet Categories de la page Reglages Tresorerie.

---

## Fonctionnalites

### Ce qui sera importe
1. **Groupes** (niveau 1, 8 espaces d'indentation)
   - Fournisseurs, RH / Remuneration, Frais Generaux, Loyer, Banque...
   
2. **Categories** (niveau 2+, 16+ espaces)
   - Toutatis, Flavor District, Salaires, Logiciels, Honoraires...
   - Automatiquement rattachees a leur groupe parent

3. **Montants previsionnels par mois** (optionnel)
   - Janvier 2026: 30 647 EUR pour Toutatis
   - Import vers la table `category_forecasts`

### Detection automatique
- **Type**: "Encaissements" → income / "Decaissements" → expense
- **Hierarchie**: Indentation 8/16/24 espaces → niveaux 1/2/3
- **Montants**: Format francais "30 647" → 30647

---

## Interface utilisateur

### Etape 1: Upload
- Bouton "Importer depuis Zenfirst" dans l'en-tete de l'onglet Categories
- Dialog avec zone de drop pour fichier CSV ou XLSX
- Validation du format Zenfirst

### Etape 2: Apercu et mapping
- Liste des groupes et categories detectes
- Pour chaque element:
  - Checkbox pour inclure/exclure
  - Indication si deja existant (match par nom)
  - Type (income/expense) affiche
- Checkbox globale "Importer aussi les previsions"

### Etape 3: Confirmation
- Resume: X groupes, Y categories a creer
- Bouton "Importer"
- Creation en batch avec gestion des doublons

---

## Fichiers a creer

```text
src/
  lib/
    zenfirstParser.ts              # Parseur du format CSV/XLSX Zenfirst
  components/
    settings/
      ZenfirstImportDialog.tsx     # Dialog d'import multi-etapes
```

## Fichiers a modifier

```text
src/pages/TreasurySettings.tsx     # Ajout du bouton d'import
src/hooks/useCategories.ts         # Fonction de creation en batch
```

---

## Section technique

### Logique de parsing

```typescript
interface ZenfirstItem {
  name: string;
  level: number;           // 1, 2, 3 selon indentation
  type: 'income' | 'expense';
  parentName: string | null;
  monthlyAmounts: Record<string, number>; // "2026-01" => 30647
}

// Detection de l'indentation
function getIndentLevel(line: string): number {
  const spaces = line.search(/\S/);
  return Math.floor(spaces / 8); // 8=1, 16=2, 24=3
}

// Parsing montant francais
function parseAmount(value: string): number {
  return Math.abs(parseFloat(value.replace(/\s/g, '').replace(',', '.')) || 0);
}

// Parsing mois francais
const MONTHS_FR = {
  'Janvier': '01', 'Février': '02', 'Mars': '03', 'Avril': '04',
  'Mai': '05', 'Juin': '06', 'Juillet': '07', 'Août': '08',
  'Septembre': '09', 'Octobre': '10', 'Novembre': '11', 'Décembre': '12'
};
```

### Structure detectee dans le fichier exemple

**Encaissements (income)**:
- Non categorises: 21 609 EUR
- Ventes: 265 072 EUR
- Remboursements: 2 588 EUR
- etc.

**Decaissements (expense)**:
- Fournisseurs (groupe)
  - Toutatis: 30 647 EUR
  - Flavor District: 6 801 EUR
  - Autres fournisseurs: 2 059 EUR
- RH / Remuneration (groupe)
  - Salaires: 65 220 EUR
  - Mutuelle-ALAN: 576 EUR
- Frais Generaux (groupe)
  - Transport sur ventes: 4 996 EUR
  - Logiciels: 1 705 EUR
  - Honoraires (groupe niveau 2)
    - Coachflix: 6 000 EUR
- etc.

### Gestion des doublons
- Recherche par nom exact (insensible a la casse)
- Si existe: skip ou mise a jour des previsions uniquement
- Si nouveau: creation avec rattachement au parent

### Creation en batch

```typescript
// Dans useCategories.ts
async function bulkCreateCategories(items: {
  name: string;
  type: 'income' | 'expense';
  color: string;
  parentName?: string;
}[]): Promise<Category[]>
```

---

## Flux de donnees

```text
Fichier Zenfirst CSV/XLSX
        |
        v
[zenfirstParser.ts] 
        |
        v
Liste ZenfirstItem[]
        |
        v
[ZenfirstImportDialog] Etape mapping
        |
        v
Groupes a creer → useCategories.createGroup()
Categories a creer → useCategories.createCategory() avec parent_id
Previsions → useForecasts.upsertForecast()
```

---

## Estimation

- **Complexite**: Moyenne
- **Fichiers a creer**: 2
- **Fichiers a modifier**: 2
- **Points cles**:
  - Parsing correct de l'indentation (espaces vs tabs)
  - Gestion hierarchie 3 niveaux
  - Support CSV et XLSX
