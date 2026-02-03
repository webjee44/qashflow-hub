
# Plan : Isolation stricte des données par société (Treasury)

## Problème identifié

Les requêtes dans les hooks de trésorerie utilisent un filtre **inclusif** :
```typescript
query.or(`company_id.eq.${currentCompany.id},company_id.is.null`)
```

Ce filtre inclut :
1. Les données de la société actuelle ✅
2. Les données **sans** company_id (legacy ou autres) ❌

Pour une isolation stricte entre sociétés, il faut filtrer **uniquement** par `company_id`.

---

## Fichiers à corriger

### 1. `src/hooks/useTransactions.ts`
- Ligne 31-33 : Utilise `if (currentCompany?.id) q = q.eq('company_id', ...)` → OK mais doit être **obligatoire**
- **Problème** : La query s'exécute même sans company sélectionné

### 2. `src/hooks/useForecasts.ts`
Multiples requêtes utilisent `.or(...,company_id.is.null)` :
- **Ligne 115** : category_forecasts
- **Ligne 143** : transactions (actuals)
- **Ligne 190** : transactions (uncategorized)
- **Ligne 325** : invoices (payables)
- **Ligne 349** : transactions (balance)

### 3. `src/hooks/useCategories.ts`
- **Ligne 46** : `.or(company_id.eq.${companyId},company_id.is.null)`
- **Ligne 57** : Même problème avec legacy fallback

### 4. `src/hooks/useAutomationRules.ts`
- **Ligne 70** : `.or(company_id.eq.${currentCompany.id},company_id.is.null)`
- **Ligne 125** : Idem pour les catégories

---

## Corrections à appliquer

### Principe : Filtre strict `company_id = X`

```typescript
// AVANT (inclusif - problématique)
query.or(`company_id.eq.${currentCompany.id},company_id.is.null`)

// APRÈS (strict - isolation garantie)
query.eq('company_id', currentCompany.id)
```

### Liste des modifications

| Fichier | Fonction/Query | Correction |
|---------|----------------|------------|
| `useForecasts.ts` | category_forecasts | `.eq('company_id', currentCompany.id)` |
| `useForecasts.ts` | transactions (actuals) | `.eq('company_id', currentCompany.id)` |
| `useForecasts.ts` | transactions (uncategorized) | `.eq('company_id', currentCompany.id)` |
| `useForecasts.ts` | invoices (payables) | `.eq('company_id', currentCompany.id)` |
| `useForecasts.ts` | transactions (balance) | `.eq('company_id', currentCompany.id)` |
| `useCategories.ts` | fetchCategories | `.eq('company_id', companyId)` |
| `useAutomationRules.ts` | fetchRules | `.eq('company_id', currentCompany.id)` |
| `useAutomationRules.ts` | fetchCategories | `.eq('company_id', currentCompany.id)` |

---

## Détails techniques

### useForecasts.ts - 5 corrections

```typescript
// category_forecasts (ligne ~115)
const { data: forecasts = [] } = useQuery({
  queryFn: async () => {
    if (!currentCompany?.id || !startMonthStr) return [];
    
    const { data, error } = await supabase
      .from('category_forecasts')
      .select('*')
      .eq('company_id', currentCompany.id)  // ← Strict
      .gte('month', startMonthStr)
      .lte('month', endMonthStr);
    // ...
  },
  enabled: !!user?.id && !!currentCompany?.id && !!startMonthStr,
});

// transactions actuals (ligne ~143)
query = query.eq('company_id', currentCompany.id);  // ← Strict

// transactions uncategorized (ligne ~190)
query = query.eq('company_id', currentCompany.id);  // ← Strict

// invoices payables (ligne ~325)
query = query.eq('company_id', currentCompany.id);  // ← Strict

// transactions balance (ligne ~349)
query = query.eq('company_id', currentCompany.id);  // ← Strict
```

### useCategories.ts - 1 correction

```typescript
// fetchCategories (ligne ~40)
async function fetchCategories(companyId?: string | null): Promise<Category[]> {
  if (!companyId) return [];
  
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)  // ← Strict (supprime le .or avec is.null)
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}
```

### useAutomationRules.ts - 2 corrections

```typescript
// fetchRules (ligne ~70)
const { data, error } = await supabase
  .from('automation_rules')
  .select(`*, category:categories(id, name, color)`)
  .eq('company_id', currentCompany.id)  // ← Strict
  .order('created_at', { ascending: false });

// fetchCategories (ligne ~125)
const { data, error } = await supabase
  .from('categories')
  .select('*')
  .eq('company_id', currentCompany.id);  // ← Strict
```

---

## Résultat attendu

Après ces corrections, pour la société "E-fumeur internet" :

| Page | Avant | Après |
|------|-------|-------|
| /reglages-tresorerie | Catégories mélangées | Catégories isolées |
| /transactions | Transactions d'autres sociétés visibles | Uniquement E-fumeur |
| /creances | Factures mélangées | Factures isolées |
| /previsions | Prévisions/actuals mélangés | Données isolées |

Chaque société sera **100% indépendante** avec ses propres :
- Catégories
- Règles d'automatisation
- Transactions
- Factures (créances/dettes)
- Prévisions
