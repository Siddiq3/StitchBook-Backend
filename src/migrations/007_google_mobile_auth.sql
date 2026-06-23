-- Google + mobile authentication upgrade.
-- Keeps existing Firebase/test users working while allowing Google-only users.

ALTER TABLE users
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN firebase_uid DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'mobile',
  ADD COLUMN IF NOT EXISTS shop_id INTEGER,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar TEXT,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users (LOWER(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique
  ON users (google_id)
  WHERE google_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_provider
  ON users (auth_provider);
