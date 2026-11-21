-- The user service owns accounts and profiles. Other services store a user's id, never their profile.
-- This file runs on every start and is safe to repeat: it creates what is missing and upgrades an
-- older users table (one "name" column) to first_name / last_name.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Basic Information and Language & Timezone tabs (all optional except language and timezone)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name    TEXT,
  ADD COLUMN IF NOT EXISTS last_name     TEXT,
  ADD COLUMN IF NOT EXISTS gender        TEXT
    CHECK (gender IN ('MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY')),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS phone         TEXT,
  ADD COLUMN IF NOT EXISTS country       TEXT,
  ADD COLUMN IF NOT EXISTS language      TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS timezone      TEXT NOT NULL DEFAULT 'America/Los_Angeles';

-- Upgrade: split the old single "name" column ("Alice Chen" -> "Alice" + "Chen"), then drop it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name') THEN
    UPDATE users SET
      first_name = CASE WHEN name ~ '\s' THEN regexp_replace(btrim(name), '\s+\S+$', '') ELSE btrim(name) END,
      last_name  = CASE WHEN name ~ '\s' THEN substring(btrim(name) FROM '\S+$') ELSE '' END
    WHERE first_name IS NULL;
    ALTER TABLE users DROP COLUMN name;
  END IF;
END $$;

ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
UPDATE users SET last_name = '' WHERE last_name IS NULL;
ALTER TABLE users ALTER COLUMN last_name SET NOT NULL, ALTER COLUMN last_name SET DEFAULT '';

-- Travel Preferences tab. One row per user, created the first time they save preferences.
CREATE TABLE IF NOT EXISTS travel_preferences (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  budget_level  TEXT CHECK (budget_level IN ('BUDGET', 'MODERATE', 'LUXURY')),
  travel_styles TEXT[] NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
