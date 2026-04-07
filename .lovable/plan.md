

## Diagnostic : supply@cloudvapor.com ne voit pas les transactions de Vapeflix

### Cause racine identifiee

Le probleme est **systemique** dans le modele d'autorisation, pas specifique a un bug ponctuel.

La fonction `has_company_access(_user_id, _company_id)` accorde l'acces selon 3 criteres (OR) :
1. L'utilisateur est **proprietaire** de la societe (`companies.user_id`)
2. L'utilisateur est dans **company_members** pour cette societe
3. L'utilisateur est **admin ou owner** de l'organisation parente

`supply@cloudvapor.com` (ID `0c604ad0`) est **membre simple** (`role = 'member'`) de l'organisation GROUPE TRADEFLIX. Il n'est dans `company_members` que pour 4 societes (Vapostore Lanester, Vapostore Vannes, E-fumeur Internet, Cloud Vapor). **Vapeflix n'en fait pas partie.**

Donc `has_company_access` retourne `false` pour Vapeflix, et les RLS bloquent correctement l'acces aux transactions.

### Le vrai probleme : incoherence UX vs modele de donnees

L'utilisateur voit probablement Vapeflix dans son selecteur de societes (car la query `useCompany` charge toutes les societes de l'organisation via `eq('organization_id', orgId)`), mais les RLS bloquent ensuite les donnees sous-jacentes. **L'UI montre une societe a laquelle l'utilisateur n'a en realite pas acces.**

C'est ca qui cree l'impression d'"instabilite" : l'utilisateur peut naviguer vers une societe mais ne voit rien dedans.

### Plan de correction

**Option A (rapide) : Ajouter supply dans `company_members` pour Vapeflix**
- Simple insertion SQL. Resout le cas immediat mais ne corrige pas le probleme systemique.

**Option B (propre, recommandee) : Aligner le selecteur de societes sur les droits reels**

1. **Modifier `useCompany.tsx`** : Au lieu de charger toutes les societes de l'organisation, ne charger que celles auxquelles l'utilisateur a reellement acces. Puisque les RLS sur `companies` utilisent deja `has_company_access` pour le SELECT, il suffit de s'assurer que la policy SELECT de `companies` est coherente.

   **Probleme** : la policy SELECT actuelle sur `companies` est :
   ```
   (deleted_at IS NULL) AND (user_id = auth.uid() OR EXISTS(company_members) OR EXISTS(org_members with owner/admin))
   ```
   Mais `useCompany` fait un `eq('organization_id', orgId)` sans filtre supplementaire. Si la RLS sur companies est correcte, le selecteur ne devrait deja montrer que les societes accessibles.

   **Verification necessaire** : la policy SELECT sur `companies` semble inclure aussi les simples membres via `company_members`. Donc si la RLS companies est bien appliquee, Vapeflix ne devrait PAS apparaitre pour supply... sauf si la policy est plus permissive qu'attendu.

2. **Verifier la policy SELECT de `companies`** en detail (le contexte fourni est tronque). Si elle laisse passer tous les membres de l'org (y compris `member`), alors c'est la source du decalage.

3. **Solution architecturale propre** :
   - La policy SELECT de `companies` doit etre **alignee** avec `has_company_access` : un membre simple ne voit que les societes ou il est dans `company_members`.
   - Ou bien, `has_company_access` doit etre elargi pour inclure les membres simples de l'org (mais ca ouvre l'acces a toutes les donnees de toutes les societes pour tout membre).

### Decision requise

Le choix depend de la vision produit :

- **Un membre de l'organisation doit-il voir TOUTES les societes ?** → Elargir `has_company_access` pour inclure le role `member`
- **Un membre ne doit voir que les societes auxquelles il est explicitement assigne ?** → Corriger la policy SELECT de `companies` pour ne PAS montrer les societes non assignees, et ajouter Vapeflix dans `company_members` pour supply

### Etapes d'implementation (selon la decision)

**Si on garde l'assignation explicite (recommande)** :
1. Verifier et corriger la policy SELECT de `companies` pour qu'elle ne montre aux membres simples que les societes ou ils sont dans `company_members`
2. Creer une UI dans les reglages d'organisation pour assigner les membres aux societes
3. En attendant, ajouter manuellement supply dans `company_members` pour Vapeflix

**Si on ouvre l'acces a tous les membres de l'org** :
1. Modifier `has_company_access` : ajouter un 4e critere `OR EXISTS (org_member with role = 'member')`
2. Plus simple mais moins granulaire — tout membre voit tout

### Details techniques

- Vapeflix company_id : `9ab5b1fd-ec34-4d0b-ab92-cb9c7415cc35`
- supply user_id : `0c604ad0-933e-491d-9f52-009f76033ad6`
- Organisation GROUPE TRADEFLIX : `f8604bf2-3c95-45a8-b1fe-04fb4056ae52`
- supply a `company_members` pour : Cloud Vapor, Vapostore Lanester, Vapostore Vannes, E-fumeur Internet
- supply n'a PAS `company_members` pour : Vapeflix, Coachflix, Tradeflix, Vapeclub, SAS Vapeclub, Go Holding

