const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runStaffAccessMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const migrationPath = path.join(__dirname, 'src/migrations/008_staff_access_roles.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Running staff access roles migration...');
    await pool.query(migrationSql);
    console.log('Staff access roles migration completed successfully.');
  } catch (error) {
    console.error('Staff access roles migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runStaffAccessMigration();
