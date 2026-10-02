const secretKeys = /authorization|cookie|password|secret|token|otp|signature|authkey|tokenauth|firebase_uid|google_id|payment_session_id|paymentSessionId/i;
function redact(value, depth = 0) {
  if (depth > 6) return '[Truncated]';
  if (value instanceof Error) return { name: value.name, code: value.code || 'ERROR' };
  if (Array.isArray(value)) return value.slice(0, 50).map(item => redact(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretKeys.test(key) ? '[Redacted]' : redact(item, depth + 1)]));
  if (typeof value === 'string') return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [Redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[Redacted]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[Redacted]@')
    .replace(/([?&](?:[^=&]*(?:token|secret|signature|otp|key)[^=&]*)=)[^&\s]+/gi, '$1[Redacted]');
  return value;
}
module.exports = { redact };
