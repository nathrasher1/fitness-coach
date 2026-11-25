// Competition and event helpers: presets, normalization, result templates, countdown.
const { isDateKey } = require('./dates');
const SS = require('./sportSessions');

const EVENT_TYPES = [
  { key: 'meet', label: 'Meet' },
  { key: 'game', label: 'Game' },
  { key: 'race', label: 'Race' },
  { key: 'match', label: 'Match' },
  { key: 'invitational', label: 'Invitational' },
  { key: 'test', label: 'Test day' },
  { key: 'recital', label: 'Recital' },
  { key: 'other', label: 'Other' }
];

const RESULT_KINDS = [
  { key: 'generic', label: 'Simple result' },
  { key: 'lifting', label: 'Lifts and attempts' },
  { key: 'race', label: 'Race time and splits' },
  { key: 'match', label: 'Match record' }
];

const LIFTS = [
  { key: 'squat', label: 'Squat' },
  { key: 'bench', label: 'Bench' },
  { key: 'deadlift', label: 'Deadlift' },
  { key: 'snatch', label: 'Snatch' },
  { key: 'clean_and_jerk', label: 'Clean & jerk' }
];

const MATCH_METHODS = [
  { key: 'points', label: 'Points' },
  { key: 'submission', label: 'Submission' },
  { key: 'decision', label: 'Decision' },
  { key: 'pin', label: 'Pin' },
  { key: 'ko', label: 'KO' },
  { key: 'tko', label: 'TKO' },
  { key: 'other', label: 'Other' }
];

// Practice-session sports plus a few that need result templates (powerlifting, BJJ, …).
const EXTRA_SPORTS = [
  'Powerlifting', 'Olympic lifting', 'Brazilian jiu-jitsu', 'Judo', 'MMA',
  'Triathlon', 'Rowing', 'CrossFit', 'HYROX'
];

function sportPresets() {
  const base = SS.SPORT_PRESETS.filter((s) => s !== 'Other' && s !== 'Practice (general)');
  const seen = new Set(base.map((s) => s.toLowerCase()));
  const extra = EXTRA_SPORTS.filter((s) => !seen.has(s.toLowerCase()));
  return [...base, ...extra, 'Other'];
}

function typeKeys() {
  return new Set(EVENT_TYPES.map((t) => t.key));
}

function inferResultKind(sport, type) {
  const t = String(type || '').toLowerCase();
  const s = String(sport || '').toLowerCase();
  if (t === 'race') return 'race';
  if (t === 'match') return 'match';
  if (/powerlift|olympic|weightlifting|weight ?lift|strongman/.test(s)) return 'lifting';
  if (/^(run|running|swim|swimming|cycl|bike|triath|track|marathon|ultra|cross.?country|row|hyrox)/.test(s) || /triathlon|marathon|cross country/.test(s)) return 'race';
  if (/wrestl|bjj|jiu|judo|box|mma|martial|sambo|muay|kick/.test(s)) return 'match';
  if (t === 'meet' && /lift/.test(s)) return 'lifting';
  return 'generic';
}

function isTime(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function parseClock(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value * 10) / 10;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return n >= 0 ? Math.round(n * 10) / 10 : null;
  }
  const parts = raw.split(':');
  if (parts.length === 2 || parts.length === 3) {
    const nums = parts.map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
    let sec = 0;
    if (parts.length === 3) sec = nums[0] * 3600 + nums[1] * 60 + nums[2];
    else sec = nums[0] * 60 + nums[1];
    return Math.round(sec * 10) / 10;
  }
  return null;
}

function formatClock(sec) {
  if (sec == null || !Number.isFinite(Number(sec)) || Number(sec) < 0) return '';
  const s = Number(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = Math.round((s - h * 3600 - m * 60) * 10) / 10;
  const pad = (n, z = 2) => String(Math.floor(n)).padStart(z, '0');
  const frac = rem % 1 ? rem.toFixed(1).padStart(4, '0') : pad(rem);
  if (h > 0) return `${h}:${pad(m)}:${frac}`;
  return `${m}:${frac}`;
}

function countdown(today, eventDate) {
  const { daysBetween } = require('./weightClass');
  const days = daysBetween(today, eventDate);
  if (days == null) return { days: null, label: '' };
  if (days === 0) return { days, label: 'Today' };
  if (days === 1) return { days, label: 'Tomorrow' };
  if (days === -1) return { days, label: 'Yesterday' };
  if (days > 1) return { days, label: `In ${days} days` };
  return { days, label: `${-days} days ago` };
}

function normalizeEvent(body) {
  const name = String((body && body.name) || '').trim().slice(0, 120);
  const sportRaw = String((body && body.sport) || '').trim().slice(0, 80);
  const customSport = String((body && body.customSport) || '').trim().slice(0, 80);
  const sport = sportRaw === 'Other' || sportRaw === 'custom' ? (customSport || '') : (sportRaw || customSport);
  const type = String((body && body.type) || '').trim();
  const date = body && body.date;
  const time = String((body && body.time) || '').trim();
  const place = String((body && body.place) || '').trim().slice(0, 120);
  const notes = String((body && body.notes) || '').trim().slice(0, 500);
  if (!name) return { error: 'Name this event' };
  if (!sport) return { error: 'Pick a sport' };
  if (!typeKeys().has(type)) return { error: 'Pick an event type' };
  if (!isDateKey(date)) return { error: 'Pick a valid date' };
  if (time && !isTime(time)) return { error: 'Time must be HH:MM' };
  const requestedKind = String((body && body.resultKind) || '').trim();
  const resultKind = RESULT_KINDS.some((k) => k.key === requestedKind) ? requestedKind : inferResultKind(sport, type);
  let weightClassLbs = null;
  if (body && body.weightClassLbs != null && body.weightClassLbs !== '') {
    const w = Number(body.weightClassLbs);
    if (!(w > 0 && w <= 800)) return { error: 'Weight class must be between 0 and 800 lbs' };
    weightClassLbs = Math.round(w * 10) / 10;
  }
  const weighInDate = body && body.weighInDate ? String(body.weighInDate).trim() : '';
  if (weighInDate && !isDateKey(weighInDate)) return { error: 'Pick a valid weigh-in date' };
  return { name, sport, type, date, time: time || '', place, notes, resultKind, weightClassLbs, weighInDate };
}

function normalizeAttempts(list) {
  if (!Array.isArray(list)) return [];
  const liftKeys = new Set(LIFTS.map((l) => l.key));
  const out = [];
  list.forEach((row) => {
    const lift = String((row && row.lift) || '');
    const attempt = Math.round(Number(row && row.attempt));
    if (!liftKeys.has(lift) || !(attempt >= 1 && attempt <= 3)) return;
    const outcome = ['good', 'no-lift', 'skip'].includes(row.outcome) ? row.outcome : 'skip';
    let weightLbs = null;
    if (row.weightLbs != null && row.weightLbs !== '') {
      const w = Number(row.weightLbs);
      if (w >= 0 && w <= 2000) weightLbs = Math.round(w * 10) / 10;
    }
    out.push({ lift, attempt, weightLbs, outcome });
  });
  return out.slice(0, 15);
}

function normalizeSplits(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 20).map((row) => ({
    label: String((row && row.label) || '').trim().slice(0, 40),
    timeSec: parseClock(row && (row.timeSec != null ? row.timeSec : row.time))
  })).filter((s) => s.label || s.timeSec != null);
}

function normalizeResult(kind, body) {
  const k = RESULT_KINDS.some((x) => x.key === kind) ? kind : 'generic';
  const place = String((body && body.place) || '').trim().slice(0, 40);
  const outcomeRaw = String((body && body.outcome) || '').trim();
  const outcome = ['win', 'loss', 'draw', 'other'].includes(outcomeRaw) ? outcomeRaw : '';
  const score = String((body && body.score) || '').trim().slice(0, 40);
  const notes = String((body && body.notes) || '').trim().slice(0, 500);
  const result = { kind: k, place, outcome, score, notes };
  if (k === 'lifting') {
    result.attempts = normalizeAttempts(body && body.attempts);
  } else if (k === 'race') {
    result.distance = String((body && body.distance) || '').trim().slice(0, 40);
    result.timeSec = parseClock(body && (body.timeSec != null ? body.timeSec : body.time));
    result.splits = normalizeSplits(body && body.splits);
  } else if (k === 'match') {
    const method = String((body && body.method) || '').trim();
    result.method = MATCH_METHODS.some((m) => m.key === method) ? method : '';
    result.opponent = String((body && body.opponent) || '').trim().slice(0, 80);
  }
  return result;
}

function hasResult(result) {
  if (!result) return false;
  if (result.place || result.outcome || result.score || result.notes) return true;
  if (result.distance || result.timeSec != null) return true;
  if (result.opponent || result.method) return true;
  if (Array.isArray(result.attempts) && result.attempts.some((a) => a.outcome !== 'skip' || a.weightLbs != null)) return true;
  if (Array.isArray(result.splits) && result.splits.length) return true;
  return false;
}

function liftingTotal(attempts) {
  if (!Array.isArray(attempts)) return null;
  const best = new Map();
  attempts.forEach((a) => {
    if (!a || a.outcome !== 'good' || !(a.weightLbs > 0)) return;
    const prev = best.get(a.lift) || 0;
    if (a.weightLbs > prev) best.set(a.lift, a.weightLbs);
  });
  if (!best.size) return null;
  let sum = 0;
  best.forEach((v) => { sum += v; });
  return Math.round(sum * 10) / 10;
}

/** Most recent earlier event with the same sport, else the same type. */
function findSimilar(event, others) {
  const list = (others || []).filter((e) => e && e.date && event && event.date && e.date < event.date);
  const sport = String((event && event.sport) || '').trim().toLowerCase();
  const type = String((event && event.type) || '');
  const sameSport = list.filter((e) => String(e.sport || '').trim().toLowerCase() === sport);
  const pool = sameSport.length ? sameSport : list.filter((e) => e.type === type);
  pool.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return pool[0] || null;
}

function compareResults(event, previous) {
  if (!event || !previous) return null;
  const a = event.result;
  const b = previous.result;
  if (!hasResult(a) || !hasResult(b)) return { note: 'Log a result on both events to compare them.' };
  const out = { kind: a.kind || 'generic' };
  if (a.kind === 'race' && b.kind === 'race' && a.timeSec != null && b.timeSec != null) {
    const delta = Math.round((a.timeSec - b.timeSec) * 10) / 10;
    out.timeDeltaSec = delta;
    out.summary = delta === 0
      ? `Same finish time as ${previous.name} (${formatClock(b.timeSec)}).`
      : delta < 0
        ? `${formatClock(-delta)} faster than ${previous.name} (${formatClock(b.timeSec)}).`
        : `${formatClock(delta)} slower than ${previous.name} (${formatClock(b.timeSec)}).`;
  } else if (a.kind === 'lifting' && b.kind === 'lifting') {
    const ta = liftingTotal(a.attempts);
    const tb = liftingTotal(b.attempts);
    out.thisTotalLbs = ta;
    out.prevTotalLbs = tb;
    if (ta != null && tb != null) {
      const d = Math.round((ta - tb) * 10) / 10;
      out.totalDeltaLbs = d;
      out.summary = d === 0
        ? `Same total as ${previous.name} (${tb} lbs).`
        : d > 0
          ? `${d} lbs more than ${previous.name} (${tb} lbs).`
          : `${-d} lbs less than ${previous.name} (${tb} lbs).`;
    } else {
      out.summary = 'Add successful attempts on both meets to compare totals.';
    }
  } else if (a.kind === 'match' && b.kind === 'match') {
    const label = (r) => [r.outcome, r.method, r.score].filter(Boolean).join(', ') || 'result logged';
    out.summary = `This event: ${label(a)}. ${previous.name}: ${label(b)}.`;
  } else {
    const bits = [];
    if (a.place && b.place) bits.push(`Place ${a.place} vs ${b.place} last time`);
    if (a.score && b.score) bits.push(`Score ${a.score} vs ${b.score}`);
    if (a.outcome && b.outcome) bits.push(`${a.outcome} vs ${b.outcome}`);
    out.summary = bits.length ? bits.join('. ') + '.' : `Compared with ${previous.name} on ${previous.date}.`;
  }
  return out;
}

function presets() {
  return {
    types: EVENT_TYPES,
    sports: sportPresets(),
    resultKinds: RESULT_KINDS,
    lifts: LIFTS,
    matchMethods: MATCH_METHODS
  };
}

module.exports = {
  EVENT_TYPES,
  RESULT_KINDS,
  LIFTS,
  MATCH_METHODS,
  sportPresets,
  inferResultKind,
  parseClock,
  formatClock,
  countdown,
  normalizeEvent,
  normalizeResult,
  hasResult,
  liftingTotal,
  findSimilar,
  compareResults,
  presets
};
