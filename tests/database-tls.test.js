const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('pg');
const { databaseTlsConfig } = require('../src/config/databaseTls');

// Configuration fixture only; these tests never connect to a database.
const ca = '-----BEGIN CERTIFICATE-----\nconfiguration-fixture\n-----END CERTIFICATE-----';
const base = { DATABASE_URL: 'postgresql://user:p%40ss@database.example/app', NODE_ENV: 'production' };

test('default production TLS verifies certificates; local development stays plaintext', () => {
  assert.deepEqual(databaseTlsConfig(base).ssl, { rejectUnauthorized: true });
  assert.equal(databaseTlsConfig({ ...base, NODE_ENV: 'development' }).ssl, false);
  assert.deepEqual(databaseTlsConfig({ ...base, NODE_ENV: 'development', PGSSLMODE: 'require' }).ssl, { rejectUnauthorized: true });
});

test('pg retains the custom CA and verification despite conflicting URL SSL options', () => {
  for (const query of ['sslmode=require', 'sslmode=no-verify', 'sslmode=disable', 'ssl=false', 'sslmode=require&ssl=no-verify']) {
    const config = databaseTlsConfig({ ...base, DATABASE_URL: `${base.DATABASE_URL}?${query}&application_name=stitchbook`, DATABASE_SSL_CA: ca.replace(/\n/g, '\\n') });
    const client = new Client(config);
    assert.deepEqual(client.connectionParameters.ssl, { rejectUnauthorized: true, ca });
    assert.equal(client.connectionParameters.application_name, 'stitchbook');
    assert.equal(client.connectionParameters.password, 'p@ss');
    assert.equal(client.connectionParameters.host, 'database.example');
  }
});

test('a secret file supplies the CA and enables TLS in development too', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitchbook-ca-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'database-ca.pem');
  fs.writeFileSync(file, ca);
  assert.deepEqual(databaseTlsConfig({ ...base, NODE_ENV: 'development', DATABASE_SSL_CA_FILE: file }).ssl, { rejectUnauthorized: true, ca });
  assert.throws(() => databaseTlsConfig({ ...base, DATABASE_SSL_CA_FILE: file, DATABASE_SSL_CA: ca }), /only one/);
  fs.writeFileSync(file, '');
  assert.throws(() => databaseTlsConfig({ ...base, DATABASE_SSL_CA_FILE: file }), /PEM certificate/);
  assert.throws(() => databaseTlsConfig({ ...base, DATABASE_SSL_CA_FILE: path.join(dir, 'missing.pem') }), /ENOENT/);
});

test('invalid CA and conflicting client certificate options fail before connecting', () => {
  assert.throws(() => databaseTlsConfig({ ...base, DATABASE_SSL_CA: 'invalid' }), /PEM certificate/);
  for (const name of ['sslcert', 'sslkey', 'sslrootcert']) {
    assert.throws(() => databaseTlsConfig({ ...base, DATABASE_URL: `${base.DATABASE_URL}?${name}=file.pem`, DATABASE_SSL_CA: ca }), new RegExp(`Remove ${name}`));
  }
});
