// Teen higher-weight support. Computes BMI-for-age percentile (CDC 2000 growth charts) privately.
// The number is never sent to the teen or the parent; only `flagged` (>= 95th percentile) is used.
// A teen never gets a calorie deficit target (see targetPolicy in recommendations.js).
const CDC = require('../data/cdcBmiForAge');
const User = require('../models/User');
const AboutYou = require('../models/AboutYou');
const Weight = require('../models/Weight');
const WorkoutLog = require('../models/WorkoutLog');
const FoodLog = require('../models/FoodLog');
const BodyMetric = require('../models/BodyMetric');
const { userGroup } = require('./age');
const { shiftKey, isDateKey } = require('./dates');

const FLAG_PERCENTILE = 95;

function ageMonths(dob, today) {
  if (!isDateKey(dob) || !isDateKey(today)) return null;
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let m = (ty - by) * 12 + (tm - bm);
  if (td < bd) m -= 1;
  return m;
}
function normCdf(z) { // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** BMI-for-age for ages 13-17 with sex male/female. Returns null when it can't be computed. */
function bmiForAge({ weightLbs, heightCm, sex, dob, today }) {
  const table = sex === 'male' ? CDC.male : sex === 'female' ? CDC.female : null;
  const months = ageMonths(dob, today);
  if (!table || !(weightLbs > 0) || !(heightCm > 0) || months == null || months < 156 || months >= 216) return null;
  const row = table.find((r) => r[0] === months + 0.5) || table[table.length - 1];
  const [, L, M, S, P95] = row;
  const bmi = (weightLbs * 0.45359237) / Math.pow(heightCm / 100, 2);
  const z = L === 0 ? Math.log(bmi / M) / S : (Math.pow(bmi / M, L) - 1) / (L * S);
  const percentile = Math.round(normCdf(z) * 1000) / 10;
  return { bmi: Math.round(bmi * 10) / 10, percentile, p95: P95, flagged: bmi >= P95 };
}

// Kind, habit-focused content. No weight labels, no numbers.
const CONTENT = {
  note: "Everybody grows differently. It could help to check in with your doctor and a parent or guardian about your health and growth. They can help you find what works for you. In the meantime, here are some everyday habits that help almost everyone feel stronger and more energetic.",
  noParentNote: "If you'd like a parent or guardian to support you, you can link them in Settings → Family.",
  habits: [
    { key: 'activity', title: 'Move most days', text: 'Aim for about 60 minutes of activity a day. Sports, walks, bike rides and workouts all count. Keep your streak going!' },
    { key: 'protein', title: 'Protein at each meal', text: 'Eggs, yogurt, beans, chicken, fish or tofu help you feel full and build strength.' },
    { key: 'produce', title: 'Fruits and vegetables', text: 'Try to fill half your plate with fruits and vegetables, and keep fruit handy for snacks.' },
    { key: 'sleep', title: 'Sleep 8–10 hours', text: 'Good sleep helps energy, mood, recovery and hunger signals.' },
    { key: 'drinks', title: 'Water first', text: 'Swap sugary drinks for water or milk most of the time.' }
  ],
  suggestions: ['Greek yogurt with berries', 'Eggs and whole-grain toast', 'Apple or banana with peanut butter', 'Chicken, rice and vegetables', 'Bean and veggie burrito bowl', 'Carrots or cucumber with hummus', 'Popcorn (air-popped)', 'Milk or unsweetened soy milk'],
  cutBack: ['Soda and sweet tea', 'Energy and sports drinks (unless training hard)', 'Sweetened coffee drinks', 'Candy and pastries', 'Chips and fried snacks', 'Fast food more than once a week'],
  parentSees: ['This note about talking with a doctor', 'Your activity and streak (including daily steps if you connect a phone health app)', 'Your workouts (including imported ones)', 'Meals you log (food names)', 'Food suggestions and the cut-back list'],
  privateUnlessShared: ['Your weight', 'Body measurements'],
  alwaysPrivate: ['Progress photos'] // BMI is never shown to teens or parents
};

async function teenStatus(userId, today) {
  const [user, about, latest] = await Promise.all([
    User.findById(userId).select('+dob accountLocked heightCm'),
    AboutYou.findOne({ user: userId }).lean(),
    Weight.findOne({ user: userId, date: { $lte: today } }).sort({ date: -1 }).lean()
  ]);
  const group = userGroup(user, today);
  if (group !== 'teen') return { group, flagged: false };
  const r = bmiForAge({ weightLbs: latest && latest.weight, heightCm: (about && about.heightCm) || (user && user.heightCm), sex: about && about.sex, dob: user.dob, today });
  return { group, flagged: !!(r && r.flagged), computed: !!r, shareBody: !!(about && about.shareBodyWithParent) };
}

/** What a linked parent sees for a flagged teen (read-only). Body data only when the teen turned sharing on. */
async function parentView(teenId, today) {
  const st = await teenStatus(teenId, today);
  if (st.group !== 'teen' || !st.flagged) return { flagged: false };
  const from = shiftKey(today, -13);
  const { streakFor } = require('./streak');
  const [streak, workouts, meals] = await Promise.all([
    streakFor(teenId, today).catch(() => null),
    WorkoutLog.find({ user: teenId, date: { $gte: from, $lte: today } }).sort({ date: -1 }).select('date name durationMin').limit(20).lean(),
    FoodLog.find({ user: teenId, date: { $gte: from, $lte: today } }).sort({ date: -1 }).select('date meal foodName').limit(40).lean()
  ]);
  // Activity habits from a connected phone (steps + imported workouts only).
  const H = require('./health');
  const [activityDays, importedW] = await Promise.all([H.dailyRange(teenId, from, today).catch(() => ({})), H.recentWorkouts(teenId, 20, from).catch(() => [])]);
  const out = {
    flagged: true,
    note: 'Your teen\'s app is suggesting they check in with their doctor and with you about health and growth, and is showing everyday habit tips. Please keep the conversation supportive and focused on habits, not weight.',
    habits: CONTENT.habits, suggestions: CONTENT.suggestions, cutBack: CONTENT.cutBack,
    streak: streak ? { days: streak.streak, todayDone: streak.todayDone } : null,
    workouts: [...workouts.map((w) => ({ date: w.date, name: w.name, durationMin: w.durationMin || null })),
      ...importedW.map((w) => ({ date: w.date, name: w.name, durationMin: w.durationMin || null, imported: true, app: w.app }))].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20),
    activity: Object.values(activityDays).filter((d) => d.steps != null).sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => ({ date: d.date, steps: d.steps })),
    meals: meals.map((m) => ({ date: m.date, meal: m.meal, name: m.foodName })),
    bodyShared: st.shareBody
  };
  if (st.shareBody) {
    const [w, bm] = await Promise.all([
      Weight.find({ user: teenId }).sort({ date: -1 }).limit(8).select('date weight').lean(),
      BodyMetric.findOne({ user: teenId }).sort({ date: -1 }).lean()
    ]);
    out.body = { weights: w.map((x) => ({ date: x.date, weight: x.weight })), measurements: bm ? Object.fromEntries(Object.entries(bm).filter(([k, v]) => k === 'date' || (/Cm$/.test(k) && k !== 'heightCm' && v != null))) : null };
  }
  return out;
}

module.exports = { bmiForAge, ageMonths, teenStatus, parentView, CONTENT, FLAG_PERCENTILE };
