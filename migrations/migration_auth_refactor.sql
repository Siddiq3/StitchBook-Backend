/**
 * ============================================================================
 * DATABASE MIGRATION - Update Users Table for New Authentication System
 * ============================================================================
 *
 * This migration updates the users table to support:
 * - Phone number as unique identifier (primary identity)
 * - Optional name field
 * - Shop association (shop_id)
 * - Authentication provider tracking (for future multi-provider support)
 *
 * USAGE:
 * 1. If you have existing data, backup your database first
 * 2. Run in PostgreSQL (Supabase SQL Editor or local psql):
 *    psql tailor_app < migration_add_auth_fields.sql
 * 3. Or copy-paste into Supabase SQL Editor and execute
 *
 * ============================================================================
 */

-- ============================================================================
-- ALTER users TABLE TO ADD NEW COLUMNS
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'firebase';

-- Add shop_id column (can be null initially)
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_id INTEGER;

-- Add foreign key constraint for shop_id if not already exists
ALTER TABLE users ADD CONSTRAINT fk_users_shop_id 
FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL;

-- ============================================================================
-- UPDATE EXISTING DATA
-- ============================================================================

-- Set default auth_provider to 'firebase' for existing users
UPDATE users SET auth_provider = 'firebase' WHERE auth_provider IS NULL;

-- ============================================================================
-- ADD INDEX FOR PHONE LOOKUP (Performance optimization)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id);

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON COLUMN users.name IS 'Optional user display name';
COMMENT ON COLUMN users.auth_provider IS 'Authentication provider (firebase, whatsapp, etc.)';
COMMENT ON COLUMN users.shop_id IS 'Reference to user shop (can be null)';

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the migration)
-- ============================================================================

/*
-- Check table structure
\d users

-- Check indexes
\di users*

-- Check a few records
SELECT id, phone, name, auth_provider, shop_id FROM users LIMIT 5;

-- Check if foreign key exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name='users' AND constraint_type='FOREIGN KEY';
*/
