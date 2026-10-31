// Local-date helpers. Date keys are plain 'YYYY-MM-DD' strings in the user's
// local calendar (unchanged storage format). The server never assumes UTC is
// the user's day: the client sends its local date (X-Local-Date) and its
// timezone offset (X-TZ-Offset, minutes as returned by Date#getTimezoneOffset).
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(s) {
  if (typeof s !== 'string' || !KEY_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function utcKey(d) {
  return d.toISOString().slice(0, 10);
}

// Pure calendar arithmetic on a date key (no timezone involved).
function shiftKey(key, days) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return utcKey(d);
}

// Today's key for an offset in Date#getTimezoneOffset() minutes (EDT = 240).
function keyForOffset(offsetMin, now = new Date()) {
  return utcKey(new Date(now.getTime() - offsetMin * 60000));
}

function parseOffset(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < -840 || n > 720) return null; // UTC+14 .. UTC-12
  return n;
}

// The requesting user's "today". Order: X-Local-Date (if plausible),
// X-TZ-Offset, then UTC as a last resort for old clients.
function localToday(req, now = new Date()) {
  const h = (req && req.headers) || {};
  const q = (req && req.query) || {};
  const utc = utcKey(now);
  const claimed = h['x-local-date'] || q.today;
  // Real local dates are always within one day of the UTC date.
  if (isDateKey(claimed) && claimed >= shiftKey(utc, -1) && claimed <= shiftKey(utc, 1)) return claimed;
  const off = parseOffset(h['x-tz-offset'] ?? q.tz);
  if (off != null) return keyForOffset(off, now);
  return utc;
}

function daysAgoKey(req, days, now = new Date()) {
  return shiftKey(localToday(req, now), -days);
}

module.exports = { isDateKey, shiftKey, keyForOffset, localToday, daysAgoKey, parseOffset };
