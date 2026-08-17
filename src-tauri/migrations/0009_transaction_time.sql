ALTER TABLE transactions
ADD COLUMN occurred_at TEXT NULL;

CREATE INDEX idx_transactions_occurred_at
ON transactions(occurred_at DESC);
