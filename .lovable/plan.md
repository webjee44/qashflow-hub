
## Refonte des regles d'automatisation de categories

### Diagnostic des 3 bugs

**Bug 1 : Transactions non classees chaque matin**
Le CRON quotidien (`apply-all-automation-rules`) ne s'execute jamais. Aucun log n'apparait pour cette fonction. Le CRON est probablement configure dans le dashboard mais la fonction n'est pas declenchee. De plus, la sync bancaire (`bridge-sync`) ne declenche pas l'application des regles apres l'insertion de nouvelles transactions.

**Bug 2 : Proposition de regles deja existantes**
Quand vous categorisez une transaction, le dialog `SuggestAutomationDialog` s'ouvre systematiquement sans verifier si une regle existe deja pour ce pattern. Il n'y a aucune verification de doublon avant de proposer la creation.

**Bug 3 : Doublons de regles entre societes et au sein d'une meme societe**
Donnees constatees en base :
- "CURIEUX LIQUIDES" : 3 regles identiques pour la meme societe (creees a quelques secondes d'intervalle)
- "FUMEUR VANNES", "PETIT VAPOTEUR" : regles dupliquees sur 2 societes differentes

Cause : aucune contrainte d'unicite en base, et aucune verification cote code avant insertion. Le dialog de suggestion ne verifie pas les regles existantes, donc chaque categorisation manuelle repropose la creation.

---

### Corrections prevues

#### 1. Contrainte d'unicite en base de donnees

Ajouter un index unique sur `automation_rules(company_id, condition_value, condition_operator, target_category_id)` avec une condition `WHERE is_active = true`. Cela empeche physiquement la creation de doublons pour une meme societe.

Avant de creer l'index, supprimer les doublons existants (garder la plus ancienne regle de chaque groupe).

#### 2. Nettoyage des doublons cross-company

Supprimer les regles qui sont des copies sur une autre societe. Les regles "FUMEUR VANNES" et "PETIT VAPOTEUR" presentes sur la societe `12ea5853` qui sont des doublons de celles de `c6ce7d8e` seront supprimees si les categories cibles sont coherentes.

#### 3. Verification anti-doublon dans `SuggestAutomationDialog`

Avant d'ouvrir le dialog de suggestion, verifier si une regle active existe deja pour ce pattern (condition_value contenu dans la description de la transaction) sur la company courante. Si oui, ne pas afficher le dialog.

Fichier : `src/components/transactions/TransactionsView.tsx`
- Dans `handleUpdateCategory`, apres avoir determine le pattern potentiel, requeter les `automation_rules` de la company pour voir si une regle `contains` matche deja cette description
- Si match trouve : ne pas ouvrir le dialog

#### 4. Verification anti-doublon dans `createRule`

Fichier : `src/hooks/useAutomationRules.ts`
- Dans `createRule`, avant l'INSERT, verifier en base s'il existe une regle avec le meme `condition_value` + `condition_operator` + `target_category_id` pour la meme `company_id`
- Si doublon detecte, afficher un toast d'avertissement et retourner sans creer

#### 5. Application automatique des regles apres la sync bancaire

Fichier : `supabase/functions/bridge-sync/index.ts`
- Apres l'insertion/mise a jour des transactions, appeler en interne la logique d'application des regles pour la company concernee
- Cela garantit que les nouvelles transactions sont classees immediatement, sans dependre du CRON

Alternative plus legere : creer un trigger SQL `AFTER INSERT ON transactions` qui applique les regles en arriere-plan. Mais cela risque d'etre lourd. On preferera l'appel direct depuis bridge-sync.

#### 6. Fiabiliser le CRON quotidien

Fichier : `supabase/functions/apply-all-automation-rules/index.ts`
- Ajouter un log en tout debut pour confirmer que la fonction demarre
- S'assurer que le CRON `pg_cron` est bien enregistre (verifier via SQL)
- Comme fallback, ajouter l'appel des regles directement dans bridge-sync (point 5) pour ne plus dependre du CRON

---

### Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| Migration SQL | Index unique, nettoyage doublons |
| `src/components/transactions/TransactionsView.tsx` | Verification anti-doublon avant ouverture du dialog |
| `src/hooks/useAutomationRules.ts` | Verification anti-doublon dans `createRule` |
| `supabase/functions/bridge-sync/index.ts` | Application des regles apres sync |
| `supabase/functions/apply-all-automation-rules/index.ts` | Logs ameliores |

### Ordre d'execution

1. Migration : nettoyage doublons + index unique
2. Code frontend : anti-doublon dialog + createRule
3. Edge function bridge-sync : appel des regles apres insertion
4. Deploiement edge functions
