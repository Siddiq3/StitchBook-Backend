/**
 * Run database migration 006 - Staff payroll and work logs
 * Usage: node run-migration-006.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Running migration 006...');

    const migrationPath = path.join(
      __dirname,
      'src/migrations/006_staff_payroll_work_logs.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(migrationSQL);
    console.log('✅ Migration 006 completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
