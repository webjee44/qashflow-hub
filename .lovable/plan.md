
# Plan : Import intelligent de tableau d'amortissement par IA

## Objectif

Permettre à l'utilisateur d'importer un tableau d'amortissement PDF (de n'importe quelle banque) et utiliser l'IA pour extraire automatiquement les données du prêt afin de pré-remplir le formulaire de nouveau financement.

## Analyse des deux PDF exemples

| Champ | PDF Banque Populaire | PDF CIC |
|-------|---------------------|---------|
| **Montant emprunté** | 100 000 € | 40 000 € |
| **Taux** | Non visible directement | 3.64% |
| **Mensualité** | ~2 155 € (avec assurance) | ~1 100 € |
| **Durée** | ~60 mois | Variable (déblocages multiples) |
| **Banque** | Banque Populaire Grand Ouest | CIC Ouest |
| **Référence prêt** | 09078465 | 30047 14121 00020355504 |

Les structures sont très différentes, mais l'IA (Gemini) peut les analyser.

---

## Architecture technique

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        FinancingDialog.tsx                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  📄 Importer un tableau d'amortissement PDF                       │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  [Glissez un PDF ici ou cliquez pour sélectionner]          │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                   │  │
│  │  ⏳ Analyse en cours... (si parsing)                              │  │
│  │                                                                   │  │
│  │  ✅ Données extraites :                                           │  │
│  │  • Montant : 40 000 €                                             │  │
│  │  • Taux : 3.64%                                                   │  │
│  │  • Mensualité : 1 100 €                                           │  │
│  │  • Durée estimée : 48 mois                                        │  │
│  │  • Nom : PRET TRANSITION NUMERIQUE CIC                            │  │
│  │                                                                   │  │
│  │  [Appliquer ces valeurs]                                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─── OU saisissez manuellement ───────────────────────────────────────  │
│                                                                         │
│  [Formulaire existant pré-rempli si données extraites]                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Edge Function : `parse-amortization-schedule`

Créer une nouvelle Edge Function basée sur le pattern de `parse-payslip` :

```typescript
// supabase/functions/parse-amortization-schedule/index.ts

interface AmortizationData {
  loan_name: string | null;           // Nom du prêt
  bank_name: string | null;           // Nom de la banque
  loan_reference: string | null;      // Référence du prêt
  initial_amount: number;             // Capital emprunté
  interest_rate: number | null;       // Taux d'intérêt annuel (%)
  duration_months: number | null;     // Durée totale en mois
  monthly_payment: number | null;     // Mensualité (hors/avec assurance)
  monthly_insurance: number | null;   // Assurance mensuelle si séparée
  start_date: string | null;          // Date de première échéance
  outstanding_capital: number | null; // Capital restant dû actuel
  total_interest: number | null;      // Total des intérêts à payer
  loan_type: 'loan' | 'lease' | null; // Type détecté
  confidence_score: number;           // Score de confiance 0-1
}
```

**Prompt IA optimisé** pour extraire les données de n'importe quel format de tableau :

```text
Tu es un expert en analyse de tableaux d'amortissement bancaires français.
Analyse ce document PDF et extrais les informations du prêt au format JSON.

RÈGLES IMPORTANTES:
- Cherche le montant INITIAL emprunté (pas le restant dû)
- Le taux est généralement en % annuel
- La mensualité peut inclure ou non l'assurance
- La durée peut être calculée = nombre de lignes d'échéances
- Pour la date, prends la première échéance visible

Formats de tableaux courants:
- Banque Populaire : colonnes N°, Date, Terme, Échéance, Intérêts, Capital amorti
- CIC : colonnes Date, Type, Capital dû, Capital, Intérêts, Échéance
- LCL, SG, BNP : formats similaires avec variations

JSON attendu:
{
  "loan_name": "<nom/type du prêt>",
  "bank_name": "<nom de la banque>",
  "loan_reference": "<numéro de référence>",
  "initial_amount": <montant en euros>,
  "interest_rate": <taux annuel en %, ex: 3.64>,
  "duration_months": <durée totale en mois>,
  "monthly_payment": <mensualité principale en euros>,
  "monthly_insurance": <assurance mensuelle si visible>,
  "start_date": "<YYYY-MM-DD de première échéance>",
  "outstanding_capital": <capital restant dû actuel si visible>,
  "total_interest": <total des intérêts si visible>,
  "loan_type": "loan" ou "lease",
  "confidence_score": <0 à 1>
}
```

---

## 2. Modification du FinancingDialog

### Nouveau state

```typescript
const [pdfFile, setPdfFile] = useState<File | null>(null);
const [isParsing, setIsParsing] = useState(false);
const [parsedData, setParsedData] = useState<AmortizationData | null>(null);
const [parseError, setParseError] = useState<string | null>(null);
```

### Zone de drop PDF

Ajouter au début du formulaire une zone d'import :

```tsx
{/* Import PDF Section */}
<div className="border-2 border-dashed rounded-lg p-4 text-center">
  <input
    type="file"
    accept=".pdf"
    onChange={handleFileChange}
    className="hidden"
    id="pdf-upload"
  />
  <label htmlFor="pdf-upload" className="cursor-pointer">
    <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
    <p className="text-sm font-medium">Importer un tableau d'amortissement</p>
    <p className="text-xs text-muted-foreground">PDF de votre banque</p>
  </label>
</div>

{isParsing && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    Analyse IA en cours...
  </div>
)}

{parsedData && (
  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
    <p className="font-medium text-green-700 dark:text-green-400 mb-2">
      ✅ Données extraites
    </p>
    <div className="text-sm space-y-1">
      <p>Montant : {formatCurrency(parsedData.initial_amount)}</p>
      <p>Taux : {parsedData.interest_rate}%</p>
      <p>Mensualité : {formatCurrency(parsedData.monthly_payment)}</p>
    </div>
    <Button 
      variant="outline" 
      size="sm" 
      className="mt-2"
      onClick={applyParsedData}
    >
      Appliquer ces valeurs
    </Button>
  </div>
)}
```

### Fonction d'upload et parsing

```typescript
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || file.type !== 'application/pdf') {
    toast.error('Veuillez sélectionner un fichier PDF');
    return;
  }

  setIsParsing(true);
  setParseError(null);
  setParsedData(null);

  try {
    // Convert to base64
    const base64 = await fileToBase64(file);
    
    // Call edge function
    const { data, error } = await supabase.functions.invoke('parse-amortization-schedule', {
      body: { pdf_base64: base64 }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    setParsedData(data);
    toast.success('Tableau analysé avec succès');
  } catch (err) {
    setParseError(err.message);
    toast.error('Erreur lors de l\'analyse du PDF');
  } finally {
    setIsParsing(false);
  }
};

const applyParsedData = () => {
  if (!parsedData) return;
  
  setName(parsedData.loan_name || `${parsedData.bank_name} - Prêt`);
  setAmount(parsedData.initial_amount.toString());
  setInterestRate(parsedData.interest_rate?.toString() || '3.5');
  setDurationMonths(parsedData.duration_months?.toString() || '60');
  if (parsedData.start_date) setStartDate(parsedData.start_date);
  
  // Store in notes for reference
  setNotes(`Réf: ${parsedData.loan_reference || '-'}\nBanque: ${parsedData.bank_name || '-'}`);
  
  toast.success('Valeurs appliquées au formulaire');
};
```

---

## 3. Fichiers à créer/modifier

| Fichier | Action |
|---------|--------|
| `supabase/functions/parse-amortization-schedule/index.ts` | **Créer** - Edge Function IA |
| `supabase/config.toml` | **Modifier** - Ajouter la fonction |
| `src/components/businessplan/FinancingDialog.tsx` | **Modifier** - Ajouter zone import |
| `src/features/business-plan/dialogs/FinancingDialog.tsx` | **Modifier** - Même chose |

---

## 4. Gestion des erreurs

- **PDF illisible** : Message explicite "Le PDF n'a pas pu être analysé, veuillez saisir manuellement"
- **Taux limite IA (429)** : "Trop de requêtes, réessayez dans quelques instants"
- **Crédits épuisés (402)** : "Crédits IA épuisés"
- **Confiance faible** : Afficher un warning si `confidence_score < 0.7`

---

## 5. UX améliorée

- **Preview immédiat** : Afficher les données extraites avant application
- **Modification possible** : L'utilisateur peut corriger les valeurs après application
- **Feedback visuel** : Spinner pendant l'analyse, checkmark après succès
- **Fallback manuel** : Le formulaire reste accessible même sans import

---

## Résumé des avantages

- **Gain de temps** : Plus besoin de recopier manuellement les données
- **Réduction d'erreurs** : L'IA extrait les montants exacts
- **Format universel** : Fonctionne avec n'importe quelle banque française
- **Non bloquant** : Si l'IA échoue, la saisie manuelle reste possible
