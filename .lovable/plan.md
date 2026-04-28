## Cause racine

Les libellés Zen First importés ont été normalisés/tronqués (`"Remise CB"`, `"Com CB"` au lieu de `"REMCB00936 NB0005 TPE749117001..."`). Résultat : 1 645 transactions perdent les identifiants TPE qui permettent aux règles d'automatisation de discriminer entre les boutiques (Saint-Brévin, Pornic, Les Sables…). La data est corrompue à la source — patcher le moteur de matching ne réglerait rien.

**Solution** : hard reset des transactions de SAS Vapeclub + re-sync complet depuis Bridge (source de vérité avec libellés bruts). Les règles existantes ré-attaqueront la data propre.

## Périmètre du reset

**Ce qui sera supprimé (SAS Vapeclub uniquement)** :
- Toutes les transactions (`transactions`) — environ 2 443 lignes
- Les snapshots de solde bancaire (`bank_balance_snapshots`)
- Les overrides de solde (`balance_overrides`)
- Les forecasts par catégorie liés à des transactions historiques ne sont **pas** touchés (ils sont prévisionnels)

**Ce qui est strictement préservé** :
- Catégories (`categories`) et leur arborescence
- Règles d'automatisation (`automation_rules` + `automation_rule_conditions`)
- Comptes bancaires Bridge (`bridge_accounts`, `company_bridge_accounts`) — connexion conservée
- Factures (`invoices`), Business Plan, settings, membres
- L'entreprise elle-même et tous ses paramètres

## Étapes d'exécution

1. **Confirmation entreprise cible**
   - Cible : SAS Vapeclub (`id = 3b65707f-aad4-4c09-a3c5-09d2a0163894`)
   - Aucune autre entreprise touchée

2. **Backup défensif** (audit_logs capture déjà les DELETE via `audit_trigger_func`, donc traçabilité automatique)

3. **Hard reset SQL** (migration data, via tool insert)
   ```sql
   DELETE FROM transactions WHERE company_id = '3b65707f-...';
   DELETE FROM bank_balance_snapshots WHERE company_id = '3b65707f-...';
   DELETE FROM balance_overrides WHERE company_id = '3b65707f-...';
   ```
   Reset des compteurs de match des règles à 0 pour avoir une stat propre :
   ```sql
   UPDATE automation_rules SET match_count = 0 WHERE company_id = '3b65707f-...';
   ```

4. **Re-sync Bridge complet**
   - Déclenchement de `bridge-sync` pour SAS Vapeclub avec un flag `full_resync: true` (paramètre déjà supporté ou à exposer si nécessaire) pour forcer la récupération de tout l'historique disponible côté Bridge (généralement 24-36 mois selon la banque).
   - Les transactions arrivent avec libellés bruts complets.

5. **Application des règles d'automatisation**
   - Trigger automatique de `apply-automation-rules` sur toutes les nouvelles transactions de SAS Vapeclub.
   - Les règles existantes (`REMISE CB 5091540010`, `REMISE CB 5882356015`, `REMISE CB 1351371016`, `COMCB`, `PRLV SEPA URSSAF`, etc.) vont matcher et catégoriser automatiquement.

6. **Rapport post-sync**
   - Nombre de transactions ré-importées
   - % catégorisées automatiquement par les règles
   - Top 20 des libellés restants non catégorisés (pour t'aider à créer les règles manquantes)

## Garde-fous

- **Périmètre strict** : `WHERE company_id = '3b65707f-...'` sur chaque DELETE — aucune autre entreprise impactée.
- **Idempotence** : la contrainte `prevent_duplicate_transaction` empêche tout doublon si un re-sync est relancé.
- **Réversibilité partielle** : `audit_logs` conserve la trace des DELETE pendant la rétention configurée.
- **Pas de touche aux règles** : elles restent intactes et seront appliquées telles quelles sur la nouvelle data.

## Limites historique Bridge

Bridge ne fournit l'historique que jusqu'à 24-36 mois selon la banque. Si la base actuelle remonte plus loin (à vérifier), les transactions pré-cette-période seront perdues définitivement. **Question importante** : veux-tu qu'on vérifie d'abord la date la plus ancienne actuellement en base avant le reset ?

## Détails techniques

- Le DELETE des transactions déclenchera `audit_trigger_func` → audit_logs grossit de ~2 443 entrées (acceptable).
- `bank_balance_snapshots` sera reconstruit automatiquement par le prochain sync.
- Les category_forecasts ne référencent pas les transactions, donc safe.
- Les `transaction_splits` (parents soft-delete) seront purgés avec leurs parents — à vérifier si présents pour Vapeclub avant exécution.
