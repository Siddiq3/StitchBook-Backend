/**
 * ============================================================================
 * TAILOR MANAGEMENT SAAS - DATABASE SCHEMA (STEP 1)
 * PostgreSQL Database Schema - Production Ready
 * Supabase Compatible
 * ============================================================================
 * 
 * SETUP INSTRUCTIONS:
 * 
 * Option A: Local PostgreSQL
 * --------------------------
 * 1. Install PostgreSQL: https://www.postgresql.org/download/
 * 2. Create database:
 *    createdb tailor_app
 * 3. Connect and run this file:
 *    psql tailor_app < database.sql
 * 
 * Option B: Supabase (Cloud - RECOMMENDED for beginners)
 * -------------------------------------------------------
 * 1. Go to https://supabase.com and sign up
 * 2. Create new project
 * 3. Go to SQL Editor
 * 4. Copy all SQL below
 * 5. Paste and Execute
 * 6. Get connection string from Settings > Database
 * 
 * ============================================================================
 */

-- ============================================================================
-- CREATE ENUM TYPES (Status codes for orders and subscriptions)
-- ============================================================================

CREATE TYPE order_status AS ENUM ('pending', 'in_progress', 'ready', 'delivered');
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'expired');

-- ============================================================================
-- 1. USERS TABLE - Core user information
-- ============================================================================
-- Stores basic user data linked with Firebase authentication
-- One user = One shop owner

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comment to table
COMMENT ON TABLE users IS 'Stores user information linked with Firebase OTP authentication';
COMMENT ON COLUMN users.id IS 'Auto-generated user ID';
COMMENT ON COLUMN users.phone IS 'Unique phone number for login';
COMMENT ON COLUMN users.firebase_uid IS 'Firebase authentication token UID';

-- ============================================================================
-- 2. SHOPS TABLE - User shop information
-- ============================================================================
-- One shop per user (1:1 relationship)

CREATE TABLE shops (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(500),
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key constraint with cascade delete
  CONSTRAINT fk_shops_user_id FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE shops IS 'Stores tailor shop information (1 shop per user)';
COMMENT ON COLUMN shops.user_id IS 'Reference to user (UNIQUE - one shop per user)';

-- ============================================================================
-- 3. CUSTOMERS TABLE - Shop customers
-- ============================================================================
-- Stores customer information for each shop

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_customers_shop_id FOREIGN KEY (shop_id) 
    REFERENCES shops(id) ON DELETE CASCADE
);

COMMENT ON TABLE customers IS 'Stores customer records for each shop';
COMMENT ON COLUMN customers.notes IS 'Custom notes like preferences, sizes, etc.';

-- ============================================================================
-- 4. MEASUREMENTS TABLE - Dynamic customer measurements
-- ============================================================================
-- Stores flexible measurement data as JSON
-- Example: {"chest": "42", "waist": "36", "length": "28"}

CREATE TABLE measurements (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  measurements_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_measurements_customer_id FOREIGN KEY (customer_id) 
    REFERENCES customers(id) ON DELETE CASCADE
);

COMMENT ON TABLE measurements IS 'Stores dynamic measurement data as JSON for flexibility';
COMMENT ON COLUMN measurements.measurements_data IS 'JSON object with measurement fields (e.g., chest, waist, etc.)';

-- ============================================================================
-- 5. ORDERS TABLE - Customer orders/tailoring jobs
-- ============================================================================
-- Tracks all tailoring orders with status

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  status order_status DEFAULT 'pending',
  delivery_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) 
    REFERENCES customers(id) ON DELETE CASCADE,
  
  CONSTRAINT fk_orders_shop_id FOREIGN KEY (shop_id) 
    REFERENCES shops(id) ON DELETE CASCADE
);

COMMENT ON TABLE orders IS 'Stores tailoring orders with status tracking';
COMMENT ON COLUMN orders.status IS 'Current status: pending, stitching, or completed';
COMMENT ON COLUMN orders.delivery_date IS 'Expected delivery date for the order';

-- ============================================================================
-- 6. SUBSCRIPTIONS TABLE - User subscription info
-- ============================================================================
-- Tracks subscription plans and Razorpay payment details

CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  plan VARCHAR(50) NOT NULL,
  razorpay_subscription_id VARCHAR(255) UNIQUE,
  status subscription_status DEFAULT 'active',
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_subscriptions_user_id FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE subscriptions IS 'Stores subscription info linked with Razorpay';
COMMENT ON COLUMN subscriptions.razorpay_subscription_id IS 'Razorpay subscription ID for payment tracking';

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
-- These speed up queries on frequently searched columns

CREATE INDEX idx_shops_user_id ON shops(user_id);
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_measurements_customer_id ON measurements(customer_id);
CREATE INDEX idx_orders_shop_id ON orders(shop_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_razorpay_id ON subscriptions(razorpay_subscription_id);

-- ============================================================================
-- VERIFICATION QUERIES - Run these to verify setup
-- ============================================================================
-- Uncomment and run these to check if setup is correct:

-- SELECT table_name FROM information_schema.tables WHERE table_schema='public';
-- SELECT * FROM pg_enum;
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public';

-- ============================================================================
-- SAMPLE DATA (OPTIONAL - Only for testing)
-- ============================================================================
-- Uncomment these to populate test data:

-- INSERT INTO users (phone, firebase_uid) 
-- VALUES ('9876543210', 'firebase_uid_demo_123');

-- INSERT INTO shops (user_id, name, location, phone) 
-- VALUES (1, 'Fashion Tailor Studio', 'Mumbai, Maharashtra', '9876543210');

-- INSERT INTO customers (shop_id, name, phone, notes) 
-- VALUES (1, 'John Doe', '9123456789', 'Prefers cotton, standard measurements');

-- INSERT INTO measurements (customer_id, measurements_data) 
-- VALUES (1, '{"chest": "42", "waist": "36", "shoulder": "18", "length": "28"}');

-- INSERT INTO orders (customer_id, shop_id, description, price, status, delivery_date) 
-- VALUES (1, 1, 'Shirt stitching', 500, 'pending', '2026-04-25');

-- INSERT INTO subscriptions (user_id, plan, status, expiry_date) 
-- VALUES (1, 'premium', 'active', '2026-12-31');

-- ============================================================================
-- DATABASE STRUCTURE SUMMARY
-- ============================================================================
-- 
-- users (1) -----> (1) shops (1) -----> (many) orders
--   |                  |                  ^
--   |                  |                  |
--   +-> subscriptions  +-> customers ----+
--                          |
--                          +-> measurements
-- 
-- All relationships use CASCADE delete for data integrity
-- All tables have created_at and updated_at timestamps
-- All sensitive operations are indexed for performance
-- 
-- ============================================================================
