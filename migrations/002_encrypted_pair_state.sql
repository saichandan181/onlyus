-- Opaque blobs only — server never decrypts (same blind pattern as chat relay payloads).

ALTER TABLE pairs ADD COLUMN IF NOT EXISTS encrypted_anniversary TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_mood TEXT;
