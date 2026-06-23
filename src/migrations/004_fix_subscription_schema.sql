-- =====================================================
-- STITCHPRO BACKEND - DATABASE MIGRATION 004
-- Fix subscriptions table schema to match model expectations
-- Rename columns and add missing ones
-- =====================================================

-- Rename columns to match model expectations (only if they exist with old names)
DO $$
BEGIN
    -- Rename 'plan' to 'plan_type' if 'plan' exists and 'plan_type' doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'subscriptions' AND column_name = 'plan')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'subscriptions' AND column_name = 'plan_type') THEN
        ALTER TABLE subscriptions RENAME COLUMN plan TO plan_type;
    END IF;

    -- Rename 'expiry_date' to 'end_date' if 'expiry_date' exists and 'end_date' doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'subscriptions' AND column_name = 'expiry_date')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'subscriptions' AND column_name = 'end_date') THEN
        ALTER TABLE subscriptions RENAME COLUMN expiry_date TO end_date;
    END IF;
END $$;

-- Add missing columns (only if they don't exist)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS shop_id INTEGER,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id ON subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_start_date ON subscriptions(start_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active);