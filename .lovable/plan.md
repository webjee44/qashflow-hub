

# Optimisation du Disk Space (5.99 GB)

## Diagnostic

L'analyse de la base de donnees revele un coupable massif :

| Table | Taille | Lignes | % du total |
|-------|--------|--------|------------|
| **audit_logs** | **5 571 MB** (5.4 GB) | 3 660 000 | **~93%** |
| transactions | 149 MB | 6 879 | ~2.5% |
| Tout le reste | < 10 MB | - | < 1% |

**La table `audit_logs` represente 93% de l'espace disque total.**

### Cause racine

Un trigger `audit_transactions_trigger` enregistre **chaque INSERT, UPDATE et DELETE** sur la table `transactions` dans `audit_logs`, avec les donnees completes (old_data + new_data, ~611 octets chacune).

En fevrier 2026 uniquement : **2 933 544 UPDATE** sur les transactions ont ete loggues. Cela correspond aux synchros Bridge et aux operations bulk (categorisation automatique, deduplication, etc.) qui generent des volumes enormes de logs d'audit.

### Donnees orphelines

Pas de donnees orphelines significatives detectees. Le probleme est uniquement le volume des audit logs.

## Plan d'optimisation (3 actions)

### Action 1 : Purger les anciens audit logs (gain immediat : ~5 GB)

Supprimer les audit logs de plus de 30 jours. Conserver uniquement le dernier mois pour le suivi.

```sql
DELETE FROM audit_logs 
WHERE created_at < now() - interval '30 days';
```

Puis lancer un VACUUM pour recuperer l'espace :
Nota : le VACUUM FULL necessite un acces exclusif, un simple VACUUM (sans FULL) est suffisant en premier lieu car autovacuum tourne deja.

### Action 2 : Exclure les transactions du trigger d'audit

Les transactions representent 99.8% des audit logs. Ce niveau de traçabilite n'est pas utile pour des lignes bancaires synchronisees automatiquement.

```sql
DROP TRIGGER IF EXISTS audit_transactions_trigger ON transactions;
```

Cela stoppera la croissance exponentielle. Les audits resteront actifs sur `companies`, `categories`, et `organizations` qui generent un volume negligeable.

### Action 3 : Ajouter une retention automatique (CRON)

Creer un job CRON (via pg_cron deja actif dans le projet) pour purger automatiquement les logs de plus de 90 jours :

```sql
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 3 * * 0',  -- Chaque dimanche a 3h
  $$DELETE FROM audit_logs WHERE created_at < now() - interval '90 days'$$
);
```

## Impact estime

| Action | Gain espace | Effort |
|--------|------------|--------|
| Purge 30j+ | ~4-5 GB | Migration SQL |
| Supprimer trigger transactions | Stoppe la croissance | Migration SQL |
| CRON retention 90j | Maintenance auto | Migration SQL |
| **Total** | **~5 GB recuperes** | **3 commandes SQL** |

## Section technique

Les 3 actions se font dans une seule migration SQL :

1. `DELETE FROM audit_logs WHERE created_at < now() - interval '30 days'` -- purge initiale
2. `DROP TRIGGER audit_transactions_trigger ON transactions` -- arret du logging massif
3. `SELECT cron.schedule(...)` -- retention automatique

Aucune modification de code frontend n'est necessaire. La page Parametres > Audit Logs (`AuditLogsCard.tsx`) continuera de fonctionner normalement avec les logs restants.

La table `transactions` (149 MB pour 6 879 lignes) est un peu volumineuse aussi, probablement due a des tuples morts ou du bloat. Un `VACUUM` classique devrait suffire, et l'autovacuum y passe deja regulierement.

