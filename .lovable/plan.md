
# Plan : Ajouter une barre de recherche sur la page Créances & Dettes

## Objectif

Ajouter une barre de recherche permettant de filtrer les factures par nom de partenaire ou numéro de facture, afin de faciliter la navigation dans la liste des créances et dettes.

---

## Modification du fichier `src/pages/Invoices.tsx`

### 1. Ajouts

- Importer l'icône `Search` depuis `lucide-react`
- Importer le composant `Input` depuis `@/components/ui/input`
- Ajouter un state `searchQuery` pour stocker la valeur de recherche
- Intégrer la barre de recherche dans la zone des filtres

### 2. Logique de filtrage

La recherche s'appliquera sur :
- `partner_name` : nom du partenaire (client ou fournisseur)
- `invoice_number` : numéro de facture

Recherche insensible à la casse (lowercase comparison).

### 3. Position dans l'interface

```text
[Tabs: Toutes | Créances | Dettes]     [🔍 Rechercher...] [Filtre statut ▼]
```

La barre de recherche sera placée entre les tabs et le filtre de statut, alignée à droite avec le filtre.

### 4. Code à ajouter

**Nouveau state :**
```typescript
const [searchQuery, setSearchQuery] = useState('');
```

**Mise à jour du filtrage :**
```typescript
const filteredInvoices = useMemo(() => {
  return invoices.filter(invoice => {
    // Filtre par type
    if (tabFilter !== 'all' && invoice.type !== tabFilter) return false;
    // Filtre par statut
    if (statusFilter !== 'all' && invoice.status !== statusFilter) return false;
    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesPartner = invoice.partner_name.toLowerCase().includes(query);
      const matchesNumber = invoice.invoice_number?.toLowerCase().includes(query);
      if (!matchesPartner && !matchesNumber) return false;
    }
    return true;
  });
}, [invoices, tabFilter, statusFilter, searchQuery]);
```

**UI - Barre de recherche :**
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Rechercher..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-9 w-[200px]"
  />
</div>
```

---

## Fichier à modifier

| Fichier | Action |
|---------|--------|
| `src/pages/Invoices.tsx` | Ajouter state, input, et logique de filtrage |

---

## Résultat attendu

- Une barre de recherche avec icône loupe
- Filtrage instantané sur le nom du partenaire et le numéro de facture
- Combinable avec les filtres de type et de statut existants
