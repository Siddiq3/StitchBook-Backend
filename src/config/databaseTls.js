const fs = require('node:fs');

// pg lets URL SSL parameters replace the entire ssl object. When supplying a
// custom CA, keep TLS settings in one place so the CA cannot be silently lost.
function databaseTlsConfig(env = process.env) {
  const caValue = env.DATABASE_SSL_CA;
  const caFile = env.DATABASE_SSL_CA_FILE;
  if (caValue && caFile) {
    throw new Error('Set only one of DATABASE_SSL_CA or DATABASE_SSL_CA_FILE');
  }

  let connectionString = env.DATABASE_URL || '';
  let ca;
  if (caValue || caFile) {
    ca = caValue ? caValue.replace(/\\n/g, '\n') : fs.readFileSync(caFile, 'utf8');
    if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
      throw new Error('Database CA must contain a PEM certificate');
    }
    const url = new URL(connectionString);
    for (const name of ['sslcert', 'sslkey', 'sslrootcert']) {
      if (url.searchParams.has(name)) {
        throw new Error(`Remove ${name} from DATABASE_URL when configuring DATABASE_SSL_CA or DATABASE_SSL_CA_FILE`);
      }
    }
    url.searchParams.delete('sslmode');
    url.searchParams.delete('ssl');
    connectionString = url.toString();
  }

  const useTls = env.NODE_ENV === 'production' || env.PGSSLMODE === 'require' || Boolean(ca);
  return {
    connectionString,
    ssl: useTls ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) } : false,
  };
}

module.exports = { databaseTlsConfig };
