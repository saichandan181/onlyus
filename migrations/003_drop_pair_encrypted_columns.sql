-- Anniversary & mood: relay-only (no PostgreSQL). Safe if columns were never added.
ALTER TABLE pairs DROP COLUMN IF EXISTS encrypted_anniversary;
ALTER TABLE users DROP COLUMN IF EXISTS encrypted_mood;
