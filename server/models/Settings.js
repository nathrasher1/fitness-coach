const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  unit: { type: String, enum: ['lbs', 'kg'], default: 'lbs' },
  foodWeightUnit: { type: String, enum: ['g', 'oz'], default: 'g' },
  calAvgDays: { type: Number, enum: [7, 14, 30], default: 14 },
  lengthUnit: { type: String, enum: ['cm', 'in'], default: 'in' },
  trainingFocus: [{ type: String }],
  interests: [{ type: String }],
  favoriteFoodIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Food' }],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
