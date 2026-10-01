-- Apply explicitly with the migration command before deploying this revision.
CREATE TABLE IF NOT EXISTS billing_intents (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  receipt TEXT NOT NULL UNIQUE,
  provider_order_id TEXT UNIQUE,
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','PROCESSING','UNCERTAIN','READY','COMPLETE')),
  lease_until TIMESTAMPTZ,
  attempted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS billing_payment_events (
  payment_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS account_deletions (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  shop_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  phase INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_started_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (state IN ('RECEIVED','PROCESSING','PROCESSED','FAILED')),
  lease_until TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS billing_intents_user_idx ON billing_intents(user_id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_id_unique ON payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
