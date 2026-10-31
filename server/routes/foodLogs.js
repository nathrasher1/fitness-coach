const express = require('express');
const FoodLog = require('../models/FoodLog');
const Food = require('../models/Food');
const { requireAuth } = require('../middleware/auth');
const { amountToServings, isWeightUnit, toGrams } = require('../services/portions');
const { computeCalorieRecommendation } = require('../services/recommendations');

const { localToday, daysAgoKey, shiftKey, isDateKey } = require('../services/dates');
const router = express.Router();
router.use(requireAuth);

function dayTotals(logs) {
  return logs.reduce(
    (acc, l) => {
      acc.calories += l.calories;
      acc.protein += l.protein;
      acc.carbs += l.carbs;
      acc.fat += l.fat;
      acc.fiber += l.fiber;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

// GET /api/food-logs?date=2026-10-23
router.get('/', async (req, res) => {
  try {
    const date = isDateKey(req.query.date) ? req.query.date : localToday(req);
    const logs = await FoodLog.find({
      user: req.session.userId,
      date
    }).sort({ createdAt: 1 });

    const totals = dayTotals(logs);

    // Attach recommendation targets so the UI can show remaining macros
    let targets = null;
    try {
      const rec = await computeCalorieRecommendation(req.session.userId, localToday(req));
      if (rec.ready) {
        targets = {
          calories: rec.targetDaily,
          protein: rec.macros.proteinG,
          carbs: rec.macros.carbsG,
          fat: rec.macros.fatG
        };
      }
    } catch (_) {
      // non-fatal
    }

    res.json({ logs, totals, targets, date });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load food logs' });
  }
});

// POST /api/food-logs
// Supports normal food logging OR manual blank entries:
//   { date, meal, foodId, servings }  – normal
//   { date, meal, manual: true, foodName, calories, protein, carbs, fat } – blank
router.post('/', async (req, res) => {
  try {
    const { date, meal, foodId, servings, amount, amountUnit, note, manual, foodName, calories, protein, carbs, fat, fiber } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    // Manual / blank calorie entry
    if (manual) {
      if (calories == null) {
        return res.status(400).json({ error: 'calories required for manual entry' });
      }
      const log = await FoodLog.create({
        user: req.session.userId,
        date,
        meal: meal || 'other',
        food: null,
        foodName: (foodName || 'Manual entry').trim(),
        servings: 1,
        calories: Math.round(Number(calories) || 0),
        protein: +(Number(protein) || 0).toFixed(1),
        carbs: +(Number(carbs) || 0).toFixed(1),
        fat: +(Number(fat) || 0).toFixed(1),
        fiber: +(Number(fiber) || 0).toFixed(1),
        note: note || '',
        isManual: true
      });
      return res.status(201).json(log);
    }

    if (!foodId) {
      return res.status(400).json({ error: 'foodId is required (or set manual: true)' });
    }

    const food = await Food.findById(foodId);
    if (!food) {
      return res.status(404).json({ error: 'Food not found' });
    }

    if (food.user && food.user.toString() !== req.session.userId && !food.isPublic) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const qtyFromAmount = amount != null
      ? amountToServings(Number(amount), amountUnit || 'serving', food)
      : null;
    const qty = qtyFromAmount != null ? qtyFromAmount : Number(servings) || 1;
    if (!qty || qty <= 0) {
      return res.status(400).json({ error: 'That unit does not match this food' });
    }
    const entryCalories = Math.round(food.calories * qty);
    if (isWeightUnit(food.servingUnit) && amount != null && isWeightUnit(amountUnit || 'g')) {
      const grams = (amountUnit || 'g') === 'oz' ? Number(amount) * 28.3495 : Number(amount);
      const kcalPerGram = grams > 0 ? entryCalories / grams : 0;
      if (kcalPerGram > 10) {
        return res.status(400).json({
          error: `That would be ${Math.round(kcalPerGram)} kcal per gram, which is not possible. Try again or log it manually.`
        });
      }
    }
    const log = await FoodLog.create({
      user: req.session.userId,
      date,
      meal: meal || 'other',
      food: food._id,
      foodName: food.name,
      servings: qty,
      amount: amount != null ? Number(amount) : null,
      amountUnit: amountUnit || '',
      calories: entryCalories,
      protein: +(food.protein * qty).toFixed(1),
      carbs: +(food.carbs * qty).toFixed(1),
      fat: +(food.fat * qty).toFixed(1),
      fiber: +(food.fiber * qty).toFixed(1),
      note: note || '',
      isManual: false
    });

    res.status(201).json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log food' });
  }
});

// POST /api/food-logs/copy-yesterday
router.post('/copy-yesterday', async (req, res) => {
  try {
    const targetDate = isDateKey(req.body.date) ? req.body.date : localToday(req);
    const sourceDate = shiftKey(targetDate, -1);

    const sourceLogs = await FoodLog.find({
      user: req.session.userId,
      date: sourceDate
    });

    if (!sourceLogs.length) {
      return res.status(404).json({ error: `No food logged on ${sourceDate}` });
    }

    // Avoid duplicating if user already has entries
    const existing = await FoodLog.countDocuments({
      user: req.session.userId,
      date: targetDate
    });
    if (existing > 0) {
      return res.status(409).json({
        error: 'Target date already has food entries. Clear them first or pick an empty day.'
      });
    }

    const created = [];
    for (const src of sourceLogs) {
      const log = await FoodLog.create({
        user: req.session.userId,
        date: targetDate,
        meal: src.meal,
        food: src.food,
        foodName: src.foodName,
        servings: src.servings,
        calories: src.calories,
        protein: src.protein,
        carbs: src.carbs,
        fat: src.fat,
        fiber: src.fiber,
        note: src.note
      });
      created.push(log);
    }

    res.status(201).json({
      copied: created.length,
      sourceDate,
      targetDate,
      logs: created
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to copy yesterday' });
  }
});

// PATCH /api/food-logs/:id  – update servings
router.patch('/:id', async (req, res) => {
  try {
    const log = await FoodLog.findOne({ _id: req.params.id, user: req.session.userId });
    if (!log) return res.status(404).json({ error: 'Not found' });

    const servings = Number(req.body.servings);
    if (!servings || servings <= 0) {
      return res.status(400).json({ error: 'servings must be > 0' });
    }

    // Scale from original per-serving values
    const perServing = {
      calories: log.calories / log.servings,
      protein: log.protein / log.servings,
      carbs: log.carbs / log.servings,
      fat: log.fat / log.servings,
      fiber: log.fiber / log.servings
    };

    log.servings = servings;
    log.calories = Math.round(perServing.calories * servings);
    log.protein = +(perServing.protein * servings).toFixed(1);
    log.carbs = +(perServing.carbs * servings).toFixed(1);
    log.fat = +(perServing.fat * servings).toFixed(1);
    log.fiber = +(perServing.fiber * servings).toFixed(1);
    if (req.body.meal) log.meal = req.body.meal;
    if (req.body.note != null) log.note = req.body.note;

    await log.save();
    res.json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update log' });
  }
});

// DELETE /api/food-logs/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await FoodLog.deleteOne({ _id: req.params.id, user: req.session.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
