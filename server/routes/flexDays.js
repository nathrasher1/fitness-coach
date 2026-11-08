const express = require('express');
const FlexDay = require('../models/FlexDay');
const FoodLog = require('../models/FoodLog');
const Weight = require('../models/Weight');
const Settings = require('../models/Settings');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { localToday, isDateKey, shiftKey } = require('../services/dates');
const FD = require('../services/flexDays');
const FE = require('../services/flexEstimator');
const { userGroup } = require('../services/age');

const router = express.Router();
router.use(requireAuth);

async function flexSettings(userId) {
  const s = await Settings.findOne({ user: userId }).select('flexDaysPerMonth flexBufferOptIn flexCorrection').lean();
  return { cap: FD.normalizeCap(s && s.flexDaysPerMonth), bufferOptIn: !!(s && s.flexBufferOptIn), correction: (s && s.flexCorrection) || 1 };
}
async function groupOf(req) {
  const user = await User.findById(req.session.userId).select('+dob');
  return userGroup(user, localToday(req));
}
// Baseline from the last 60 days of food logs (other flex days excluded).
async function baselineFor(userId, today, minor) {
  const from = shiftKey(today, -60);
  const [logs, flex] = await Promise.all([
    FoodLog.find({ user: userId, date: { $gte: from, $lte: today } }).select('date meal calories foodName amount amountUnit').lean(),
    FlexDay.find({ user: userId, date: { $gte: from, $lte: today } }).select('date').lean()
  ]);
  return FE.computeBaseline(logs, { minor, excludeDates: new Set(flex.map((f) => f.date)) });
}
function view(r) {
  return {
    id: String(r._id), date: r.date, label: r.label || '', holidayKey: r.holidayKey || '',
    foods: r.foods || [], fullness: r.fullness, plates: r.plates, dessertServings: r.dessertServings,
    estimateKcal: r.estimateKcal, estimateLow: r.estimateLow, estimateHigh: r.estimateHigh,
    confidence: r.confidence, baselineSource: r.baselineSource, correctionUsed: r.correctionUsed
  };
}

// Basic calibration: for flex days 3–10 days old with ≥3 weigh-ins after, compare the observed
// trend change with the predicted surplus and update the bounded per-user correction factor.
async function calibrate(userId, today) {
  const due = await FlexDay.find({ user: userId, calibratedAt: null, estimateKcal: { $gt: 0 }, date: { $lte: shiftKey(today, -3), $gte: shiftKey(today, -14) } }).lean();
  if (!due.length) return null;
  let { correction } = await flexSettings(userId);
  let changed = false;
  for (const f of due) {
    const weights = await Weight.find({ user: userId, date: { $gte: shiftKey(f.date, -7), $lte: shiftKey(f.date, 7) } }).sort({ date: 1 }).select('date weight').lean();
    const td = FE.trendDelta(weights, f.date);
    const stale = f.date < shiftKey(today, -10);
    if (!td && !stale) continue;
    if (td) {
      const r = FE.calibrate({ predictedSurplus: f.estimateKcal - (f.baselineDaily || FE.POP.daily), observedDeltaLbs: td.deltaLbs, previous: correction, weighIns: td.weighIns });
      if (r.applied) { correction = r.factor; changed = true; }
    }
    await FlexDay.updateOne({ _id: f._id }, { $set: { calibratedAt: new Date() } });
  }
  if (changed) await Settings.updateOne({ user: userId }, { $set: { flexCorrection: correction, updatedAt: new Date() } }, { upsert: true, setDefaultsOnInsert: true });
  return correction;
}

// GET /api/flex-days?month=YYYY-MM
router.get('/', async (req, res) => {
  try {
    const today = localToday(req);
    await calibrate(req.session.userId, today).catch((e) => console.error('flex calibrate', e.message));
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : FD.monthKey(today);
    const bounds = FD.monthBounds(month + '-01');
    const st = await flexSettings(req.session.userId);
    const rows = await FlexDay.find({ user: req.session.userId, date: { $gte: bounds.start, $lte: bounds.end } }).sort({ date: 1 }).lean();
    const minor = (await groupOf(req)) !== 'adult';
    res.json({
      month, cap: st.cap, used: rows.length, remaining: Math.max(0, st.cap - rows.length),
      bufferOptIn: minor ? false : st.bufferOptIn, correction: st.correction, minor,
      menu: FE.HOLIDAY_MENU.map(({ key, label, category }) => ({ key, label, category })),
      fullness: Object.keys(FE.FULLNESS),
      holidays: FD.holidayPresets(Number(month.slice(0, 4))),
      days: rows.map(view)
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load flex days' }); }
});

// GET /api/flex-days/holidays?year=2026
router.get('/holidays', (req, res) => {
  const year = parseInt(req.query.year, 10) || Number(localToday(req).slice(0, 4));
  res.json({ year, holidays: FD.holidayPresets(year) });
});

// GET /api/flex-days/baseline – your typical big meal / day, used by the estimator
router.get('/baseline', async (req, res) => {
  try {
    const minor = (await groupOf(req)) !== 'adult';
    res.json(await baselineFor(req.session.userId, localToday(req), minor));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load baseline' }); }
});

async function runEstimate(req) {
  const b = req.body || {};
  const today = localToday(req);
  const minor = (await groupOf(req)) !== 'adult';
  const [baseline, st] = await Promise.all([baselineFor(req.session.userId, today, minor), flexSettings(req.session.userId)]);
  const est = FE.estimate({ foods: b.foods, fullness: b.fullness, plates: b.plates, dessertServings: b.dessertServings, baseline, correction: st.correction });
  return { est, baseline, minor };
}

// POST /api/flex-days/estimate – preview only (nothing saved)
router.post('/estimate', async (req, res) => {
  try {
    const { est, baseline } = await runEstimate(req);
    res.json({ ...est, baselineDaily: baseline.daily });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to estimate' }); }
});

// PUT /api/flex-days/settings { flexDaysPerMonth, flexBufferOptIn }
router.put('/settings', async (req, res) => {
  try {
    const b = req.body || {};
    const $set = { updatedAt: new Date() };
    if (b.flexDaysPerMonth !== undefined) $set.flexDaysPerMonth = FD.normalizeCap(b.flexDaysPerMonth);
    // Minors never get buffer/compensation math; always stored off.
    if (b.flexBufferOptIn !== undefined) $set.flexBufferOptIn = (await groupOf(req)) === 'adult' ? !!b.flexBufferOptIn : false;
    await Settings.updateOne({ user: req.session.userId }, { $set }, { upsert: true, setDefaultsOnInsert: true });
    const st = await flexSettings(req.session.userId);
    res.json({ flexDaysPerMonth: st.cap, flexBufferOptIn: st.bufferOptIn });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save flex settings' }); }
});

// POST /api/flex-days { date, label?, holidayKey?, foods[], fullness, plates, dessertServings }
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (!isDateKey(b.date)) return res.status(400).json({ error: 'Pick a valid date' });
    const { cap } = await flexSettings(req.session.userId);
    const bounds = FD.monthBounds(b.date);
    const existing = await FlexDay.findOne({ user: req.session.userId, date: b.date }).lean();
    const count = await FlexDay.countDocuments({ user: req.session.userId, date: { $gte: bounds.start, $lte: bounds.end } });
    const gate = FD.canAddFlex({ existingCount: count, cap, alreadyMarked: !!existing });
    if (!gate.ok) return res.status(409).json({ error: gate.reason });
    const { est, baseline } = await runEstimate(req);
    const $set = {
      label: String(b.label || '').trim().slice(0, 80), holidayKey: String(b.holidayKey || '').trim().slice(0, 40),
      foods: est.items.map(({ key, label, category, nudge, kcal, grams }) => ({ key, label, category, nudge, kcal, grams })),
      fullness: est.fullness, plates: est.plates, dessertServings: est.dessertServings,
      estimateKcal: est.kcal, estimateLow: est.low, estimateHigh: est.high, confidence: est.confidence,
      baselineBigMeal: baseline.bigMeal, baselineDaily: baseline.daily, baselineSource: baseline.source,
      correctionUsed: est.correction, calibratedAt: null, updatedAt: new Date()
    };
    const doc = await FlexDay.findOneAndUpdate({ user: req.session.userId, date: b.date }, { $set, $setOnInsert: { createdAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    res.status(existing ? 200 : 201).json({ ...view(doc), estimateLabel: est.label });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save flex day' }); }
});

// DELETE /api/flex-days/:date
router.delete('/:date', async (req, res) => {
  try {
    if (!isDateKey(req.params.date)) return res.status(400).json({ error: 'Invalid date' });
    await FlexDay.deleteOne({ user: req.session.userId, date: req.params.date });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Failed to remove flex day' }); }
});

module.exports = router;
