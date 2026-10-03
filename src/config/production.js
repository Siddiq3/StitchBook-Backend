function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'REDIS_URL', 'FRONTEND_URLS', 'EMAIL_PROVIDER', 'EMAIL_FROM', 'PASSWORD_RESET_OTP_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const value = env[name];
    if (!value || /your[-_]|change_this|YOUR_/i.test(value)) throw new Error(`${name} must be configured for production`);
  }
  if (env.JWT_SECRET.length < 32 || env.JWT_REFRESH_SECRET.length < 32 || env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('Distinct signing secrets of at least 32 characters are required');
  }
  if (env.PASSWORD_RESET_OTP_SECRET.length < 32) {
    throw new Error('PASSWORD_RESET_OTP_SECRET must be at least 32 characters');
  }
  if (String(env.EMAIL_PROVIDER).toLowerCase() !== 'resend') {
    throw new Error('EMAIL_PROVIDER must be resend for this release');
  }
  if (!env.RESEND_API_KEY || !env.RESEND_API_KEY.startsWith('re_') || /replace_with|your[-_]/i.test(env.RESEND_API_KEY)) {
    throw new Error('RESEND_API_KEY must be configured for production');
  }
  if (!/^[^<>\s]+@[^<>\s]+$/.test(String(env.EMAIL_FROM).replace(/^.*<|>.*$/g, ''))) {
    throw new Error('EMAIL_FROM must contain a valid sender email address');
  }
  for (const origin of env.FRONTEND_URLS.split(',')) requireHttps(origin.trim(), 'FRONTEND_URLS');
  requireHttps(env.SUPABASE_URL, 'SUPABASE_URL');
  if (/YOUR_|replace_with|your[-_]/i.test(env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be configured for production');
  }
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
