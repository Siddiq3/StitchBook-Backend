const db = require('./database');

const REQUIRED_TABLES = [
  'users',
  'shops',
  'customers',
  'measurements',
  'orders',
  'payments',
  'subscriptions',
  'staff',
  'invoices',
];

async function ensureDatabaseSchema() {
  const result = await db.queryRow(
    `SELECT COUNT(*)::int AS count
     FROM information_schema.tables
     WHERE table_schema='public'
       AND table_name = ANY($1::text[])`,
    [REQUIRED_TABLES]
  );

  if (Number(result?.count || 0) !== REQUIRED_TABLES.length) {
    throw new Error('Database schema is incomplete. Run npm run migrate before starting the API.');
  }
}

module.exports = { ensureDatabaseSchema, REQUIRED_TABLES };
