PRAGMA foreign_keys = ON;

ALTER TABLE debit_cards
ADD COLUMN background_image TEXT NOT NULL DEFAULT 'none'
CHECK (background_image IN ('none', 'amazonia', 'praia', 'cidade', 'montanhas'));

CREATE TABLE IF NOT EXISTS vaults (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    institution TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('piggy_bank', 'box', 'savings', 'investment', 'cash')),
    balance TEXT NOT NULL,
    target_amount TEXT NULL,
    annual_yield_rate TEXT NULL,
    color TEXT NOT NULL,
    emoji TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vaults_updated_at ON vaults(updated_at DESC);
