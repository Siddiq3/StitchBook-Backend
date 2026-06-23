const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runAuthMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const migrationPath = path.join(__dirname, 'src/migrations/007_google_mobile_auth.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Running Google + mobile auth migration...');
    await pool.query(migrationSql);
    console.log('Auth migration completed successfully.');
  } catch (error) {
    console.error('Auth migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAuthMigration();
