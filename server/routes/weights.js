const express = require('express');
const Weight = require('../models/Weight');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/weights?days=30
router.get('/', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const weights = await Weight.find({
      user: req.session.userId,
      date: { $gte: cutoffStr }
    }).sort({ date: -1 });

    res.json(weights);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load weights' });
  }
});

// POST /api/weights
router.post('/', async (req, res) => {
  try {
    const { date, weight, note } = req.body;
    if (!date || weight == null) {
      return res.status(400).json({ error: 'date and weight are required' });
    }

    const entry = await Weight.findOneAndUpdate(
      { user: req.session.userId, date },
      { weight: Number(weight), note: note || '' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save weight' });
  }
});

// DELETE /api/weights/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await Weight.deleteOne({ _id: req.params.id, user: req.session.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
