const express = require('express');
const CalorieLog = require('../models/CalorieLog');
const { requireAuth } = require('../middleware/auth');

const { localToday, daysAgoKey, shiftKey, isDateKey } = require('../services/dates');
const router = express.Router();
router.use(requireAuth);

// GET /api/calories?days=30
router.get('/', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const cutoffStr = daysAgoKey(req, days);

    const logs = await CalorieLog.find({
      user: req.session.userId,
      date: { $gte: cutoffStr }
    }).sort({ date: -1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load calorie logs' });
  }
});

// POST /api/calories
router.post('/', async (req, res) => {
  try {
    const { date, calories, note } = req.body;
    if (!date || calories == null) {
      return res.status(400).json({ error: 'date and calories are required' });
    }

    const entry = await CalorieLog.findOneAndUpdate(
      { user: req.session.userId, date },
      { calories: Number(calories), note: note || '' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save calorie log' });
  }
});

// DELETE /api/calories/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await CalorieLog.deleteOne({ _id: req.params.id, user: req.session.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
