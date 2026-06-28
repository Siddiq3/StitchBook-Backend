const db = require('./database');
const logger = require('../utils/logger');

const ORDER_STATUS_ENUM_VALUES = ['cutting', 'stitching'];

async function ensureOrderStatusEnumValues() {
  if (!process.env.DATABASE_URL) {
    logger.warn('DATABASE_URL not configured; skipping order_status enum check');
    return;
  }

  for (const status of ORDER_STATUS_ENUM_VALUES) {
    await db.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS '${status}'`);
  }

  logger.info('✓ order_status enum values verified');
}

async function ensureDatabaseSchema() {
  await ensureOrderStatusEnumValues();
}

module.exports = {
  ensureDatabaseSchema,
};
