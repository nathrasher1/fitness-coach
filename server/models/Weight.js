const mongoose = require('mongoose');

const weightSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  weight: { type: Number, required: true }, // always stored in lbs
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

weightSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Weight', weightSchema);
