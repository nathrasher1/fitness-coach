const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  type: { type: String, enum: ['lose', 'gain', 'maintain'], default: 'maintain' },
  amountLbs: { type: Number, default: 0 },
  weeks: { type: Number, default: 12 },
  targetDate: { type: String, default: '' },
  startWeight: { type: Number },                // lbs
  // Optional additive target (lbs). Existing goals without this field still
  // work: goal weight is computed from startWeight ± amountLbs.
  targetWeightLbs: { type: Number, default: undefined },
  // Macro targets (optional – calculated or user-set later)
  proteinG: { type: Number },
  carbsG: { type: Number },
  fatG: { type: Number },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Goal', goalSchema);
