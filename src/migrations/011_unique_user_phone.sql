-- Keep one StitchBook account per verified mobile number.
-- This assumes existing duplicate phone data has been cleaned before running in production.

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
  ON users (phone)
  WHERE phone IS NOT NULL;
