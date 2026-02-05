

# Plan : Sections pliables sur la page P&L

## Objectif
Réduire le scroll en rendant les sections "Ratios financiers" et "Seuil de rentabilité" pliables, tout en gardant les KPIs principaux toujours visibles.

## Approche retenue

### Option choisie : Accordéon pour les graphiques/analyses

Les 4 cartes KPI en haut restent fixes (informations essentielles), mais les sections d'analyse (Ratios + Break-even) seront regroupées dans un accordéon pliable.

```text
+--------------------------------------------------+
| Header + 4 KPI cards (toujours visible)          |
+--------------------------------------------------+
| [▼] Analyse détaillée - Année 1       [Déplier]  |
|   ┌─────────────────┐  ┌─────────────────┐       |
|   │ Ratios          │  │ Break-even      │       |
|   └─────────────────┘  └─────────────────┘       |
+--------------------------------------------------+
| P&L Tableau (toujours visible)                   |
+--------------------------------------------------+
```

### Alternative envisagée mais non retenue
Mettre le tableau P&L lui-même dans un accordéon. Non retenue car c'est l'élément principal de la page.

## Modifications

### 1. ProfitLoss.tsx - Wrapper accordéon pour les analyses

Encapsuler les sections Ratios + BreakEven dans un `Collapsible` :

- Import de `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
- Ajouter un état `analysisOpen` (défaut: `true`)
- Wrapper les deux cartes avec le collapsible
- Header cliquable avec icône chevron animée

### 2. Style du header collapsible

- Fond léger `bg-muted/30`
- Bordure arrondie
- Animation de transition pour le chevron
- Label dynamique : "Masquer l'analyse" / "Afficher l'analyse"

## Code prévu

```tsx
// Dans ProfitLoss.tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

// État
const [analysisOpen, setAnalysisOpen] = useState(true);

// JSX
<Collapsible open={analysisOpen} onOpenChange={setAnalysisOpen}>
  <CollapsibleTrigger asChild>
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="font-medium">Analyse détaillée - Année {selectedYear + 1}</span>
      </div>
      <ChevronDown className={cn(
        "h-4 w-4 transition-transform",
        analysisOpen && "rotate-180"
      )} />
    </div>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="grid gap-6 lg:grid-cols-2 mt-4">
      <RatiosCard yearIndex={selectedYear} />
      <BreakEvenChart yearIndex={selectedYear} />
    </div>
  </CollapsibleContent>
</Collapsible>
```

## Avantages

1. Les KPIs principaux restent toujours visibles (info essentielle)
2. Un clic = ~400px de scroll économisés
3. Le sélecteur d'année reste accessible (utile pour le tableau)
4. Animation fluide avec les classes existantes

## Détails techniques

- Composant utilisé : `@/components/ui/collapsible` (déjà présent)
- Animation : utilise `animate-accordion-down/up` déjà configuré
- État par défaut : ouvert (l'utilisateur peut replier si besoin)

