-- =====================================================
-- STITCHPRO BACKEND - DATABASE MIGRATION
-- New Tables: staff, notifications, gallery, invoices, push_tokens
-- Updated: orders (order_number auto-generation)
-- =====================================================

-- =====================================================
-- 1. STAFF TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'tailor',
    salary DECIMAL(10, 2),
    commission_rate DECIMAL(5, 2) DEFAULT 0,
    aadhar_number VARCHAR(20),
    address TEXT,
    photo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    joined_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for staff lookup by shop
CREATE INDEX IF NOT EXISTS idx_staff_shop_id ON staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON staff(is_active);

-- =====================================================
-- 2. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'general',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_shop_id ON notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- 3. GALLERY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS gallery (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    title VARCHAR(255),
    description TEXT,
    image_url TEXT NOT NULL,
    category VARCHAR(100),
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for gallery
CREATE INDEX IF NOT EXISTS idx_gallery_shop_id ON gallery(shop_id);
CREATE INDEX IF NOT EXISTS idx_gallery_category ON gallery(category);
CREATE INDEX IF NOT EXISTS idx_gallery_is_active ON gallery(is_active);

-- =====================================================
-- 4. INVOICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    subtotal DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    amount_due DECIMAL(10, 2) DEFAULT 0,
    payment_method VARCHAR(50),
    notes TEXT,
    items JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_shop_id ON invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);

-- =====================================================
-- 5. PUSH_TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    device_type VARCHAR(50) DEFAULT 'android',
    device_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for push tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_is_active ON push_tokens(is_active);

-- =====================================================
-- 6. UPDATE ORDERS TABLE - Add order_number
-- =====================================================
-- Add order_number column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'order_number'
    ) THEN
        ALTER TABLE orders ADD COLUMN order_number VARCHAR(50) UNIQUE;
    END IF;
END $$;

-- Create sequence for order numbers if needed
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- Index for orders by order_number
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- =====================================================
-- 7. TRIGGER FOR UPDATED_AT
-- =====================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to staff table
DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
CREATE TRIGGER update_staff_updated_at
    BEFORE UPDATE ON staff
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to gallery table
DROP TRIGGER IF EXISTS update_gallery_updated_at ON gallery;
CREATE TRIGGER update_gallery_updated_at
    BEFORE UPDATE ON gallery
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to invoices table
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. ADD CUSTOMER EMAIL INDEX (for faster lookups)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- =====================================================
-- 9. ADD ORDER STATUS INDEX
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
SELECT 'Migration completed successfully!' AS message;