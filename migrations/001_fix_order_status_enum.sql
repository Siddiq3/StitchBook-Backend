/**
 * MIGRATION: Fix order_status enum from 3-value to 4-value
 * 
 * ISSUE: Database enum was: ('pending', 'stitching', 'completed')
 * SHOULD BE: ('pending', 'in_progress', 'ready', 'delivered')
 * 
 * This migration:
 * 1. Creates a new enum with correct values
 * 2. Converts existing data:
 *    - 'pending' → 'pending' (no change)
 *    - 'stitching' → 'in_progress' (migration)
 *    - 'completed' → 'delivered' (migration)
 * 3. Drops the old enum
 * 
 * HOW TO RUN:
 * 
 * For Supabase: 
 * 1. Go to SQL Editor
 * 2. Copy and paste this entire file
 * 3. Click "Run"
 * 
 * For Local PostgreSQL:
 * psql tailor_app < migrations/001_fix_order_status_enum.sql
 */

-- Step 1: Create new enum with all 4 values
CREATE TYPE order_status_new AS ENUM ('pending', 'in_progress', 'ready', 'delivered');

-- Step 2: Add a temporary column with the new type
ALTER TABLE orders ADD COLUMN status_new order_status_new;

-- Step 3: Migrate data with value mapping
UPDATE orders 
SET status_new = CASE 
  WHEN status::text = 'pending' THEN 'pending'::order_status_new
  WHEN status::text = 'stitching' THEN 'in_progress'::order_status_new
  WHEN status::text = 'completed' THEN 'delivered'::order_status_new
END;

-- Step 4: Drop the old column
ALTER TABLE orders DROP COLUMN status;

-- Step 5: Rename new column to original name
ALTER TABLE orders RENAME COLUMN status_new TO status;

-- Step 6: Drop the old enum
DROP TYPE order_status;

-- Step 7: Rename new enum to original name
ALTER TYPE order_status_new RENAME TO order_status;

-- Confirmation
SELECT 'Migration completed successfully! Order statuses migrated:' as status_message;
SELECT DISTINCT status FROM orders ORDER BY status;
