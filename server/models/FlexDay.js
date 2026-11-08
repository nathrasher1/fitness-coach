const mongoose = require('mongoose');

// A holiday / flex day with a scale-free estimate. The midpoint (estimateKcal) counts in daily
// and weekly totals and the weight trend, flagged lower-confidence (soft data).
const flexFoodSchema = new mongoose.Schema({
  key: { type: String, required: true, maxlength: 80 },
  label: { type: String, required: true, maxlength: 80 },
  category: { type: String, default: 'other', maxlength: 20 },
  nudge: { type: String, enum: ['little', 'normal', 'lot'], default: 'normal' },
  kcal: { type: Number, min: 0, default: 0 },
  grams: { type: Number, min: 0, default: 0 }
}, { _id: false });

// One flex/holiday estimate logged inside a meal slot on the Food page (additive; older docs
// have no meals[] and keep their whole-day estimate in estimateKcal).
const flexMealSchema = new mongoose.Schema({
  meal: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'], default: 'dinner' },
  label: { type: String, default: '', maxlength: 80 },
  foods: { type: [flexFoodSchema], default: [] },
  fullness: { type: String, enum: ['light', 'comfortable', 'full', 'stuffed'], default: 'comfortable' },
  plates: { type: Number, min: 1, max: 3, default: 1 },
  dessertServings: { type: Number, min: 0, max: 6, default: 0 },
  estimateKcal: { type: Number, min: 0, default: 0 },
  estimateLow: { type: Number, min: 0, default: 0 },
  estimateHigh: { type: Number, min: 0, default: 0 },
  confidence: { type: String, enum: ['low', 'medium'], default: 'low' },
  baselineMeal: { type: Number, default: null }, // the slot baseline the estimate scaled from
  baselineSource: { type: String, default: 'population' },
  correctionUsed: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

const flexDaySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // local YYYY-MM-DD
  label: { type: String, default: '' },
  holidayKey: { type: String, default: '' },
  foods: { type: [flexFoodSchema], default: [] },
  fullness: { type: String, enum: ['light', 'comfortable', 'full', 'stuffed'], default: 'comfortable' },
  plates: { type: Number, min: 1, max: 3, default: 1 },
  dessertServings: { type: Number, min: 0, max: 6, default: 0 },
  meals: { type: [flexMealSchema], default: undefined }, // per-meal entries; day estimate = their sum
  estimateKcal: { type: Number, min: 0, default: 0 }, // midpoint; counts in totals
  estimateLow: { type: Number, min: 0, default: 0 },
  estimateHigh: { type: Number, min: 0, default: 0 },
  confidence: { type: String, enum: ['low', 'medium'], default: 'low' },
  baselineBigMeal: { type: Number, default: null },
  baselineDaily: { type: Number, default: null },
  baselineSource: { type: String, default: 'population' },
  correctionUsed: { type: Number, default: 1 },
  calibratedAt: { type: Date, default: null }, // set once this day has fed the correction factor
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
flexDaySchema.index({ user: 1, date: 1 }, { unique: true });
flexDaySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('FlexDay', flexDaySchema);
