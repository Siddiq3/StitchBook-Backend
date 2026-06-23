const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runSubscriptionWebBillingMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const migrationPath = path.join(
      __dirname,
      'src/migrations/009_subscription_web_billing_security.sql'
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Running subscription web billing security migration...');
    await pool.query(migrationSql);
    console.log('Subscription web billing security migration completed successfully.');
  } catch (error) {
    console.error('Subscription web billing security migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSubscriptionWebBillingMigration();
