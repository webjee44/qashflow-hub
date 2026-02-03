-- Add parent_transaction_id to track split transactions
ALTER TABLE transactions 
ADD COLUMN parent_transaction_id UUID REFERENCES transactions(id);