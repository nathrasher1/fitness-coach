// Sport / practice sessions: duration × effort = training load; MET-based active kcal.
const { isDateKey } = require('./dates');

const SPORT_PRESETS = [
  'Basketball', 'Soccer', 'Football', 'Baseball', 'Softball', 'Volleyball',
  'Tennis', 'Pickleball', 'Swimming', 'Running', 'Track', 'Wrestling',
  'Boxing', 'Martial arts', 'Hockey', 'Lacrosse', 'Golf', 'Cycling',
  'Dance', 'Cheer', 'Gymnastics', 'Weightlifting', 'Cross country',
  'Practice (general)', 'Other'
];

// Rough adult METs by sport name (lowercase contains). Effort scales MET.
const MET_TABLE = [
  [/basketball|soccer|football|hockey|lacrosse|wrestling|boxing|martial|hiit|metcon/, 8],
  [/swim|run|track|cross.?country|cycling|row/, 7.5],
  [/tennis|pickleball|volleyball|dance|cheer|gymnastics|baseball|softball/, 6],
  [/golf|walk|practice|other|general/, 4.5]
];

function resolveMet(sport) {
  const s = String(sport || '').toLowerCase();
  for (const [re, met] of MET_TABLE) if (re.test(s)) return met;
  return 5;
}

function trainingLoad(durationMin, effort) {
  const d = Number(durationMin);
  const e = Number(effort);
  if (!(d > 0) || !(e >= 1 && e <= 10)) return null;
  return Math.round(d * e * 10) / 10;
}

/**
 * Active kcal ≈ MET × effortScale × 3.5 × weightKg / 200 × minutes
 * effortScale maps 1..10 → ~0.6..1.4 so easy practice burns less than hard.
 * weightLbs defaults to 154 (70 kg) when unknown.
 */
function estimateActiveKcal({ sport, durationMin, effort, weightLbs }) {
  const d = Number(durationMin);
  const e = Math.min(10, Math.max(1, Number(effort) || 5));
  if (!(d > 0 && d <= 600)) return null;
  const met = resolveMet(sport);
  const effortScale = 0.5 + e / 10; // 0.6 .. 1.5
  const kg = (Number(weightLbs) > 0 ? Number(weightLbs) : 154) * 0.45359237;
  const kcal = met * effortScale * 3.5 * kg / 200 * d;
  return Math.max(0, Math.round(kcal));
}

function normalizeSession(body) {
  const sport = String((body && body.sport) || '').trim().slice(0, 80);
  const customSport = String((body && body.customSport) || '').trim().slice(0, 80);
  const name = sport === 'Other' || sport === 'custom' ? (customSport || 'Practice') : (sport || customSport || 'Practice');
  const durationMin = Math.round(Number(body && body.durationMin) * 10) / 10;
  const effort = Math.round(Number(body && body.effort));
  const date = body && body.date;
  const notes = String((body && body.notes) || '').trim().slice(0, 500);
  const drills = String((body && body.drills) || '').trim().slice(0, 500);
  if (!isDateKey(date)) return { error: 'Pick a valid date' };
  if (!name) return { error: 'Pick a sport' };
  if (!(durationMin > 0 && durationMin <= 600)) return { error: 'Duration must be 1–600 minutes' };
  if (!(effort >= 1 && effort <= 10)) return { error: 'Effort must be 1–10' };
  const load = trainingLoad(durationMin, effort);
  return {
    date,
    sport: name,
    durationMin,
    effort,
    notes,
    drills,
    trainingLoad: load
  };
}

/** Weekday numbers 0–6 for recurring practice (like trainingDays). */
function normalizePracticeDays(arr) {
  if (!Array.isArray(arr)) return null;
  return [...new Set(arr.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
}

module.exports = {
  SPORT_PRESETS,
  resolveMet,
  trainingLoad,
  estimateActiveKcal,
  normalizeSession,
  normalizePracticeDays
};
