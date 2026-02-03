
# Plan : Mapping automatique Partenaire → Catégorie pour les factures

## Objectif
Créer un système de mapping simple où l'utilisateur définit une association **partenaire = catégorie** qui s'applique automatiquement à toutes les factures importées (Odoo/Pennylane) et futures.

## Principe de fonctionnement
1. Quand l'utilisateur sélectionne une catégorie pour une facture avec un partenaire donné → un mapping est créé/mis à jour
2. Lors des prochaines synchros ou pour les factures existantes avec ce partenaire → la catégorie est appliquée automatiquement
3. Pas d'IA, pas de modal complexe : juste un mapping direct `partner_name` → `category_id`

---

## Étapes d'implémentation

### 1. Créer la table `partner_category_mappings`

```sql
CREATE TABLE public.partner_category_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  partner_name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, partner_name)
);

-- RLS policies similaires aux autres tables
ALTER TABLE partner_category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible mappings" ON partner_category_mappings
  FOR SELECT USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can create accessible mappings" ON partner_category_mappings
  FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible mappings" ON partner_category_mappings
  FOR UPDATE USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible mappings" ON partner_category_mappings
  FOR DELETE USING (has_company_access(auth.uid(), company_id));
```

### 2. Modifier `useInvoices.ts` pour gérer le mapping

Quand l'utilisateur change la catégorie d'une facture :
1. Mettre à jour la facture (comme actuellement)
2. Créer/mettre à jour le mapping `partner_name → category_id`
3. Appliquer automatiquement aux autres factures du même partenaire non catégorisées

```typescript
// Dans updateCategoryMutation
const updateCategoryMutation = useMutation({
  mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
    // 1. Récupérer la facture pour avoir le partner_name
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) throw new Error('Invoice not found');
    
    // 2. Mettre à jour la facture
    await supabase
      .from('invoices')
      .update({ category_id: categoryId })
      .eq('id', id);

    // 3. Upsert le mapping partenaire → catégorie
    if (categoryId) {
      await supabase
        .from('partner_category_mappings')
        .upsert({
          company_id: currentCompany.id,
          user_id: currentCompany.user_id,
          partner_name: invoice.partner_name,
          category_id: categoryId,
        }, { onConflict: 'company_id,partner_name' });
      
      // 4. Appliquer aux autres factures du même partenaire (sans catégorie)
      await supabase
        .from('invoices')
        .update({ category_id: categoryId })
        .eq('company_id', currentCompany.id)
        .eq('partner_name', invoice.partner_name)
        .is('category_id', null);
    } else {
      // Supprimer le mapping si on retire la catégorie
      await supabase
        .from('partner_category_mappings')
        .delete()
        .eq('company_id', currentCompany.id)
        .eq('partner_name', invoice.partner_name);
    }
  }
});
```

### 3. Modifier l'edge function `accounting-connector-sync`

Dans la fonction `upsertInvoice`, avant d'insérer une nouvelle facture :
1. Chercher un mapping existant pour ce `partner_name`
2. Si trouvé, ajouter le `category_id` automatiquement

```typescript
async function upsertInvoice(supabase, invoice, result) {
  // Chercher un mapping partenaire → catégorie
  let categoryId = null;
  const { data: mapping } = await supabase
    .from('partner_category_mappings')
    .select('category_id')
    .eq('company_id', invoice.company_id)
    .eq('partner_name', invoice.partner_name)
    .maybeSingle();
  
  if (mapping) {
    categoryId = mapping.category_id;
  }

  // Lors de l'insert, ajouter category_id
  if (!existing) {
    await supabase.from("invoices").insert({
      ...invoice,
      category_id: categoryId  // ← Ajout automatique
    });
  }
}
```

---

## Récapitulatif UX

| Action utilisateur | Comportement |
|---|---|
| Sélectionne une catégorie pour "AMAZON" | Mapping créé + toutes les factures "AMAZON" catégorisées |
| Prochaine synchro Odoo avec "AMAZON" | Catégorie appliquée automatiquement |
| Retire la catégorie d'une facture "AMAZON" | Mapping supprimé (ne touche pas aux factures déjà catégorisées) |

---

## Fichiers à modifier

1. **Migration SQL** : Créer la table `partner_category_mappings`
2. **`src/hooks/useInvoices.ts`** : Gérer le mapping lors du changement de catégorie
3. **`supabase/functions/accounting-connector-sync/index.ts`** : Appliquer le mapping lors de la synchro

---

## Avantages de cette approche

- **Simple** : Pas de modal, pas d'IA - un clic suffit
- **Transparent** : L'utilisateur catégorise une fois, le système mémorise
- **Continu** : S'applique automatiquement aux nouvelles factures importées
- **Réversible** : Retirer la catégorie supprime le mapping
