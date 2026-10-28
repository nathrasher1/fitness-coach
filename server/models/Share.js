const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // What the viewer can see
  permissions: {
    weight: { type: Boolean, default: true },
    food: { type: Boolean, default: false },
    workouts: { type: Boolean, default: true },
    body: { type: Boolean, default: false },
    goals: { type: Boolean, default: false }
  },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

shareSchema.index({ owner: 1, viewer: 1 }, { unique: true });

module.exports = mongoose.model('Share', shareSchema);
