/**
 * Run database migration
 * Usage: node run-migration.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const migrationSQL = `
-- Drop existing enum type and recreate with new values
ALTER TYPE order_status RENAME TO order_status_old;

CREATE TYPE order_status AS ENUM ('pending', 'in_progress', 'ready', 'delivered');

-- Update the orders table to use the new enum type
ALTER TABLE orders 
ALTER COLUMN status TYPE order_status USING status::text::order_status;

-- Drop the old enum type
DROP TYPE order_status_old;

-- Add index for status filtering (if not exists)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`;

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Running migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();