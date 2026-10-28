const mongoose = require('mongoose');

// Simple daily total (kept for backward compatibility / quick logging)
// FoodLog will eventually become the primary source of truth for calories
const calorieLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  calories: { type: Number, required: true, min: 0 },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

calorieLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CalorieLog', calorieLogSchema);
