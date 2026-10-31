const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  unit: { type: String, enum: ['lbs', 'kg'], default: 'lbs' },
  foodWeightUnit: { type: String, enum: ['g', 'oz'], default: 'g' },
  calAvgDays: { type: Number, enum: [7, 14, 30], default: 14 },
  lengthUnit: { type: String, enum: ['cm', 'in'], default: 'in' },
  theme: { type: String, default: 'sage' },
  trainingFocus: [{ type: String }],
  interests: [{ type: String }],
  // Per-exercise rest timer in seconds, keyed by exercise id (or name for custom entries)
  restTimers: { type: Map, of: Number, default: undefined },
  // Per-user exercise order (names) for suggested program days, keyed by planDay ("programId:Day name")
  programOrders: { type: Map, of: [String], default: undefined },
  // Streak schedule. trainingDays: weekdays 0 (Sun) .. 6 (Sat); empty = any days.
  trainingDays: { type: [Number], default: undefined },
  // Planned rest days per week when no weekdays are chosen; null = from your program (or 3).
  restDaysPerWeek: { type: Number, min: 0, max: 6, default: null },
  // Unplanned "Take a rest day" skips allowed per week without breaking the streak.
  restSkipsPerWeek: { type: Number, min: 0, max: 2, default: 1 },
  favoriteFoodIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Food' }],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
