const express = require('express');
const FlexDay = require('../models/FlexDay');
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');
const { localToday, isDateKey } = require('../services/dates');
const FD = require('../services/flexDays');
const { userGroup } = require('../services/age');
const User = require('../models/User');

const router = express.Router();
router.use(requireAuth);

async function monthCap(userId) {
  const s = await Settings.findOne({ user: userId }).select('flexDaysPerMonth flexBufferOptIn').lean();
  return {
    cap: FD.normalizeCap(s && s.flexDaysPerMonth),
    bufferOptIn: !!(s && s.flexBufferOptIn)
  };
}

// GET /api/flex-days?month=YYYY-MM  (defaults to current month of local today)
router.get('/', async (req, res) => {
  try {
    const today = localToday(req);
    const month = (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) ? req.query.month : FD.monthKey(today);
    const bounds = FD.monthBounds(month + '-01');
    const { cap, bufferOptIn } = await monthCap(req.session.userId);
    const rows = await FlexDay.find({ user: req.session.userId, date: { $gte: bounds.start, $lte: bounds.end } }).sort({ date: 1 }).lean();
    const year = Number(month.slice(0, 4));
    res.json({
      month,
      cap,
      used: rows.length,
      remaining: Math.max(0, cap - rows.length),
      bufferOptIn,
      presets: FD.ESTIMATE_PRESETS,
      holidays: FD.holidayPresets(year).filter((h) => h.date.startsWith(month) || h.date.slice(0, 4) === String(year)),
      days: rows.map((r) => ({
        id: String(r._id),
        date: r.date,
        label: r.label || '',
        holidayKey: r.holidayKey || '',
        estimate: r.estimate,
        addKcal: r.addKcal || 0
      }))
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load flex days' }); }
});

// GET /api/flex-days/holidays?year=2026
router.get('/holidays', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || Number(localToday(req).slice(0, 4));
    res.json({ year, holidays: FD.holidayPresets(year) });
  } catch (err) { res.status(500).json({ error: 'Failed to load holidays' }); }
});

// PUT /api/flex-days/settings { flexDaysPerMonth, flexBufferOptIn }
router.put('/settings', async (req, res) => {
  try {
    const b = req.body || {};
    const $set = { updatedAt: new Date() };
    if (b.flexDaysPerMonth !== undefined) $set.flexDaysPerMonth = FD.normalizeCap(b.flexDaysPerMonth);
    if (b.flexBufferOptIn !== undefined) {
      const user = await User.findById(req.session.userId).select('+dob');
      const group = userGroup(user, localToday(req));
      // Minors never get buffer math; silently store false.
      $set.flexBufferOptIn = group === 'adult' ? !!b.flexBufferOptIn : false;
    }
    await Settings.updateOne({ user: req.session.userId }, { $set }, { upsert: true, setDefaultsOnInsert: true });
    const { cap, bufferOptIn } = await monthCap(req.session.userId);
    res.json({ flexDaysPerMonth: cap, flexBufferOptIn: bufferOptIn });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save flex settings' }); }
});

// POST /api/flex-days { date, label?, holidayKey?, estimate?, addKcal? }
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const date = isDateKey(b.date) ? b.date : null;
    if (!date) return res.status(400).json({ error: 'Pick a valid date' });
    const est = FD.normalizeEstimate(b);
    const label = String(b.label || '').trim().slice(0, 80);
    const holidayKey = String(b.holidayKey || '').trim().slice(0, 40);
    const { cap } = await monthCap(req.session.userId);
    const bounds = FD.monthBounds(date);
    const existing = await FlexDay.findOne({ user: req.session.userId, date }).lean();
    const count = await FlexDay.countDocuments({ user: req.session.userId, date: { $gte: bounds.start, $lte: bounds.end } });
    const gate = FD.canAddFlex({ existingCount: count, cap, alreadyMarked: !!existing });
    if (!gate.ok) return res.status(409).json({ error: gate.reason });

    const doc = await FlexDay.findOneAndUpdate(
      { user: req.session.userId, date },
      {
        $set: {
          label,
          holidayKey,
          estimate: est.estimate,
          addKcal: est.addKcal,
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(existing ? 200 : 201).json({
      id: String(doc._id),
      date: doc.date,
      label: doc.label,
      holidayKey: doc.holidayKey,
      estimate: doc.estimate,
      addKcal: doc.addKcal
    });
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
