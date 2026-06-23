-- =====================================================
-- BACKEND DATABASE MIGRATION 005
-- Assign default shop_id to existing users and ensure future users get a fallback shop_id.
-- =====================================================

-- Add shop_id column if it does not exist yet.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS shop_id INTEGER;

-- Populate missing shop_id values for existing users who already have a shop record.
UPDATE users u
SET shop_id = s.id
FROM shops s
WHERE u.shop_id IS NULL AND s.user_id = u.id;

-- NOTE: Do not force shop_id NOT NULL if users can still sign up without a shop record.
-- If you want to assign a default shop for existing users, run the optional SQL below.

-- Optional: create default shops for users who have no shop record yet.
-- INSERT INTO shops (user_id, name, phone, created_at, updated_at)
-- SELECT u.id, 'Default Shop for user ' || u.id, u.phone, NOW(), NOW()
-- FROM users u
-- LEFT JOIN shops s ON s.user_id = u.id
-- WHERE u.shop_id IS NULL AND s.id IS NULL;

-- Optional: after creating default shops, update those users:
-- UPDATE users u
-- SET shop_id = s.id
-- FROM shops s
-- WHERE u.shop_id IS NULL AND s.user_id = u.id;

-- Add index for shop_id lookup.
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id);
