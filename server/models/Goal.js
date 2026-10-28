const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  type: { type: String, enum: ['lose', 'gain', 'maintain'], default: 'maintain' },
  amountLbs: { type: Number, default: 0 },      // total lbs to lose/gain
  weeks: { type: Number, default: 12 },
  startWeight: { type: Number },                // lbs
  // Macro targets (optional – calculated or user-set later)
  proteinG: { type: Number },
  carbsG: { type: Number },
  fatG: { type: Number },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Goal', goalSchema);
