-- Staff access control and payroll role model.

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS can_login BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

UPDATE staff
SET access_role = CASE
  WHEN LOWER(COALESCE(role, '')) IN ('manager') THEN 'manager'
  WHEN LOWER(COALESCE(role, '')) IN ('tailor', 'designer', 'cutter', 'cutting') THEN 'cutter'
  WHEN LOWER(COALESCE(role, '')) IN ('delivery') THEN 'delivery'
  WHEN LOWER(COALESCE(role, '')) IN ('helper') THEN 'helper'
  ELSE 'stitcher'
END
WHERE access_role IS NULL;

UPDATE staff
SET can_login = true
WHERE access_role IN ('manager', 'cutter', 'delivery');

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_user_id_unique
  ON staff (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_access_role
  ON staff (access_role);

CREATE INDEX IF NOT EXISTS idx_staff_can_login
  ON staff (can_login);
