-- Password authentication for StitchBook owners/staff.
-- Existing Google/Firebase/mobile identities remain for migration compatibility.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_password_auth
  ON users (id)
  WHERE password_hash IS NOT NULL;

COMMENT ON COLUMN users.password_hash IS 'bcrypt hash for email/mobile + password authentication';
