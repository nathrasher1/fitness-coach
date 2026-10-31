const express = require('express');
const RestDay = require('../models/RestDay');
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');
const { localToday } = require('../services/dates');
const { streakFor } = require('../services/streak');

const router = express.Router();
router.use(requireAuth);

// GET /api/streak – streak, this week's rest allowance and the explanation text
router.get('/', async (req, res) => {
  try { res.json(await streakFor(req.session.userId, localToday(req))); } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load streak' }); }
});

// POST /api/streak/rest-day – take today (local) as an unplanned rest day
router.post('/rest-day', async (req, res) => {
  try {
    const today = localToday(req);
    const st = await streakFor(req.session.userId, today);
    if (st.todayRest) return res.json(st);
    if (st.todayDone) return res.status(409).json({ error: "You've already trained today" });
    if (st.plannedRestToday) return res.status(409).json({ error: "Today is already a planned rest day. It won't break your streak" });
    if (!st.canTakeRest) return res.status(409).json({ error: st.skipsPerWeek ? "You've used this week's rest days" : 'Extra rest days are turned off in your schedule' });
    await RestDay.updateOne({ user: req.session.userId, date: today }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    res.status(201).json(await streakFor(req.session.userId, today));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save rest day' }); }
});

// DELETE /api/streak/rest-day – undo today's rest day
router.delete('/rest-day', async (req, res) => {
  try {
    const today = localToday(req);
    await RestDay.deleteOne({ user: req.session.userId, date: today });
    res.json(await streakFor(req.session.userId, today));
  } catch (err) { res.status(500).json({ error: 'Failed to undo rest day' }); }
});

// PUT /api/streak/schedule { trainingDays: [0-6], restDaysPerWeek: 0-6 | null, restSkipsPerWeek: 0-2 }
router.put('/schedule', async (req, res) => {
  try {
    const b = req.body || {};
    const $set = { updatedAt: new Date() };
    if (b.trainingDays !== undefined) {
      if (!Array.isArray(b.trainingDays) || b.trainingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return res.status(400).json({ error: 'Training days must be weekdays 0-6' });
      $set.trainingDays = [...new Set(b.trainingDays)].sort();
    }
    if (b.restDaysPerWeek !== undefined) {
      if (b.restDaysPerWeek !== null && !(Number.isInteger(b.restDaysPerWeek) && b.restDaysPerWeek >= 0 && b.restDaysPerWeek <= 6)) return res.status(400).json({ error: 'Rest days per week must be 0-6' });
      $set.restDaysPerWeek = b.restDaysPerWeek;
    }
    if (b.restSkipsPerWeek !== undefined) {
      if (!(Number.isInteger(b.restSkipsPerWeek) && b.restSkipsPerWeek >= 0 && b.restSkipsPerWeek <= 2)) return res.status(400).json({ error: 'Extra rest days must be 0-2' });
      $set.restSkipsPerWeek = b.restSkipsPerWeek;
    }
    await Settings.updateOne({ user: req.session.userId }, { $set }, { upsert: true, setDefaultsOnInsert: true });
    res.json(await streakFor(req.session.userId, localToday(req)));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save schedule' }); }
});

module.exports = router;
