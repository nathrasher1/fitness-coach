// CORS locked to the app's own origin. Credentials (the session cookie) are only
// ever allowed for these origins; any other site gets no CORS headers, and its
// state-changing requests are refused outright.
const cors = require('cors');

const APP_ORIGIN = 'https://fitness-coach-xamg.onrender.com';
const LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function buildAllowed(env = process.env) {
  const extra = String(env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim().replace(/\/+$/, '')).filter((s) => /^https?:\/\/[^/\s]+$/i.test(s));
  const list = new Set([APP_ORIGIN, ...extra]);
  const dev = env.NODE_ENV !== 'production';
  return (origin) => list.has(origin) || (dev && LOCAL_RE.test(origin));
}

function createCors(env = process.env) {
  const isAllowed = buildAllowed(env);
  const sameOrigin = (req, origin) => origin === `${req.protocol}://${req.get('host')}`;
  const corsMw = cors((req, cb) => {
    const origin = req.get('Origin');
    const ok = !origin ? false : isAllowed(origin) || sameOrigin(req, origin);
    cb(null, { origin: ok, credentials: true });
  });
  const blockForeignWrites = (req, res, next) => {
    const origin = req.get('Origin');
    if (!origin || SAFE_METHODS.has(req.method) || isAllowed(origin) || sameOrigin(req, origin)) return next();
    res.status(403).json({ error: 'Cross-origin request blocked' });
  };
  return [corsMw, blockForeignWrites];
}

module.exports = { createCors, buildAllowed, APP_ORIGIN };
