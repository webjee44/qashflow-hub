
-- Action 1: Purge audit logs older than 30 days
DELETE FROM audit_logs 
WHERE created_at < now() - interval '30 days';

-- Action 2: Drop the high-volume transactions audit trigger
DROP TRIGGER IF EXISTS audit_transactions_trigger ON transactions;
