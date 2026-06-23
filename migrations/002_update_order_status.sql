/**
 * ============================================================================
 * DATABASE MIGRATION: Add new order status values
 * ============================================================================
 * 
 * This migration updates the order_status enum to include new statuses
 * for better order tracking: pending → in_progress → ready → delivered
 * 
 * Run this migration on your PostgreSQL database:
 * psql tailor_app < migrations/002_update_order_status.sql
 * 
 * ============================================================================
 */

-- Drop existing enum type and recreate with new values
ALTER TYPE order_status RENAME TO order_status_old;

CREATE TYPE order_status AS ENUM ('pending', 'in_progress', 'ready', 'delivered');

-- Update the orders table to use the new enum type
ALTER TABLE orders 
ALTER COLUMN status TYPE order_status USING status::text::order_status;

-- Drop the old enum type
DROP TYPE order_status_old;

-- Add index for status filtering (if not exists)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify the migration:
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status');
-- Expected: pending, in_progress, ready, delivered
-- ============================================================================