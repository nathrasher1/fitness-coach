const express = require('express');
const Recipe = require('../models/Recipe');
const Food = require('../models/Food');
const { requireAuth } = require('../middleware/auth');
const { amountToServings } = require('../services/portions');

const router = express.Router();
router.use(requireAuth);

function round1(n) {
  return +Number(n || 0).toFixed(1);
}

async function resolveIngredients(raw, userId) {
  if (!Array.isArray(raw) || !raw.length) {
    throw Object.assign(new Error('Add at least one ingredient'), { status: 400 });
  }
  const ingredients = [];
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  for (const item of raw) {
    const food = await Food.findById(item.foodId);
    if (!food) {
      throw Object.assign(new Error('One of the foods was not found'), { status: 400 });
    }
    const owned = !food.user || food.user.toString() === String(userId);
    if (!owned && !food.isPublic) {
      throw Object.assign(new Error(`Cannot use private food: ${food.name}`), { status: 403 });
    }
    const qty = amountToServings(Number(item.amount) || 0, item.unit || 'g', food);
    if (!(qty > 0)) {
      throw Object.assign(new Error(`Amount required for ${food.name}`), { status: 400 });
    }
    const line = {
      food: food._id,
      foodName: food.brand ? `${food.name} (${food.brand})` : food.name,
      amount: Number(item.amount),
      unit: item.unit || 'g',
      calories: Math.round(food.calories * qty),
      protein: round1(food.protein * qty),
      carbs: round1(food.carbs * qty),
      fat: round1(food.fat * qty)
    };
    totals.calories += line.calories;
    totals.protein += line.protein;
    totals.carbs += line.carbs;
    totals.fat += line.fat;
    ingredients.push(line);
  }

  totals.protein = round1(totals.protein);
  totals.carbs = round1(totals.carbs);
  totals.fat = round1(totals.fat);
  return { ingredients, totals };
}

async function upsertRecipeFood(recipe, userId) {
  const yieldServings = Math.max(0.25, Number(recipe.servings) || 1);
  const payload = {
    user: userId,
    name: recipe.name,
    brand: 'Recipe',
    servingSize: 1,
    servingUnit: 'serving',
    calories: Math.round(recipe.totals.calories / yieldServings),
    protein: round1(recipe.totals.protein / yieldServings),
    carbs: round1(recipe.totals.carbs / yieldServings),
    fat: round1(recipe.totals.fat / yieldServings),
    isRecipe: true,
    isPublic: !!recipe.isPublic
  };
  if (recipe.food) {
    const existing = await Food.findOne({ _id: recipe.food, user: userId, isRecipe: true });
    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
      return existing;
    }
  }
  return Food.create(payload);
}

router.get('/', async (req, res) => {
  try {
    const scope = req.query.scope === 'public' ? 'public' : 'mine';
    const filter = scope === 'public'
      ? { isPublic: true }
      : { user: req.session.userId };
    const recipes = await Recipe.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('user', 'displayName username');
    res.json(recipes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load recipes' });
  }
});

router.post('/', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const { ingredients, totals } = await resolveIngredients(req.body.ingredients, req.session.userId);
    const recipe = new Recipe({
      user: req.session.userId,
      name,
      servings: Math.max(0.25, Number(req.body.servings) || 1),
      isPublic: !!req.body.isPublic,
      ingredients,
      totals
    });
    const food = await upsertRecipeFood(recipe, req.session.userId);
    recipe.food = food._id;
    recipe.updatedAt = new Date();
    await recipe.save();
    res.status(201).json(recipe);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to save recipe' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id, user: req.session.userId });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    if (req.body.name != null) recipe.name = String(req.body.name).trim() || recipe.name;
    if (req.body.servings != null) recipe.servings = Math.max(0.25, Number(req.body.servings) || 1);
    if (req.body.isPublic != null) recipe.isPublic = !!req.body.isPublic;
    if (Array.isArray(req.body.ingredients)) {
      const resolved = await resolveIngredients(req.body.ingredients, req.session.userId);
      recipe.ingredients = resolved.ingredients;
      recipe.totals = resolved.totals;
    }
    const food = await upsertRecipeFood(recipe, req.session.userId);
    recipe.food = food._id;
    recipe.updatedAt = new Date();
    await recipe.save();
    res.json(recipe);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to update recipe' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id, user: req.session.userId });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    if (recipe.food) {
      await Food.deleteOne({ _id: recipe.food, user: req.session.userId, isRecipe: true });
    }
    await recipe.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

module.exports = router;
