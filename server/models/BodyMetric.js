const mongoose = require('mongoose');

const bodyMetricSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  bodyFatPct: { type: Number, min: 1, max: 70 },
  heightCm: { type: Number, min: 100, max: 250 },
  // Circumference measurements in cm
  chestCm: { type: Number, min: 0 },
  shouldersCm: { type: Number, min: 0 },
  waistCm: { type: Number, min: 0 },
  hipsCm: { type: Number, min: 0 },
  leftArmCm: { type: Number, min: 0 },
  rightArmCm: { type: Number, min: 0 },
  leftThighCm: { type: Number, min: 0 },
  rightThighCm: { type: Number, min: 0 },
  leftCalfCm: { type: Number, min: 0 },
  rightCalfCm: { type: Number, min: 0 },
  neckCm: { type: Number, min: 0 },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

bodyMetricSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('BodyMetric', bodyMetricSchema);
