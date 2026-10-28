const express = require('express');
const Weight = require('../models/Weight');
const FoodLog = require('../models/FoodLog');
const { requireAuth } = require('../middleware/auth');
const { computeCalorieRecommendation } = require('../services/recommendations');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const weights = await Weight.find({
      user: req.session.userId,
      date: { $gte: cutoffStr }
    }).sort({ date: 1 });

    let avg = null;
    let change = null;
    if (weights.length) {
      avg = weights.reduce((s, w) => s + w.weight, 0) / weights.length;
      if (weights.length >= 2) {
        change = weights[weights.length - 1].weight - weights[0].weight;
      }
    }

    const absoluteLatest = await Weight.findOne({ user: req.session.userId }).sort({ date: -1 });
    const recommendation = await computeCalorieRecommendation(req.session.userId);

    const todayLogs = await FoodLog.find({ user: req.session.userId, date: today });
    const todayTotals = todayLogs.reduce(
      (acc, l) => {
        acc.calories += l.calories;
        acc.protein += l.protein;
        acc.carbs += l.carbs;
        acc.fat += l.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    res.json({
      periodDays: days,
      latestWeight: absoluteLatest,
      periodAvg: avg,
      periodChange: change,
      weighInCount: weights.length,
      recommendation,
      todayTotals,
      today
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
