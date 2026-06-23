-- =====================================================
-- STITCHPRO BACKEND - DATABASE MIGRATION
-- Add order_type to orders table
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'order_type'
    ) THEN
        ALTER TABLE orders ADD COLUMN order_type VARCHAR(50) DEFAULT 'stitching';
    END IF;
END $$;

-- Add a check constraint for allowed order types if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'orders' AND constraint_type = 'CHECK' AND constraint_name = 'orders_order_type_check'
    ) THEN
        ALTER TABLE orders
        ADD CONSTRAINT orders_order_type_check CHECK (order_type IN ('stitching', 'alteration'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

SELECT 'Migration completed successfully!' AS message;
