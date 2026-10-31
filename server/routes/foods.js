const express = require('express');
const Food = require('../models/Food');
const FoodLog = require('../models/FoodLog');
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');
const { queryTokens, tokenFilter, rankFood } = require('../services/foodCatalog');

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
  const size = Number(food.servingSize) || 1;
  const unit = (food.servingUnit || '').toLowerCase();
  const grams = unit === 'oz' ? size * 28.3495 : unit === 'g' || unit === 'gram' || unit === 'grams' ? size : 0;
  if (!grams) return false;
  if (food.calories / grams > 10) return true;
  return grams <= 1 && food.calories >= 20;
}

function fromOpenFoodFacts(p, code) {
  const n = p.nutriments || {};
  const per100 = n['energy-kcal_100g'];
  if (per100 == null && n['energy-kcal_serving'] == null) return null;

  if (per100 != null) {
    return {
      user: null,
      name: (p.product_name || p.product_name_en || 'Scanned food').trim(),
      brand: (p.brands || '').split(',')[0].trim(),
      servingSize: 100,
      servingUnit: 'g',
      calories: Math.round(num(per100)),
      protein: round1(num(n.proteins_100g)),
      carbs: round1(num(n.carbohydrates_100g)),
      fat: round1(num(n.fat_100g)),
      fiber: round1(num(n.fiber_100g)),
      sugar: round1(num(n.sugars_100g)),
      sodium: Math.round(num(n.sodium_100g) * 1000),
      barcode: code,
      isPublic: true
    };
  }

  const qty = Number(p.serving_quantity) || 100;
  return {
    user: null,
    name: (p.product_name || p.product_name_en || 'Scanned food').trim(),
    brand: (p.brands || '').split(',')[0].trim(),
    servingSize: qty,
    servingUnit: 'g',
    calories: Math.round(num(n['energy-kcal_serving'])),
    protein: round1(num(n.proteins_serving)),
    carbs: round1(num(n.carbohydrates_serving)),
    fat: round1(num(n.fat_serving)),
    fiber: round1(num(n.fiber_serving)),
    sugar: round1(num(n.sugars_serving)),
    sodium: Math.round(num(n.sodium_serving) * 1000),
    barcode: code,
    isPublic: true
  };
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
router.post('/', async (req, res) => {
  try {
    const { name, brand, servingSize, servingUnit, calories, protein, carbs, fat, fiber } = req.body;
    if (!name || calories == null) {
      return res.status(400).json({ error: 'name and calories are required' });
    }

    const food = await Food.create({
      user: req.session.userId,
      name: name.trim(),
      brand: brand || '',
      servingSize: servingSize || 1,
      servingUnit: servingUnit || 'serving',
      calories: Number(calories),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      fiber: Number(fiber) || 0
    });

    res.status(201).json(food);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create food' });
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
