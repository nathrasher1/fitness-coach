// Imported phone health data (Health Connect now, HealthKit later).
const HealthDaily = require('../models/HealthDaily');
const HealthWorkout = require('../models/HealthWorkout');
const { shiftKey } = require('./dates');

const SOURCES = new Set(['health_connect', 'healthkit']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400, MAX_WORKOUTS = 1000;
const LIMITS = { steps: 200000, activeKcal: 20000, distanceM: 500000 };

const num = (v, max) => { const n = Number(v); return v == null || v === '' || !Number.isFinite(n) || n < 0 || n > max ? null : Math.round(n * 10) / 10; };
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// "strengthTraining" -> "Strength training"
function prettyType(t) {
  const s = String(t || 'other').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function cleanDay(d) {
  if (!d || !DATE_RE.test(d.date)) return null;
  const out = { date: d.date, steps: num(d.steps, LIMITS.steps), activeKcal: num(d.activeKcal, LIMITS.activeKcal), distanceM: num(d.distanceM, LIMITS.distanceM) };
  if (out.steps != null) out.steps = Math.round(out.steps);
  return out.steps == null && out.activeKcal == null && out.distanceM == null ? null : out;
}

// Only overwrite metrics that were actually reported (e.g. distance permission not granted keeps the old value).
function setPresent(x, now) {
  const s = { updatedAt: now };
  for (const k of ['steps', 'activeKcal', 'distanceM']) if (x[k] != null) s[k] = x[k];
  return s;
}

function cleanWorkout(w) {
  if (!w) return null;
  const externalId = str(w.externalId, 200);
  const start = new Date(w.start), end = new Date(w.end);
  if (!externalId || isNaN(start) || isNaN(end) || end < start || end - start > 2 * 86400e3) return null;
  const date = DATE_RE.test(w.date) ? w.date : start.toISOString().slice(0, 10);
  const type = str(w.type, 60) || 'other';
  return {
    externalId, start, end, date, type,
    name: str(w.name, 80) || prettyType(type),
    app: str(w.app, 80),
    durationMin: num(w.durationMin != null ? w.durationMin : (end - start) / 60000, 2880),
    activeKcal: num(w.activeKcal, LIMITS.activeKcal),
    distanceM: num(w.distanceM, LIMITS.distanceM)
  };
}

async function sync(userId, body) {
  const source = String(body && body.source || '');
  if (!SOURCES.has(source)) { const e = new Error('Unknown source'); e.status = 400; throw e; }
  const days = Array.isArray(body.days) ? body.days : [];
  const workouts = Array.isArray(body.workouts) ? body.workouts : [];
  if (days.length > MAX_DAYS || workouts.length > MAX_WORKOUTS) { const e = new Error('Too much data in one sync'); e.status = 413; throw e; }
  const now = new Date();
  const d = days.map(cleanDay).filter(Boolean);
  const w = workouts.map(cleanWorkout).filter(Boolean);
  if (d.length) await HealthDaily.bulkWrite(d.map((x) => ({ updateOne: { filter: { user: userId, date: x.date, source }, update: { $set: setPresent(x, now) }, upsert: true } })));
  if (w.length) await HealthWorkout.bulkWrite(w.map((x) => ({ updateOne: { filter: { user: userId, source, externalId: x.externalId }, update: { $set: { ...x, updatedAt: now } }, upsert: true } })));
  return { days: d.length, workouts: w.length, skipped: days.length - d.length + workouts.length - w.length };
}

// Per-day totals; if several sources report the same day, the larger value wins (never summed, to avoid double counting).
async function dailyRange(userId, from, to) {
  const rows = await HealthDaily.find({ user: userId, date: { $gte: from, $lte: to } }).lean();
  const byDate = {};
  for (const r of rows) {
    const o = byDate[r.date] || (byDate[r.date] = { date: r.date, steps: null, activeKcal: null, distanceM: null });
    for (const k of ['steps', 'activeKcal', 'distanceM']) if (r[k] != null && (o[k] == null || r[k] > o[k])) o[k] = r[k];
  }
  return byDate;
}

async function summary(userId, today, n = 7) {
  n = Math.min(Math.max(parseInt(n, 10) || 7, 1), 31);
  const from = shiftKey(today, -(n - 1));
  const [byDate, last, count] = await Promise.all([
    dailyRange(userId, from, today),
    HealthDaily.findOne({ user: userId }).sort({ updatedAt: -1 }).select('updatedAt source').lean(),
    HealthWorkout.countDocuments({ user: userId })
  ]);
  const days = [];
  for (let i = n - 1; i >= 0; i--) { const k = shiftKey(today, -i); days.push(byDate[k] || { date: k, steps: null, activeKcal: null, distanceM: null }); }
  const lastW = last ? null : await HealthWorkout.findOne({ user: userId }).sort({ updatedAt: -1 }).select('updatedAt source').lean();
  const l = last || lastW;
  return { hasData: !!l || count > 0, lastSync: l ? l.updatedAt : null, source: l ? l.source : null, today: days[days.length - 1], days, importedWorkouts: count };
}

const workoutView = (w) => ({ _id: w._id, imported: true, date: w.date, name: w.name, type: w.type, app: w.app, source: w.source, durationMin: w.durationMin, activeKcal: w.activeKcal, distanceM: w.distanceM, start: w.start });

async function recentWorkouts(userId, limit = 15, from) {
  const q = { user: userId }; if (from) q.date = { $gte: from };
  return (await HealthWorkout.find(q).sort({ date: -1, start: -1 }).limit(Math.min(limit, 100)).lean()).map(workoutView);
}

async function removeAll(userId, source) {
  const q = { user: userId }; if (source) q.source = source;
  const [a, b] = await Promise.all([HealthDaily.deleteMany(q), HealthWorkout.deleteMany(q)]);
  return { days: a.deletedCount, workouts: b.deletedCount };
}

module.exports = { sync, summary, dailyRange, recentWorkouts, removeAll, cleanDay, cleanWorkout, prettyType, SOURCES };
