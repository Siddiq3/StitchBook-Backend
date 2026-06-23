-- =====================================================
-- STITCHPRO BACKEND - DATABASE MIGRATION 003
-- Update subscriptions table for Razorpay integration
-- Add: razorpay_payment_id, razorpay_order_id, end_date
-- =====================================================

-- Add new columns to subscriptions table
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_payment_id ON subscriptions(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_order_id ON subscriptions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);