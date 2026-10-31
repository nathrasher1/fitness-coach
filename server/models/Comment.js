const mongoose = require('mongoose');

// A comment on something the owner shares: one workout, or one diary day.
const commentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workout: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutLog', default: null },
  date: { type: String, default: null }, // YYYY-MM-DD for day comments
  text: { type: String, required: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now, index: true }
});
commentSchema.index({ owner: 1, workout: 1, createdAt: 1 });
commentSchema.index({ owner: 1, date: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
