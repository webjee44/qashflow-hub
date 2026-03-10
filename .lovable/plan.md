

## Correctif : Badge sidebar transactions

Le badge "181" affiche le total des transactions non catégorisées **y compris les ignorées**. Il faut exclure les transactions ignorées du comptage.

### Modification

**`src/components/layout/Sidebar.tsx`** (ligne ~146) : Ajouter un filtre `.or('is_ignored.is.null,is_ignored.eq.false')` à la requête de comptage pour exclure les transactions ignorées.

```typescript
const { count, error } = await supabase
  .from('transactions')
  .select('id', { count: 'exact', head: true })
  .eq('company_id', currentCompany.id)
  .is('category_id', null)
  .is('deleted_at', null)
  .or('is_ignored.is.null,is_ignored.eq.false');  // ← ajout
```

Une seule ligne ajoutée, un seul fichier modifié.

