PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS debit_cards (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    issuer TEXT NOT NULL,
    holder_name TEXT NOT NULL,
    last_four TEXT NOT NULL CHECK (length(last_four) = 4),
    network TEXT NOT NULL CHECK (network IN ('visa', 'mastercard', 'elo', 'other')),
    color_from TEXT NOT NULL,
    color_to TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    is_frozen INTEGER NOT NULL DEFAULT 0 CHECK (is_frozen IN (0, 1)),
    monthly_spending_limit TEXT NULL,
    created_at TEXT NOT NULL
);

ALTER TABLE transactions
ADD COLUMN debit_card_id TEXT NULL REFERENCES debit_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_debit_card ON transactions(debit_card_id);
CREATE INDEX IF NOT EXISTS idx_debit_cards_default ON debit_cards(is_default);
