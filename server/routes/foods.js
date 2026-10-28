const express = require('express');
const Food = require('../models/Food');
const FoodLog = require('../models/FoodLog');
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

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

    if (q) {
      filter.$and = [
        {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { brand: { $regex: q, $options: 'i' } }
          ]
        }
      ];
    }

    const foods = await Food.find(filter).sort({ name: 1 }).limit(limit);
    res.json(foods);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search foods' });
  }
});

// GET /api/foods/recent – most frequently logged foods (last 30 days)
router.get('/recent', async (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

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
