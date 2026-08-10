PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    amount TEXT NOT NULL,
    date TEXT NOT NULL,
    category_id TEXT NULL,
    description TEXT NOT NULL,
    recurrence TEXT NOT NULL CHECK (recurrence IN ('fixed', 'variable')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_kind ON transactions(kind);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

INSERT OR IGNORE INTO categories (id, name, icon, color, created_at) VALUES
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42801', 'Casa', 'house', '#0F766E', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42802', 'Alimentação', 'utensils', '#EA580C', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42803', 'Transporte', 'bus', '#2563EB', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42804', 'Lazer', 'gamepad-2', '#7C3AED', CURRENT_TIMESTAMP);
