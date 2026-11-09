ALTER TABLE transactions
ADD COLUMN classification TEXT NOT NULL DEFAULT 'expense'
CHECK (classification IN ('income', 'expense', 'refund', 'transfer'));

UPDATE transactions
SET classification = kind;

ALTER TABLE transactions
ADD COLUMN related_transaction_id TEXT NULL;

ALTER TABLE transactions
ADD COLUMN source_bank TEXT NULL
CHECK (source_bank IS NULL OR source_bank IN ('inter', 'nubank'));

ALTER TABLE transactions
ADD COLUMN external_id TEXT NULL;

CREATE INDEX idx_transactions_related_transaction
ON transactions(related_transaction_id);

CREATE UNIQUE INDEX idx_transactions_source_external_id
ON transactions(source_bank, lower(external_id))
WHERE source_bank IS NOT NULL AND external_id IS NOT NULL;
