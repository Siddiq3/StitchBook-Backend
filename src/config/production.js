function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'REDIS_URL', 'FRONTEND_URLS']) {
    const value = env[name];
    if (!value || /your[-_]|change_this|YOUR_/i.test(value)) throw new Error(`${name} must be configured for production`);
  }
  if (env.JWT_SECRET.length < 32 || env.JWT_REFRESH_SECRET.length < 32 || env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('Distinct signing secrets of at least 32 characters are required');
  }
  for (const origin of env.FRONTEND_URLS.split(',')) requireHttps(origin.trim(), 'FRONTEND_URLS');
  if (env.CASHFREE_APP_ID || env.CASHFREE_SECRET_KEY || env.BILLING_ENABLED === 'true') {
    if (env.CASHFREE_ENV !== 'production' || !env.CASHFREE_APP_ID || !env.CASHFREE_SECRET_KEY) {
      throw new Error('Production billing requires Cashfree production credentials');
    }
    requireHttps(env.WEB_APP_URL, 'WEB_APP_URL');
  }
  if (env.BASE_URL) requireHttps(env.BASE_URL, 'BASE_URL');
}
function requireHttps(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an HTTPS URL`); }
  if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error(`${name} must be an HTTPS production URL`);
  }
  return url;
}
module.exports = { validateProductionConfig, requireHttps };
