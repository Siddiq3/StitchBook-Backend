-- Description: Add measurement_snapshot JSONB to orders for immutable order-level measurement snapshots

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'orders'
          AND column_name = 'measurement_snapshot'
    ) THEN
        ALTER TABLE orders
        ADD COLUMN measurement_snapshot JSONB;
    END IF;
END $$;

-- Add a GIN index to support querying snapshots in the future
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 'orders'
          AND indexname = 'idx_orders_measurement_snapshot'
    ) THEN
        CREATE INDEX idx_orders_measurement_snapshot ON orders USING GIN (measurement_snapshot);
    END IF;
END $$;
