const express = require('express');
const Food = require('../models/Food');
const FoodLog = require('../models/FoodLog');
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');
const { queryTokens, tokenFilter, rankFood } = require('../services/foodCatalog');
const { measure, parseServingText, isWeightUnit } = require('../services/portions');
const Servings = require('../../client/lib/servings');

const { localToday, daysAgoKey, shiftKey, isDateKey } = require('../services/dates');
const router = express.Router();
router.use(requireAuth);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function isBadBarcodeFood(food) {
  if (!food) return false;
  const grams = measure(food).grams;
  if (!grams) return false;
  if (food.calories / grams > 10) return true;
  return grams <= 1 && food.calories >= 20;
}

const HOUSEHOLD = new Set(['tbsp', 'tsp', 'cup', 'fl oz']);

/**
 * Open Food Facts gives nutrition per 100 g (or 100 mL) plus the label serving.
 * Store ONE label serving (e.g. "2 tbsp = 30 mL") with nutrition scaled to it, so
 * "serving" means the label serving and g/oz/mL are real amounts.
 */
function fromOpenFoodFacts(p, code) {
  const n = p.nutriments || {};
  const per100 = n['energy-kcal_100g'];
  if (per100 == null && n['energy-kcal_serving'] == null) return null;

  const base = {
    user: null,
    name: (p.product_name || p.product_name_en || 'Scanned food').trim(),
    brand: (p.brands || '').split(',')[0].trim(),
    barcode: code,
    isPublic: true
  };
  const parsed = parseServingText(p.serving_size);
  let qty = Number(p.serving_quantity) || 0;
  let qtyUnit = String(p.serving_quantity_unit || '').toLowerCase();
  if (!qtyUnit) qtyUnit = parsed.ml && !parsed.grams ? 'ml' : 'g';
  if (!qty) qty = qtyUnit === 'ml' ? parsed.ml || 0 : parsed.grams || 0;

  // Serving description: household unit when the label has one, else the weight/volume itself.
  const serving = {};
  if (qty > 0) {
    if (parsed.unit && parsed.size > 0 && HOUSEHOLD.has(parsed.unit)) {
      Object.assign(serving, { servingSize: parsed.size, servingUnit: parsed.unit });
    } else if (parsed.unit && parsed.size > 0 && parsed.unit !== 'g' && parsed.unit !== 'ml' && parsed.unit.length <= 20) {
      Object.assign(serving, { servingSize: parsed.size, servingUnit: parsed.unit });
    } else {
      Object.assign(serving, { servingSize: Math.round(qty * 10) / 10, servingUnit: qtyUnit === 'ml' ? 'mL' : 'g' });
    }
    if (qtyUnit === 'ml') serving.mlPerServing = qty;
    else serving.gramsPerServing = qty;
    if (parsed.grams && qtyUnit === 'ml') serving.gramsPerServing = parsed.grams;
    if (parsed.ml && qtyUnit !== 'ml') serving.mlPerServing = parsed.ml;
  }

  if (per100 != null) {
    const f = qty > 0 ? qty / 100 : 1;
    return Object.assign(base, qty > 0 ? serving : { servingSize: 100, servingUnit: 'g', gramsPerServing: 100 }, {
      calories: Math.round(num(per100) * f),
      protein: round1(num(n.proteins_100g) * f),
      carbs: round1(num(n.carbohydrates_100g) * f),
      fat: round1(num(n.fat_100g) * f),
      fiber: round1(num(n.fiber_100g) * f),
      sugar: round1(num(n.sugars_100g) * f),
      sodium: Math.round(num(n.sodium_100g) * 1000 * f)
    });
  }

  return Object.assign(base, qty > 0 ? serving : { servingSize: 1, servingUnit: 'serving' }, {
    calories: Math.round(num(n['energy-kcal_serving'])),
    protein: round1(num(n.proteins_serving)),
    carbs: round1(num(n.carbohydrates_serving)),
    fat: round1(num(n.fat_serving)),
    fiber: round1(num(n.fiber_serving)),
    sugar: round1(num(n.sugars_serving)),
    sodium: Math.round(num(n.sodium_serving) * 1000)
  });
}

// GET /api/foods/barcode/:code – local cache, then Open Food Facts
router.get('/barcode/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').replace(/\D/g, '');
    if (code.length < 8 || code.length > 14) {
      return res.status(400).json({ error: 'Enter a valid barcode' });
    }

    const existing = await Food.findOne({ barcode: code });
    if (existing && !isBadBarcodeFood(existing)) {
      return res.json({ found: true, source: 'cache', food: existing });
    }

    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
      headers: { 'User-Agent': 'FitnessCoach/1.0 (personal nutrition tracker)' }
    });
    if (!response.ok) return res.json({ found: false });
    const data = await response.json();
    if (!data || data.status !== 1 || !data.product) return res.json({ found: false });

    const payload = fromOpenFoodFacts(data.product, code);
    if (!payload) return res.json({ found: false });

    const food = existing
      ? await Food.findByIdAndUpdate(existing._id, payload, { new: true })
      : await Food.create(payload);

    res.json({ found: true, source: 'openfoodfacts', food });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Barcode lookup failed' });
  }
});

// GET /api/foods?q=chicken&limit=20
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 50);

    const filter = {
      $or: [
        { user: null },
        { user: req.session.userId },
        { isPublic: true }
      ]
    };

    if (!q) {
      const foods = await Food.find(filter).sort({ name: 1 }).limit(limit);
      return res.json(foods);
    }

    // Every word must match the name or brand (case-insensitive, partial), then rank.
    const tokens = queryTokens(q.slice(0, 80));
    if (!tokens.length) return res.json([]);
    filter.$and = tokenFilter(tokens);
    const candidates = await Food.find(filter).sort({ name: 1 }).limit(400).lean();
    const foods = candidates
      .map((f) => ({ f, s: rankFood(f, q, tokens) - (f.user && String(f.user) === String(req.session.userId) ? 3 : 0) }))
      .sort((a, b) => a.s - b.s || a.f.name.length - b.f.name.length || a.f.name.localeCompare(b.f.name))
      .slice(0, limit)
      .map((x) => x.f);
    res.json(foods);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search foods' });
  }
});

// GET /api/foods/recent – most frequently logged foods (last 30 days)
router.get('/recent', async (req, res) => {
  try {
    const cutoffStr = daysAgoKey(req, 30);

    const recent = await FoodLog.aggregate([
      {
        $match: {
          user: new (require('mongoose').Types.ObjectId)(req.session.userId),
          date: { $gte: cutoffStr }
        }
      },
      {
        $group: {
          _id: '$food',
          foodName: { $first: '$foodName' },
          count: { $sum: 1 },
          lastUsed: { $max: '$date' }
        }
      },
      { $sort: { count: -1, lastUsed: -1 } },
      { $limit: 12 }
    ]);

    // Attach full food docs where possible
    const foodIds = recent.map((r) => r._id).filter(Boolean);
    const foods = await Food.find({ _id: { $in: foodIds } });
    const foodMap = Object.fromEntries(foods.map((f) => [f._id.toString(), f]));

    const result = recent.map((r) => {
      const food = foodMap[r._id?.toString()];
      return {
        _id: r._id,
        name: food?.name || r.foodName,
        brand: food?.brand || '',
        calories: food?.calories ?? null,
        protein: food?.protein ?? 0,
        carbs: food?.carbs ?? 0,
        fat: food?.fat ?? 0,
        servingSize: food?.servingSize ?? 1,
        servingUnit: food?.servingUnit ?? 'serving',
        timesLogged: r.count
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load recent foods' });
  }
});

// GET /api/foods/favorites
router.get('/favorites', async (req, res) => {
  try {
    let settings = await Settings.findOne({ user: req.session.userId });
    if (!settings || !settings.favoriteFoodIds?.length) {
      return res.json([]);
    }
    const foods = await Food.find({
      _id: { $in: settings.favoriteFoodIds },
      $or: [{ user: null }, { user: req.session.userId }]
    });
    res.json(foods);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load favorites' });
  }
});

// POST /api/foods/:id/favorite  – toggle favorite
router.post('/:id/favorite', async (req, res) => {
  try {
    const foodId = req.params.id;
    const food = await Food.findById(foodId);
    if (!food) return res.status(404).json({ error: 'Food not found' });
    if (food.user && food.user.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    let settings = await Settings.findOne({ user: req.session.userId });
    if (!settings) {
      settings = await Settings.create({ user: req.session.userId, favoriteFoodIds: [] });
    }

    const ids = settings.favoriteFoodIds.map((id) => id.toString());
    const idx = ids.indexOf(foodId);
    if (idx >= 0) {
      settings.favoriteFoodIds.splice(idx, 1);
    } else {
      settings.favoriteFoodIds.push(foodId);
    }
    settings.updatedAt = new Date();
    await settings.save();

    res.json({
      favorited: idx < 0,
      favoriteFoodIds: settings.favoriteFoodIds
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update favorite' });
  }
});

// POST /api/foods  (create custom food)
// Body: name, brand, servingSize + servingUnit (the label serving, e.g. 1 tbsp or 30 g),
// optional gramsPerServing / mlPerServing (what that serving weighs / holds), and the
// label's nutrition PER THAT SERVING.
function positive(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function foodFromBody(b) {
  const servingSize = positive(b.servingSize) || 1;
  const servingUnit = String(b.servingUnit || 'serving').trim().slice(0, 30) || 'serving';
  const unit = Servings.baseUnit(servingUnit);
  const out = {
    name: String(b.name || '').trim().slice(0, 120),
    brand: String(b.brand || '').trim().slice(0, 80),
    servingSize,
    servingUnit: unit === 'ml' ? 'mL' : servingUnit,
    gramsPerServing: positive(b.gramsPerServing),
    mlPerServing: positive(b.mlPerServing),
    calories: Math.max(0, num(b.calories)),
    protein: Math.max(0, num(b.protein)),
    carbs: Math.max(0, num(b.carbs)),
    fat: Math.max(0, num(b.fat)),
    fiber: Math.max(0, num(b.fiber))
  };
  // g/oz and volume units already say how much a serving is.
  if (isWeightUnit(unit)) out.gramsPerServing = null;
  if (Servings.isVolumeUnit(unit)) out.mlPerServing = null;
  return out;
}
function implausible(f) {
  const g = measure(f).grams;
  if (g && f.calories / g > 9.5) return `${f.calories} kcal in ${Servings.fmt(g)} g is more than pure fat. Check the serving size.`;
  if (g && f.protein + f.carbs + f.fat > g * 1.05) return 'Protein + carbs + fat weigh more than the serving. Check the serving size.';
  return null;
}

router.post('/', async (req, res) => {
  try {
    if (!req.body || !req.body.name || req.body.calories == null || req.body.calories === '') {
      return res.status(400).json({ error: 'name and calories are required' });
    }
    const fields = foodFromBody(req.body);
    const bad = implausible(fields);
    if (bad) return res.status(400).json({ error: bad });
    const food = await Food.create(Object.assign({ user: req.session.userId }, fields));
    res.status(201).json(food);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create food' });
  }
});

// PUT /api/foods/:id  (edit own custom food: serving size and label nutrition)
// Past log entries keep the calories they were saved with.
router.put('/:id', async (req, res) => {
  try {
    const food = await Food.findOne({ _id: req.params.id, user: req.session.userId });
    if (!food) return res.status(404).json({ error: 'Not found or not allowed' });
    const fields = foodFromBody(Object.assign(food.toObject(), req.body));
    if (!fields.name) return res.status(400).json({ error: 'name is required' });
    const bad = implausible(fields);
    if (bad) return res.status(400).json({ error: bad });
    Object.assign(food, fields);
    await food.save();
    res.json(food);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update food' });
  }
});

// DELETE /api/foods/:id  (only own custom foods)
router.delete('/:id', async (req, res) => {
  try {
    const result = await Food.deleteOne({
      _id: req.params.id,
      user: req.session.userId
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Not found or not allowed' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete food' });
  }
});

module.exports = router;
module.exports.fromOpenFoodFacts = fromOpenFoodFacts;
