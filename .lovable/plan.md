

## Objectif

Ajouter une **suggestion de catégorie par IA (Gemini Flash 3.0)** dans le dialogue de catégorisation. Quand l'utilisateur ouvre le dialogue pour catégoriser une transaction, l'IA analyse le libellé et propose automatiquement la catégorie la plus pertinente parmi ses catégories existantes.

---

## Fonctionnement

1. Quand le dialogue de catégorisation s'ouvre, on envoie automatiquement :
   - Le libellé de la transaction sélectionnée
   - La liste des catégories de l'utilisateur (avec leur type income/expense)
   - Le type de transaction (encaissement/décaissement)

2. L'IA analyse et retourne :
   - La catégorie recommandée (nom exact)
   - Un niveau de confiance (0-1)

3. Le dialogue affiche la suggestion IA en premier avec un badge distinctif

---

## Architecture

```text
+---------------------------+       +-----------------------------+
| BulkCategorizeDialog.tsx  |  -->  | suggest-category (Edge Fn)  |
| (appelle la suggestion)   |       | (Gemini 3 Flash)            |
+---------------------------+       +-----------------------------+
```

---

## Modifications

### 1. Nouvelle Edge Function : `suggest-category`

**Fichier :** `supabase/functions/suggest-category/index.ts`

- Reçoit : `{ description, type, categories: [{id, name, type}] }`
- Appelle Gemini 3 Flash avec un prompt adapté
- Retourne : `{ suggestedCategoryId, categoryName, confidence }`

Prompt système :
```
Tu es un expert en catégorisation de transactions bancaires françaises.
Analyse le libellé et choisis la catégorie la plus appropriée.
Une transaction de type "expense" doit être catégorisée avec une catégorie de décaissement.
Une transaction de type "income" doit être catégorisée avec une catégorie d'encaissement.
Exemples courants :
- URSSAF → Cotisations sociales
- AMAZON → Fournitures / Achats
- NETFLIX → Abonnements
- etc.
```

### 2. Mise à jour du dialogue : `BulkCategorizeDialog.tsx`

- Ajouter un état pour la suggestion IA : `aiSuggestion`, `isLoadingAI`
- Au montage du dialogue, appeler la fonction `suggest-category`
- Afficher la suggestion IA en premier dans la section "Recommandées" avec :
  - Un badge ✨ "Suggestion IA"
  - Le niveau de confiance (ex: 85%)
- Si l'utilisateur clique dessus, elle est sélectionnée comme les autres

### 3. Configuration : `supabase/config.toml`

Ajouter :
```toml
[functions.suggest-category]
verify_jwt = false
```

---

## Détails techniques

### Edge Function `suggest-category`

```typescript
// Pseudo-code
const { description, type, categories } = await req.json();

const prompt = `
Transaction: "${description}"
Type: ${type}
Catégories disponibles (${type}): ${categories.filter(c => c.type === type).map(c => c.name).join(', ')}

Quelle catégorie correspond le mieux ? Réponds en JSON:
{"categoryName": "...", "confidence": 0.0-1.0}
`;

// Appel Gemini 3 Flash
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  }),
});
```

### Frontend - Appel de la suggestion

```typescript
// Dans BulkCategorizeDialog.tsx
const [aiSuggestion, setAiSuggestion] = useState<{
  categoryId: string;
  categoryName: string;
  confidence: number;
} | null>(null);
const [isLoadingAI, setIsLoadingAI] = useState(false);

useEffect(() => {
  if (!open || selectedTransactions.length === 0) return;
  
  const fetchSuggestion = async () => {
    setIsLoadingAI(true);
    try {
      const tx = selectedTransactions[0];
      const { data } = await supabase.functions.invoke('suggest-category', {
        body: {
          description: tx.description,
          type: tx.type,
          categories: categories.map(c => ({ id: c.id, name: c.name, type: c.type })),
        },
      });
      if (data?.categoryId) {
        setAiSuggestion(data);
      }
    } catch (e) {
      console.error('AI suggestion error:', e);
    } finally {
      setIsLoadingAI(false);
    }
  };
  
  fetchSuggestion();
}, [open, selectedTransactions, categories]);
```

### UI - Affichage de la suggestion

Dans la section "Recommandées", ajouter en premier :

```tsx
{isLoadingAI && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="w-4 h-4 animate-spin" />
    Analyse IA en cours...
  </div>
)}

{aiSuggestion && (
  <Button
    variant={selectedCategoryId === aiSuggestion.categoryId ? 'default' : 'outline'}
    className="col-span-2 justify-between border-accent"
    onClick={() => setSelectedCategoryId(aiSuggestion.categoryId)}
  >
    <div className="flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-accent" />
      <span>{aiSuggestion.categoryName}</span>
    </div>
    <span className="text-xs opacity-70">{Math.round(aiSuggestion.confidence * 100)}%</span>
  </Button>
)}
```

---

## Résumé des fichiers à modifier

| Fichier | Action |
|---------|--------|
| `supabase/functions/suggest-category/index.ts` | Créer |
| `supabase/config.toml` | Ajouter config |
| `src/components/transactions/BulkCategorizeDialog.tsx` | Modifier |

