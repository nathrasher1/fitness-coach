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
  // Optional micronutrients (per serving). null/undefined = unknown, not zero.
  // Additive fields only — no migration. Do not backfill production without approval.
  potassium: { type: Number, default: undefined }, // mg
  calcium: { type: Number, default: undefined }, // mg
  iron: { type: Number, default: undefined }, // mg
  magnesium: { type: Number, default: undefined }, // mg
  vitaminA: { type: Number, default: undefined }, // mcg RAE
  vitaminC: { type: Number, default: undefined }, // mg
  vitaminD: { type: Number, default: undefined }, // mcg
  vitaminB12: { type: Number, default: undefined }, // mcg

  chloride: { type: Number, default: undefined }, // mg; rarely present in FDC
  phosphorus: { type: Number, default: undefined }, // mg
  zinc: { type: Number, default: undefined }, // mg
  copper: { type: Number, default: undefined }, // mg
  manganese: { type: Number, default: undefined }, // mg
  selenium: { type: Number, default: undefined }, // mcg
  iodine: { type: Number, default: undefined }, // mcg
  vitaminE: { type: Number, default: undefined }, // mg alpha-tocopherol
  vitaminK: { type: Number, default: undefined }, // mcg phylloquinone
  thiamin: { type: Number, default: undefined }, // mg
  riboflavin: { type: Number, default: undefined }, // mg
  niacin: { type: Number, default: undefined }, // mg (FDC niacin, not always NE)
  pantothenicAcid: { type: Number, default: undefined }, // mg
  vitaminB6: { type: Number, default: undefined }, // mg
  biotin: { type: Number, default: undefined }, // mcg
  folate: { type: Number, default: undefined }, // mcg DFE
  choline: { type: Number, default: undefined }, // mg
  saturatedFat: { type: Number, default: undefined }, // g
  transFat: { type: Number, default: undefined }, // g
  cholesterol: { type: Number, default: undefined }, // mg
  monounsaturatedFat: { type: Number, default: undefined }, // g
  polyunsaturatedFat: { type: Number, default: undefined }, // g
  ala: { type: Number, default: undefined }, // g, 18:3 n-3
  epa: { type: Number, default: undefined }, // g, 20:5 n-3
  dha: { type: Number, default: undefined }, // g, 22:6 n-3
  omega3: { type: Number, default: undefined }, // g, sum of official ALA+EPA+DHA+DPA only
  omega6: { type: Number, default: undefined }, // g, sum of official n-6 fatty acids only
  sourceFdcId: { type: Number, default: undefined },
  isRecipe: { type: Boolean, default: false },
  isPublic: { type: Boolean, default: false },
  barcode: { type: String, default: '', index: true },
  createdAt: { type: Date, default: Date.now }
});

foodSchema.index({ name: 'text', brand: 'text' });

module.exports = mongoose.model('Food', foodSchema);
