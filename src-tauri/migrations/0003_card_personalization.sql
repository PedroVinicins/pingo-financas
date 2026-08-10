PRAGMA foreign_keys = ON;

ALTER TABLE debit_cards ADD COLUMN pattern TEXT NOT NULL DEFAULT 'soft';
ALTER TABLE debit_cards ADD COLUMN emoji TEXT NULL;
