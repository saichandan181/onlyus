CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  public_key TEXT,
  push_token TEXT,
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID REFERENCES users(id) UNIQUE,
  user_b UUID REFERENCES users(id) UNIQUE,
  paired_at TIMESTAMP DEFAULT NOW(),
  anniversary_date DATE
);

CREATE TABLE IF NOT EXISTS pairing_codes (
  code CHAR(6) PRIMARY KEY,
  created_by UUID REFERENCES users(id),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes'),
  used BOOLEAN DEFAULT false
);
