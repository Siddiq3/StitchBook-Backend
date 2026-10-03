-- StitchBook production baseline.
-- This is the only migration required for a fresh pre-launch database.

CREATE TYPE order_status AS ENUM (
  'pending',
  'in_progress',
  'cutting',
  'stitching',
  'ready',
  'delivered'
);

CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'expired');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20),
  email VARCHAR(255),
  name VARCHAR(255),
  firebase_uid VARCHAR(255),
  google_id VARCHAR(255),
  avatar TEXT,
  auth_provider VARCHAR(50) NOT NULL DEFAULT 'mobile',
  shop_id INTEGER,
  password_hash VARCHAR(255),
  trial_start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 days'),
  plan TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  subscription_start_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  deletion_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX idx_users_email_unique ON users(LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_users_firebase_uid_unique ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;
CREATE UNIQUE INDEX idx_users_google_id_unique ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_shop_id ON users(shop_id);
CREATE INDEX idx_users_auth_provider ON users(auth_provider);

CREATE TABLE shops (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(500),
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD CONSTRAINT fk_users_shop_id
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL;

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  notes TEXT,
  gender VARCHAR(10) DEFAULT 'male',
  email VARCHAR(255),
  date_of_birth DATE,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_shop_created ON customers(shop_id, created_at DESC);
CREATE INDEX idx_customers_shop_phone ON customers(shop_id, phone);
CREATE INDEX idx_customers_email ON customers(email);

CREATE TABLE measurements (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  measurements_data JSONB NOT NULL,
  outfit_type VARCHAR(50),
  outfit_label VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_measurements_customer_created ON measurements(customer_id, created_at DESC);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  price NUMERIC(10,2),
  status order_status NOT NULL DEFAULT 'pending',
  delivery_date DATE,
  description TEXT NOT NULL DEFAULT '',
  advance_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'normal',
  measurement_id INTEGER REFERENCES measurements(id) ON DELETE SET NULL,
  measurement_snapshot JSONB,
  order_type VARCHAR(50) NOT NULL DEFAULT 'stitching'
    CHECK (order_type IN ('stitching', 'alteration')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_shop_created ON orders(shop_id, created_at DESC);
CREATE INDEX idx_orders_shop_status ON orders(shop_id, status);
CREATE INDEX idx_orders_shop_delivery ON orders(shop_id, delivery_date);
CREATE INDEX idx_orders_shop_type_created ON orders(shop_id, order_type, created_at DESC);
CREATE INDEX idx_orders_customer_created ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_measurement_id ON orders(measurement_id);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  provider_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_shop_date ON payments(shop_id, payment_date DESC);
CREATE UNIQUE INDEX payments_provider_id_unique
  ON payments(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_order_created ON activity_log(order_id, created_at DESC);
CREATE INDEX idx_activity_shop_created ON activity_log(shop_id, created_at DESC);

CREATE TABLE portfolio (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  category VARCHAR(100),
  title VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolio_shop_created ON portfolio(shop_id, created_at DESC);
CREATE INDEX idx_portfolio_shop_category ON portfolio(shop_id, category);

CREATE TABLE staff (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'tailor',
  salary NUMERIC(10,2),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  payment_type VARCHAR(20) NOT NULL DEFAULT 'monthly'
    CHECK (payment_type IN ('monthly', 'daily', 'per_piece', 'commission')),
  pay_rate NUMERIC(10,2),
  aadhar_number VARCHAR(20),
  address TEXT,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_date DATE,
  can_login BOOLEAN NOT NULL DEFAULT FALSE,
  access_role VARCHAR(50),
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_staff_phone_unique ON staff(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX idx_staff_email_unique ON staff(LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_staff_user_id_unique ON staff(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_staff_shop_active ON staff(shop_id, is_active);
CREATE INDEX idx_staff_access_role ON staff(access_role);
CREATE INDEX idx_staff_can_login ON staff(can_login);

CREATE TABLE staff_work_logs (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  order_number VARCHAR(50),
  item_name VARCHAR(255) NOT NULL,
  item_type VARCHAR(100),
  item_price NUMERIC(10,2),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rate NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('assigned', 'completed', 'approved', 'paid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_work_logs_shop_date ON staff_work_logs(shop_id, work_date DESC);
CREATE INDEX idx_staff_work_logs_staff_date ON staff_work_logs(staff_id, work_date DESC);
CREATE INDEX idx_staff_work_logs_order_id ON staff_work_logs(order_id);
CREATE INDEX idx_staff_work_logs_status ON staff_work_logs(status);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'general',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_shop_created ON notifications(shop_id, created_at DESC);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_shop_unread ON notifications(shop_id, is_read);

CREATE TABLE gallery (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  title VARCHAR(255),
  description TEXT,
  image_url TEXT NOT NULL,
  category VARCHAR(100),
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gallery_shop_order ON gallery(shop_id, order_index, created_at DESC);
CREATE INDEX idx_gallery_shop_category ON gallery(shop_id, category);
CREATE INDEX idx_gallery_shop_active ON gallery(shop_id, is_active);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50),
  notes TEXT,
  items JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_shop_date ON invoices(shop_id, invoice_date DESC);
CREATE INDEX idx_invoices_order_id ON invoices(order_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_shop_status ON invoices(shop_id, status);

CREATE TABLE push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  device_type VARCHAR(50) NOT NULL DEFAULT 'android',
  device_id VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_tokens_user_active ON push_tokens(user_id, is_active);
CREATE INDEX idx_push_tokens_token ON push_tokens(token);

CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  provider_subscription_id VARCHAR(255),
  provider_payment_id VARCHAR(100),
  provider_order_id VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_created ON subscriptions(user_id, created_at DESC);
CREATE INDEX idx_subscriptions_end_date ON subscriptions(end_date);
CREATE UNIQUE INDEX idx_subscriptions_shop_id_unique
  ON subscriptions(shop_id)
  WHERE shop_id IS NOT NULL;
CREATE UNIQUE INDEX subscriptions_provider_payment_unique
  ON subscriptions(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX subscriptions_provider_order_unique
  ON subscriptions(provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE TABLE billing_intents (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  receipt TEXT NOT NULL UNIQUE,
  provider_order_id TEXT UNIQUE,
  state TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (state IN ('PENDING','PROCESSING','UNCERTAIN','READY','COMPLETE')),
  lease_until TIMESTAMPTZ,
  attempted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX billing_intents_user_idx ON billing_intents(user_id);

CREATE TABLE billing_payment_events (
  payment_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE account_deletions (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  shop_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  phase INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (state IN ('RECEIVED','PROCESSING','PROCESSED','FAILED')),
  lease_until TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_payment_checkouts (
  provider_order_id TEXT PRIMARY KEY,
  session JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_measurements_updated_at
  BEFORE UPDATE ON measurements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_work_logs_updated_at
  BEFORE UPDATE ON staff_work_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gallery_updated_at
  BEFORE UPDATE ON gallery
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
