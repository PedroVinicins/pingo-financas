PRAGMA foreign_keys = ON;

CREATE TABLE dashboard_preferences (
    id INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK (id = 1),
    layout_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE digital_wallet_items (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('ticket', 'document', 'qr_code', 'other')),
    title TEXT NOT NULL,
    issuer TEXT NOT NULL,
    notes TEXT NOT NULL,
    qr_value TEXT NULL,
    file_name TEXT NULL,
    mime_type TEXT NULL,
    file_data_url TEXT NULL,
    expires_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_digital_wallet_items_kind_date
ON digital_wallet_items(kind, updated_at DESC);

CREATE TABLE monthly_reserve_rules (
    vault_id TEXT PRIMARY KEY NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    mode TEXT NOT NULL CHECK (mode IN ('fixed', 'percentage')),
    value TEXT NOT NULL,
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
    last_processed_period TEXT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

CREATE INDEX idx_monthly_reserve_rules_due
ON monthly_reserve_rules(enabled, day_of_month);
