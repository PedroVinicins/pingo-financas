PRAGMA foreign_keys = ON;

-- A versão anterior tinha UNIQUE apenas no nome, enquanto o domínio separa
-- categorias de entrada e despesa. Reconstruir as tabelas mantém os dados e
-- passa a aplicar a mesma regra em todos os runtimes.
ALTER TABLE transactions RENAME TO transactions_v06;
ALTER TABLE categories RENAME TO categories_v06;

CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    name TEXT NOT NULL COLLATE NOCASE,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (kind, name)
);

CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    amount TEXT NOT NULL,
    date TEXT NOT NULL,
    category_id TEXT NULL,
    debit_card_id TEXT NULL,
    description TEXT NOT NULL,
    recurrence TEXT NOT NULL CHECK (recurrence IN ('fixed', 'variable')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (debit_card_id) REFERENCES debit_cards(id) ON DELETE SET NULL
);

INSERT INTO categories (id, kind, name, icon, color, created_at)
SELECT id, kind, name, icon, color, created_at FROM categories_v06;

INSERT INTO transactions
    (id, kind, amount, date, category_id, debit_card_id, description, recurrence, created_at)
SELECT id, kind, amount, date, category_id, debit_card_id, description, recurrence, created_at
FROM transactions_v06;

DROP TABLE transactions_v06;
DROP TABLE categories_v06;

CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_kind ON transactions(kind);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_debit_card ON transactions(debit_card_id);
