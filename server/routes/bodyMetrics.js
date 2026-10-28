const express = require('express');
const BodyMetric = require('../models/BodyMetric');
const Weight = require('../models/Weight');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function calcBmi(weightLbs, heightCm) {
  if (!weightLbs || !heightCm) return null;
  const kg = weightLbs * 0.453592;
  const m = heightCm / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

// GET /api/body-metrics
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const metrics = await BodyMetric.find({ user: req.session.userId })
      .sort({ date: -1 })
      .limit(limit);
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load body metrics' });
  }
});

// GET /api/body-metrics/latest – includes BMI using latest weight
router.get('/latest', async (req, res) => {
  try {
    const metric = await BodyMetric.findOne({ user: req.session.userId }).sort({ date: -1 });
    const weight = await Weight.findOne({ user: req.session.userId }).sort({ date: -1 });
    const heightCm = metric?.heightCm || null;
    const bmi = calcBmi(weight?.weight, heightCm);
    res.json({ metric, latestWeightLbs: weight?.weight || null, bmi });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load latest metrics' });
  }
});

// POST /api/body-metrics
router.post('/', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const fields = [
      'bodyFatPct', 'heightCm', 'chestCm', 'shouldersCm', 'waistCm', 'hipsCm',
      'leftArmCm', 'rightArmCm', 'leftThighCm', 'rightThighCm', 'leftCalfCm', 'rightCalfCm', 'neckCm', 'note'
    ];
    const data = { user: req.session.userId, date };
    fields.forEach((f) => {
      if (req.body[f] != null && req.body[f] !== '') data[f] = Number(req.body[f]) || req.body[f];
    });
    if (req.body.note) data.note = String(req.body.note);

    // Upsert by user+date so re-logging same day updates
    const metric = await BodyMetric.findOneAndUpdate(
      { user: req.session.userId, date },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(metric);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save body metrics' });
  }
});

// DELETE /api/body-metrics/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await BodyMetric.deleteOne({ _id: req.params.id, user: req.session.userId });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
