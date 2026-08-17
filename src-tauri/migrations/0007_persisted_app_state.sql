PRAGMA foreign_keys = ON;

CREATE TABLE account_settings (
    id INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK (id = 1),
    opening_balance_adjustment TEXT NOT NULL DEFAULT '0.00',
    balance_hidden INTEGER NOT NULL DEFAULT 0 CHECK (balance_hidden IN (0, 1)),
    migrated_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE vault_movements (
    id TEXT PRIMARY KEY NOT NULL,
    vault_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('deposit', 'withdraw')),
    amount TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual', 'automatic')),
    occurred_at TEXT NOT NULL,
    FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

CREATE INDEX idx_vault_movements_vault_date
ON vault_movements(vault_id, occurred_at DESC);

CREATE TABLE automatic_reserve_rules (
    vault_id TEXT PRIMARY KEY NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    mode TEXT NOT NULL CHECK (mode IN ('fixed', 'percentage')),
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

CREATE TABLE recurring_rules (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    amount TEXT NOT NULL,
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    category_id TEXT NOT NULL,
    debit_card_id TEXT NULL,
    description TEXT NOT NULL,
    reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reminder_enabled IN (0, 1)),
    auto_process_after_days INTEGER NOT NULL DEFAULT 3 CHECK (auto_process_after_days BETWEEN 0 AND 31),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    last_processed_period TEXT NULL,
    next_due_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (debit_card_id) REFERENCES debit_cards(id) ON DELETE SET NULL
);

CREATE INDEX idx_recurring_rules_due
ON recurring_rules(active, next_due_date);
