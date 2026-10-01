const COOKIE = 'stitchbook_refresh';
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', path: '/api/auth', maxAge: 90 * 24 * 60 * 60 * 1000 });
function readCookie(req) {
  const entry = String(req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(COOKIE.length + 1)); } catch { return null; }
}
function webSession(req, res, next) {
  const isWeb = req.get('x-client-platform') === 'web' || /^https?:\/\//.test(req.get('origin') || '');
  const cookie = readCookie(req);
  // Cookie refresh is protected against CSRF by exact Origin + non-simple header.
  if (isWeb || cookie) {
    const origins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : '')).split(',').map(item => item.trim().replace(/\/$/, ''));
    if (req.get('x-client-platform') !== 'web' || !origins.includes(req.get('origin'))) return res.status(403).json({ success: false, message: 'Request origin is not allowed' });
  }
  if (isWeb && req.path === '/refresh-token') req.body.refreshToken = cookie;
  const json = res.json.bind(res);
  res.json = body => {
    if (isWeb && body?.success && body.data?.refreshToken) {
      res.cookie(COOKIE, body.data.refreshToken, options());
      body = { ...body, data: { ...body.data } };
      delete body.data.refreshToken;
    }
    if (isWeb && (req.path === '/logout' || req.path === '/logout-all' || (req.path === '/refresh-token' && res.statusCode === 401))) {
      const { maxAge, ...clearOptions } = options();
      res.clearCookie(COOKIE, clearOptions);
    }
    return json(body);
  };
  next();
}
module.exports = { webSession, readCookie };
