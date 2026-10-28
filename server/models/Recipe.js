const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', default: null },
  foodName: { type: String, required: true },
  amount: { type: Number, required: true },
  unit: { type: String, default: 'g' },
  calories: { type: Number, default: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 }
}, { _id: false });

const recipeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  servings: { type: Number, default: 1, min: 0.25 },
  isPublic: { type: Boolean, default: false },
  ingredients: [ingredientSchema],
  food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', default: null },
  totals: {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Recipe', recipeSchema);
