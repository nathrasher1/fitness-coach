const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  // null user = system/common food; set user = custom food belonging to that user
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  name: { type: String, required: true, trim: true },
  brand: { type: String, default: '' },
  // Nutrition per serving
  servingSize: { type: Number, default: 1 },
  servingUnit: { type: String, default: 'serving' }, // g, oz, cup, piece, etc.
  // Real weight / volume of ONE serving when the unit is not itself g or mL
  // (e.g. 1 tbsp = 15 mL, 1 bar = 40 g). Lets every food be logged in g/oz (and mL for fluids).
  gramsPerServing: { type: Number, default: null },
  mlPerServing: { type: Number, default: null },
  // Extra count units, e.g. [{ label: 'cookie', grams: 12 }]
  portions: { type: [{ _id: false, label: String, grams: Number }], default: undefined },
  calories: { type: Number, required: true, min: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  fiber: { type: Number, default: 0 },
  // Optional extras
  sugar: { type: Number, default: 0 },
  sodium: { type: Number, default: 0 }, // mg
  isRecipe: { type: Boolean, default: false },
  isPublic: { type: Boolean, default: false },
  barcode: { type: String, default: '', index: true },
  createdAt: { type: Date, default: Date.now }
});

foodSchema.index({ name: 'text', brand: 'text' });

module.exports = mongoose.model('Food', foodSchema);
