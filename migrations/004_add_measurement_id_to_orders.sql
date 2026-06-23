-- Migration: Add measurement_id to orders table
-- Description: Links orders to customer measurements

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS measurement_id INTEGER REFERENCES measurements(id) ON DELETE SET NULL;

-- Add index for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_orders_measurement_id 
ON orders(measurement_id);
