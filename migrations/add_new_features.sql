/**
 * ============================================================================
 * TAILOR MANAGEMENT SAAS - DATABASE MIGRATION
 * Adding new features: Payments, Activity Logs, Portfolio
 * ============================================================================
 */

-- ============================================================================
-- MODIFY EXISTING TABLES - ADD NEW COLUMNS
-- ============================================================================

-- Add new columns to customers table
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10) DEFAULT 'male',
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add new columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS advance_paid NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'normal';

-- Add new columns to measurements table
ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS outfit_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS outfit_label VARCHAR(100);

-- ============================================================================
-- CREATE NEW TABLES
-- ============================================================================

-- Create payments table (new)
CREATE TABLE IF NOT EXISTS payments (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shop_id         INTEGER NOT NULL REFERENCES shops(id),
  amount          NUMERIC(10,2) NOT NULL,
  payment_method  VARCHAR(20) DEFAULT 'cash',
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by     INTEGER REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Create indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

-- Create activity_log table (new)
CREATE TABLE IF NOT EXISTS activity_log (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shop_id     INTEGER NOT NULL REFERENCES shops(id),
  user_id     INTEGER REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Create indexes for activity_log table
CREATE INDEX IF NOT EXISTS idx_activity_log_order_id ON activity_log(order_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_shop_id ON activity_log(shop_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

-- Create portfolio table (new)
CREATE TABLE IF NOT EXISTS portfolio (
  id          SERIAL PRIMARY KEY,
  shop_id     INTEGER NOT NULL REFERENCES shops(id),
  image_url   TEXT NOT NULL,
  category    VARCHAR(100),
  title       VARCHAR(200),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Create indexes for portfolio table
CREATE INDEX IF NOT EXISTS idx_portfolio_shop_id ON portfolio(shop_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_category ON portfolio(category);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- To run this migration:
-- Option A: Using psql
--   psql -U username -d tailor_app -f migrations/add_new_features.sql
--
-- Option B: Using Supabase SQL Editor
--   1. Copy all SQL above
--   2. Paste into Supabase SQL Editor
--   3. Click Execute
--
-- Option C: Via Node.js migration script
--   node run-migration.js migrations/add_new_features.sql
-- ============================================================================
