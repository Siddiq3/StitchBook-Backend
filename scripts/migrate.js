require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

const migrationsDir = path.join(__dirname, '../migrations');
const lockName = 'stitchbook-schema-migrations';

const checksum = (content) => crypto.createHash('sha256').update(content).digest('hex');

async function migrate() {
  const client = await db.pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockName]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort();

    for (const filename of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
      const digest = checksum(sql);
      const applied = (await client.query(
        'SELECT checksum FROM schema_migrations WHERE filename=$1',
        [filename]
      )).rows[0];

      if (applied) {
        if (applied.checksum !== digest) {
          throw new Error(`Applied migration was modified: ${filename}`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations(filename, checksum) VALUES($1,$2)',
          [filename, digest]
        );
        await client.query('COMMIT');
        process.stdout.write(`Applied ${filename}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockName]);
    } finally {
      client.release();
      await db.pool.end();
    }
  }
}

migrate().catch((error) => {
  process.stderr.write(`Migration failed: ${error.code || error.name || 'error'}\n`);
  process.exitCode = 1;
});
