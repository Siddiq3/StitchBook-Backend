/**
 * ============================================================================
 * DATABASE MIGRATION: Add items JSONB column to orders
 * ============================================================================
 * 
 * This migration adds a flexible items column to support multiple items per order
 * 
 * Run this migration on your PostgreSQL database:
 * - Via Supabase SQL Editor
 * - Or via Node.js script
 * 
 * ============================================================================
 */

-- Add items column as JSONB (supports flexible item structure)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]';

-- Add total_amount column for quick calculations
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;

-- Create index for JSONB queries (if needed)
CREATE INDEX IF NOT EXISTS idx_orders_items ON orders USING GIN (items);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'orders' AND column_name IN ('items', 'total_amount');
-- ============================================================================