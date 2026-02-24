

# Garde de type : empecher l'assignation de categories incoherentes

## Probleme confirme

La regle d'automatisation `description contains "VIR"` cible la categorie "Ventes" (income). Le mot "VIR" apparait dans tous les virements, y compris les sortants (depenses comme "Vir Atom Snc Cv Loyer"). Le systeme applique donc une categorie income a des transactions expense.

Transactions affectees confirmees en base :
- "Vir Atom Snc Cv Loyer Janv Fevrier" (7030.20 EUR, type=expense) → categorie "Ventes" (income)
- "Vir Remise" (12288.96 EUR, type=expense) → categorie "Ventes" (income)  
- "Vir Inst Virement Interne" (10000.00 EUR, type=expense) → categorie "Ventes" (income)
- "Frais Remise Vir Sct" (0.44 EUR, type=expense) → categorie "Ventes" (income)

## Solution

Ajouter une **garde de type** dans les 3 fonctions de categorisation : une categorie ne peut etre assignee que si son type (income/expense) correspond au type de la transaction.

### 1. `supabase/functions/apply-automation-rule/index.ts`

- Apres avoir charge la regle (ligne 153), faire une requete pour recuperer le `type` de la categorie cible
- Dans la fonction `matchesRule`, ajouter une verification : si `transaction.type !== targetCategoryType`, retourner `false`
- Concretement : ajouter un champ `target_category_type` dans l'interface `FullRule` et le peupler

### 2. `supabase/functions/apply-all-automation-rules/index.ts`

- Lors du chargement des regles (ligne 128), joindre la table `categories` pour recuperer le type de chaque categorie cible
- Ajouter `target_category_type` dans l'interface `FullRule`
- Dans le filtre de matching (ligne 206-209), ajouter la condition : `if (rule.target_category_type && tx.type !== rule.target_category_type) return false`

### 3. `supabase/functions/categorize-transaction/index.ts`

- Apres le parsing de la reponse IA (ligne 203), ajouter une validation post-IA
- Avant d'appliquer la mise a jour, verifier que `category.type` correspond a `transaction.type`
- Si incoherent, ignorer la suggestion et logger un warning

### 4. Nettoyage des donnees existantes

- Executer une requete SQL pour retirer les categories income des transactions expense (et vice versa) : remettre `category_id = NULL` sur les transactions mal categorisees
- Cela concerne environ 10-20 transactions identifiees

---

## Section technique

Logique de garde (identique dans les 3 fonctions) :

```text
transaction.type === 'expense' → categorie cible doit etre type 'expense'
transaction.type === 'income' → categorie cible doit etre type 'income'
Si incoherent → skip (ne pas appliquer)
```

La requete de nettoyage SQL :

```text
UPDATE transactions SET category_id = NULL
WHERE type = 'expense'
AND category_id IN (SELECT id FROM categories WHERE type = 'income')
```

Fichiers modifies :
- `supabase/functions/apply-automation-rule/index.ts`
- `supabase/functions/apply-all-automation-rules/index.ts`
- `supabase/functions/categorize-transaction/index.ts`

Aucune migration de schema necessaire. Les fonctions seront redeployees automatiquement.

