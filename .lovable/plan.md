
# Plan : Édition en masse des charges fixes via Excel

## Objectif

Remplacer le bouton "Ajout en masse" par "Édition en masse" qui ouvre un modal permettant de :
1. **Télécharger un fichier Excel** (.xlsx) pré-rempli avec les charges existantes et des colonnes vides pour en ajouter
2. **Menus déroulants Excel natifs** pour les champs avec valeurs prédéfinies (catégorie, périodicité, TVA déductible)
3. **Importer le fichier modifié** pour créer/modifier/supprimer les charges en masse

---

## Architecture technique

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BulkEditExpenseDialog.tsx                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ÉTAPE 1 : Téléchargement                                             │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  📊 Télécharger le fichier Excel                                │  │  │
│  │  │  ┌───────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │  [Télécharger le modèle Excel]                            │  │  │  │
│  │  │  │  • 15 charges existantes pré-remplies                     │  │  │  │
│  │  │  │  • 50 lignes vides pour ajouts                            │  │  │  │
│  │  │  │  • Menus déroulants pour Catégorie, Périodicité, TVA      │  │  │  │
│  │  │  └───────────────────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │  ÉTAPE 2 : Import                                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  📥 Importer votre fichier modifié                              │  │  │
│  │  │  [Glissez ou cliquez pour importer]                             │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │  ÉTAPE 3 : Aperçu des modifications                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  ✅ 5 charges à ajouter                                         │  │  │
│  │  │  ✏️ 3 charges à modifier                                        │  │  │
│  │  │  🗑️ 2 charges à supprimer (ID présent mais ligne vide)          │  │  │
│  │  │                                                                 │  │  │
│  │  │  [Annuler]  [Appliquer les modifications]                       │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Dépendance à installer

**ExcelJS** - Bibliothèque pour générer des fichiers Excel avec data validation (dropdowns natifs)

```json
"exceljs": "^4.4.0"
```

---

## 2. Structure du fichier Excel généré

| Colonne | Nom | Type | Dropdown | Obligatoire |
|---------|-----|------|----------|-------------|
| A | ID | Texte | Non | Non (vide = nouvelle charge) |
| B | Nom | Texte | Non | Oui |
| C | Catégorie | Liste | Oui (12 valeurs) | Oui |
| D | Montant | Nombre | Non | Oui |
| E | Périodicité | Liste | Oui (4 valeurs) | Oui |
| F | Taux TVA (%) | Nombre | Non | Non (défaut: 20) |
| G | TVA déductible | Liste | Oui (Oui/Non) | Non (défaut: Oui) |
| H | Date début | Date | Non | Non (défaut: aujourd'hui) |
| I | Date fin | Date | Non | Non |
| J | Notes | Texte | Non | Non |

**Feuille cachée "Listes"** contenant les valeurs des dropdowns :
- Catégories : Loyer & Charges locatives, Assurances, Logiciels & Abonnements, etc.
- Périodicités : Mensuel, Trimestriel, Semestriel, Annuel
- TVA déductible : Oui, Non

---

## 3. Fichiers à créer/modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/components/businessplan/BulkEditExpenseDialog.tsx` | **Créer** | Composant modal principal |
| `src/lib/excelExpenseTemplate.ts` | **Créer** | Génération Excel avec ExcelJS |
| `src/lib/excelExpenseParser.ts` | **Créer** | Parsing du fichier importé |
| `src/pages/BusinessPlan/Expenses.tsx` | **Modifier** | Remplacer "Ajout en masse" |
| `package.json` | **Modifier** | Ajouter dépendance exceljs |

---

## 4. Détail technique : Génération Excel avec dropdowns

```typescript
// src/lib/excelExpenseTemplate.ts
import ExcelJS from 'exceljs';
import { FIXED_EXPENSE_CATEGORIES, PAYMENT_FREQUENCIES } from '@/constants/bpConstants';

export async function generateExpenseTemplate(existingExpenses: BPFixedExpense[]) {
  const workbook = new ExcelJS.Workbook();
  
  // Feuille principale
  const sheet = workbook.addWorksheet('Charges fixes');
  
  // Feuille cachée pour les listes déroulantes
  const listsSheet = workbook.addWorksheet('Listes');
  listsSheet.state = 'veryHidden'; // Invisible pour l'utilisateur
  
  // Remplir les listes
  const categories = Object.entries(FIXED_EXPENSE_CATEGORIES).map(([key, {label}]) => label);
  const frequencies = Object.entries(PAYMENT_FREQUENCIES).map(([key, {label}]) => label);
  const yesNo = ['Oui', 'Non'];
  
  categories.forEach((cat, i) => listsSheet.getCell(`A${i+1}`).value = cat);
  frequencies.forEach((freq, i) => listsSheet.getCell(`B${i+1}`).value = freq);
  yesNo.forEach((val, i) => listsSheet.getCell(`C${i+1}`).value = val);
  
  // Définir les plages nommées
  workbook.definedNames.add(`Listes!$A$1:$A$${categories.length}`, 'Categories');
  workbook.definedNames.add(`Listes!$B$1:$B$${frequencies.length}`, 'Periodicites');
  workbook.definedNames.add(`Listes!$C$1:$C$2`, 'OuiNon');
  
  // En-têtes
  sheet.columns = [
    { header: 'ID (ne pas modifier)', key: 'id', width: 36 },
    { header: 'Nom *', key: 'name', width: 30 },
    { header: 'Catégorie *', key: 'category', width: 25 },
    { header: 'Montant (€) *', key: 'amount', width: 15 },
    { header: 'Périodicité', key: 'frequency', width: 15 },
    { header: 'Taux TVA (%)', key: 'vat', width: 12 },
    { header: 'TVA déductible', key: 'vatDeductible', width: 15 },
    { header: 'Date début', key: 'startDate', width: 12 },
    { header: 'Date fin', key: 'endDate', width: 12 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];
  
  // Style header
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  
  // Ajouter charges existantes
  existingExpenses.forEach(expense => {
    sheet.addRow({
      id: expense.id,
      name: expense.name,
      category: FIXED_EXPENSE_CATEGORIES[expense.category]?.label,
      amount: expense.monthly_amount,
      frequency: PAYMENT_FREQUENCIES[expense.payment_frequency]?.label || 'Mensuel',
      vat: expense.vat_rate * 100,
      vatDeductible: expense.is_vat_deductible ? 'Oui' : 'Non',
      startDate: expense.start_date,
      endDate: expense.end_date || '',
      notes: expense.notes || '',
    });
  });
  
  // Ajouter 50 lignes vides pour nouveaux ajouts
  const startRow = existingExpenses.length + 2;
  for (let i = 0; i < 50; i++) {
    sheet.addRow({});
  }
  
  // Appliquer les validations (dropdowns) sur toutes les lignes de données
  const lastRow = startRow + 50;
  
  // Catégorie (colonne C)
  sheet.dataValidations.add(`C2:C${lastRow}`, {
    type: 'list',
    allowBlank: true,
    formulae: ['=Categories'],
    showErrorMessage: true,
    errorTitle: 'Catégorie invalide',
    error: 'Veuillez sélectionner une catégorie dans la liste',
  });
  
  // Périodicité (colonne E)
  sheet.dataValidations.add(`E2:E${lastRow}`, {
    type: 'list',
    allowBlank: true,
    formulae: ['=Periodicites'],
    showErrorMessage: true,
  });
  
  // TVA déductible (colonne G)
  sheet.dataValidations.add(`G2:G${lastRow}`, {
    type: 'list',
    allowBlank: true,
    formulae: ['=OuiNon'],
  });
  
  return workbook;
}
```

---

## 5. Parsing et différentiel à l'import

```typescript
// src/lib/excelExpenseParser.ts

interface ImportDiff {
  toCreate: Partial<BPFixedExpense>[];
  toUpdate: { id: string; changes: Partial<BPFixedExpense> }[];
  toDelete: string[];
  errors: { row: number; message: string }[];
}

export async function parseExpenseExcel(
  file: File, 
  existingExpenses: BPFixedExpense[]
): Promise<ImportDiff> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  
  const sheet = workbook.getWorksheet('Charges fixes');
  const existingIds = new Set(existingExpenses.map(e => e.id));
  const seenIds = new Set<string>();
  
  const diff: ImportDiff = { toCreate: [], toUpdate: [], toDelete: [], errors: [] };
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    
    const id = row.getCell(1).value?.toString();
    const name = row.getCell(2).value?.toString()?.trim();
    const categoryLabel = row.getCell(3).value?.toString();
    const amount = parseFloat(row.getCell(4).value?.toString() || '0');
    
    // Ligne vide avec ID = suppression
    if (id && existingIds.has(id) && !name) {
      diff.toDelete.push(id);
      seenIds.add(id);
      return;
    }
    
    // Ligne sans nom ni ID = ignorer
    if (!name) return;
    
    // Convertir label -> code catégorie
    const category = labelToCategory(categoryLabel);
    
    // Nouvelle charge (pas d'ID)
    if (!id) {
      diff.toCreate.push({ name, category, monthly_amount: amount, ... });
    } 
    // Modification (ID existant)
    else if (existingIds.has(id)) {
      seenIds.add(id);
      diff.toUpdate.push({ id, changes: { name, category, monthly_amount: amount, ... } });
    }
  });
  
  return diff;
}
```

---

## 6. Modification de la page Expenses.tsx

Remplacer le bouton "Ajout en masse" par :

```tsx
<Button 
  size="sm" 
  variant="outline"
  className="gap-2"
  onClick={() => setBulkEditDialogOpen(true)}
>
  <FileSpreadsheet className="h-4 w-4" />
  Édition en masse
</Button>

<BulkEditExpenseDialog
  open={bulkEditDialogOpen}
  onOpenChange={setBulkEditDialogOpen}
  expenses={expenses}
  onComplete={() => {
    // Refresh data
    queryClient.invalidateQueries(['bp_fixed_expenses']);
  }}
/>
```

---

## 7. UX du modal

**Étape 1 - Téléchargement**
- Bouton principal "Télécharger le modèle Excel"
- Affiche le nombre de charges existantes qui seront incluses
- Instructions claires sur le fonctionnement des dropdowns

**Étape 2 - Import**
- Zone de drop + bouton de sélection de fichier
- Accepte uniquement .xlsx
- Parsing immédiat avec spinner

**Étape 3 - Prévisualisation**
- Résumé des modifications détectées (ajouts/modifs/suppressions)
- Tableau scrollable avec aperçu des changements
- Erreurs de validation en rouge
- Bouton "Appliquer" désactivé si erreurs bloquantes

---

## 8. Points techniques importants

- **ExcelJS fonctionne côté client** - pas besoin d'Edge Function
- **Dropdowns Excel natifs** - fonctionnent dans Excel, Google Sheets, LibreOffice
- **Mapping bidirectionnel** label/code pour les catégories
- **Gestion des suppressions** - ligne avec ID mais vide = suppression
- **Validation robuste** - erreurs par ligne avec numéro de ligne
- **Prévisualisation** - l'utilisateur voit les changements avant confirmation

---

## Résumé

Cette fonctionnalité transforme la gestion des charges fixes en permettant :
- Export Excel avec **menus déroulants natifs** pour tous les champs à valeurs fixes
- Import avec **détection automatique** des ajouts, modifications et suppressions
- **Prévisualisation** avant application des changements
- **Workflow professionnel** type import/export comptable
