-- =====================================================
-- STITCHPRO BACKEND - STAFF PAYROLL + WORK LOGS
-- Adds compensation basis and per-item staff earnings
-- =====================================================

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS pay_rate DECIMAL(10, 2);

UPDATE staff
SET pay_rate = COALESCE(pay_rate, salary, 0)
WHERE pay_rate IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staff_payment_type_check'
      AND conrelid = 'staff'::regclass
  ) THEN
    ALTER TABLE staff
      ADD CONSTRAINT staff_payment_type_check
      CHECK (payment_type IN ('monthly', 'daily', 'per_piece', 'commission'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staff_work_logs (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  order_number VARCHAR(50),
  item_name VARCHAR(255) NOT NULL,
  item_type VARCHAR(100),
  item_price DECIMAL(10, 2),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rate DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('assigned', 'completed', 'approved', 'paid')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE staff_work_logs
  ADD COLUMN IF NOT EXISTS item_price DECIMAL(10, 2);

CREATE INDEX IF NOT EXISTS idx_staff_work_logs_shop_id ON staff_work_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_staff_work_logs_staff_id ON staff_work_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_work_logs_order_id ON staff_work_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_staff_work_logs_work_date ON staff_work_logs(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_work_logs_status ON staff_work_logs(status);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_staff_work_logs_updated_at ON staff_work_logs;
CREATE TRIGGER update_staff_work_logs_updated_at
  BEFORE UPDATE ON staff_work_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

SELECT 'Staff payroll migration completed successfully!' AS message;
