const mongoose = require('mongoose');

const foodLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  meal: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'], default: 'other' },
  // null for manual / blank calorie entries
  food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', default: null },
  foodName: { type: String, required: true },
  servings: { type: Number, required: true, min: 0.01, default: 1 },
  amount: { type: Number, default: null },
  amountUnit: { type: String, default: '' },
  amountLabel: { type: String, default: '' }, // e.g. "2 medium banana", "1.5 tbsp"
  calories: { type: Number, required: true },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  fiber: { type: Number, default: 0 },
  // Optional snapshots of Food micros at log time (unknown stays unset, not 0).
  sugar: { type: Number, default: undefined },
  sodium: { type: Number, default: undefined },
  potassium: { type: Number, default: undefined },
  calcium: { type: Number, default: undefined },
  iron: { type: Number, default: undefined },
  magnesium: { type: Number, default: undefined },
  vitaminA: { type: Number, default: undefined },
  vitaminC: { type: Number, default: undefined },
  vitaminD: { type: Number, default: undefined },
  vitaminB12: { type: Number, default: undefined },
  note: { type: String, default: '' },
  isManual: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

foodLogSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('FoodLog', foodLogSchema);
