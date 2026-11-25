// Optional daily readiness check-in: sleep, soreness, mood, energy on a 1–5 scale.
const { isDateKey } = require('./dates');

const FIELDS = ['sleep', 'soreness', 'mood', 'energy'];
const LABELS = {
  sleep: 'Sleep',
  soreness: 'Soreness',
  mood: 'Mood',
  energy: 'Energy'
};

function scale(value) {
  if (value == null || value === '') return null;
  const n = Math.round(Number(value));
  if (!(n >= 1 && n <= 5)) return { error: 'Each rating must be 1–5, or left blank.' };
  return { value: n };
}

function normalize(body, date) {
  if (!isDateKey(date)) return { error: 'Pick a valid date' };
  const out = { date, notes: String((body && body.notes) || '').trim().slice(0, 300) };
  for (const f of FIELDS) {
    const r = scale(body && body[f]);
    if (r && r.error) return r;
    out[f] = r ? r.value : null;
  }
  if (out.sleep == null && out.soreness == null && out.mood == null && out.energy == null && !out.notes) {
    return { error: 'Rate at least one of sleep, soreness, mood, or energy' };
  }
  return out;
}

function view(doc) {
  if (!doc) return null;
  return {
    date: doc.date,
    sleep: doc.sleep == null ? null : doc.sleep,
    soreness: doc.soreness == null ? null : doc.soreness,
    mood: doc.mood == null ? null : doc.mood,
    energy: doc.energy == null ? null : doc.energy,
    notes: doc.notes || ''
  };
}

module.exports = { FIELDS, LABELS, normalize, view, scale };
