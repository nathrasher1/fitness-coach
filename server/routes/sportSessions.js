const express = require('express');
const SportSession = require('../models/SportSession');
const Settings = require('../models/Settings');
const Weight = require('../models/Weight');
const { requireAuth } = require('../middleware/auth');
const { localToday, isDateKey, shiftKey } = require('../services/dates');
const SS = require('../services/sportSessions');

const router = express.Router();
router.use(requireAuth);

async function latestWeightLbs(userId, date) {
  const w = await Weight.findOne({ user: userId, date: { $lte: date } }).sort({ date: -1 }).select('weight').lean();
  return w && w.weight;
}

function view(s) {
  return {
    id: String(s._id),
    date: s.date,
    sport: s.sport,
    durationMin: s.durationMin,
    effort: s.effort,
    trainingLoad: s.trainingLoad,
    activeKcal: s.activeKcal,
    notes: s.notes || '',
    drills: s.drills || ''
  };
}

// GET /api/sport-sessions?from=&to=&limit=
router.get('/', async (req, res) => {
  try {
    const today = localToday(req);
    const to = isDateKey(req.query.to) ? req.query.to : today;
    const from = isDateKey(req.query.from) ? req.query.from : shiftKey(to, -30);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const rows = await SportSession.find({ user: req.session.userId, date: { $gte: from, $lte: to } })
      .sort({ date: -1, createdAt: -1 }).limit(limit).lean();
    res.json({ presets: SS.SPORT_PRESETS, sessions: rows.map(view) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load sport sessions' }); }
});

// GET /api/sport-sessions/presets
router.get('/presets', (_req, res) => {
  res.json({ presets: SS.SPORT_PRESETS });
});

// PUT /api/sport-sessions/practice-days { practiceDays: [0-6] }
router.put('/practice-days', async (req, res) => {
  try {
    const days = SS.normalizePracticeDays((req.body || {}).practiceDays);
    if (!days) return res.status(400).json({ error: 'practiceDays must be weekdays 0-6' });
    await Settings.updateOne(
      { user: req.session.userId },
      { $set: { practiceDays: days, updatedAt: new Date() } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ practiceDays: days });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save practice days' }); }
});

// POST /api/sport-sessions
router.post('/', async (req, res) => {
  try {
    const n = SS.normalizeSession(req.body || {});
    if (n.error) return res.status(400).json({ error: n.error });
    const weightLbs = await latestWeightLbs(req.session.userId, n.date);
    const activeKcal = SS.estimateActiveKcal({
      sport: n.sport,
      durationMin: n.durationMin,
      effort: n.effort,
      weightLbs
    });
    const doc = await SportSession.create({
      user: req.session.userId,
      date: n.date,
      sport: n.sport,
      durationMin: n.durationMin,
      effort: n.effort,
      trainingLoad: n.trainingLoad,
      activeKcal,
      notes: n.notes,
      drills: n.drills
    });
    res.status(201).json(view(doc));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save session' }); }
});

// DELETE /api/sport-sessions/:id
router.delete('/:id', async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const r = await SportSession.deleteOne({ _id: req.params.id, user: req.session.userId });
    if (!r.deletedCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete session' }); }
});

module.exports = router;
