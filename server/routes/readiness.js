const express = require('express');
const ReadinessLog = require('../models/ReadinessLog');
const { requireAuth } = require('../middleware/auth');
const { localToday, isDateKey, shiftKey } = require('../services/dates');
const R = require('../services/readiness');

const router = express.Router();
router.use(requireAuth);

// GET /api/readiness?from=&to=
router.get('/', async (req, res) => {
  try {
    const today = localToday(req);
    const to = isDateKey(req.query.to) ? req.query.to : today;
    const from = isDateKey(req.query.from) ? req.query.from : shiftKey(to, -14);
    const rows = await ReadinessLog.find({ user: req.session.userId, date: { $gte: from, $lte: to } })
      .sort({ date: 1 }).lean();
    res.json({ today, logs: rows.map(R.view), fields: R.FIELDS, labels: R.LABELS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load readiness' });
  }
});

// PUT /api/readiness/:date
router.put('/:date', async (req, res) => {
  try {
    const date = req.params.date;
    const n = R.normalize(req.body || {}, date);
    if (n.error) return res.status(400).json({ error: n.error });
    const doc = await ReadinessLog.findOneAndUpdate(
      { user: req.session.userId, date: n.date },
      {
        $set: {
          sleep: n.sleep,
          soreness: n.soreness,
          mood: n.mood,
          energy: n.energy,
          notes: n.notes,
          updatedAt: new Date()
        },
        $setOnInsert: { user: req.session.userId, date: n.date, createdAt: new Date() }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    res.json(R.view(doc));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save check-in' });
  }
});

// DELETE /api/readiness/:date
router.delete('/:date', async (req, res) => {
  try {
    if (!isDateKey(req.params.date)) return res.status(400).json({ error: 'Pick a valid date' });
    const r = await ReadinessLog.deleteOne({ user: req.session.userId, date: req.params.date });
    if (!r.deletedCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete check-in' });
  }
});

module.exports = router;
