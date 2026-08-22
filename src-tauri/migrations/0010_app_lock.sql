CREATE TABLE app_lock_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    pin_hash TEXT NOT NULL,
    biometric_enabled INTEGER NOT NULL DEFAULT 0 CHECK (biometric_enabled IN (0, 1)),
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    locked_until TEXT,
    updated_at TEXT NOT NULL
);
