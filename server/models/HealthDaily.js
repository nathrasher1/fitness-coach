const mongoose = require('mongoose');

// One row per user, local day and source (e.g. 'health_connect', later 'healthkit').
// Values are daily totals as reported by the phone's health platform.
const healthDailySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD (user's local day)
  source: { type: String, required: true },
  steps: { type: Number, min: 0, default: null },
  activeKcal: { type: Number, min: 0, default: null },
  distanceM: { type: Number, min: 0, default: null },
  updatedAt: { type: Date, default: Date.now }
});
healthDailySchema.index({ user: 1, date: 1, source: 1 }, { unique: true });

module.exports = mongoose.model('HealthDaily', healthDailySchema);
