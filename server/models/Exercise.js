const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // Movement pattern for swaps / programming
  pattern: {
    type: String,
    enum: [
      'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
      'squat', 'hinge', 'lunge', 'carry', 'core', 'olympic', 'plyometric',
      'conditioning', 'isolation', 'other'
    ],
    default: 'other'
  },
  primaryMuscles: [{ type: String }],
  secondaryMuscles: [{ type: String }],
  equipment: [{
    type: String,
    enum: [
      'barbell', 'trap_bar', 'safety_bar', 'dumbbell', 'kettlebell',
      'cable', 'machine', 'bodyweight', 'band', 'sled', 'medicine_ball',
      'battle_rope', 'box', 'other'
    ]
  }],
  category: {
    type: String,
    enum: ['compound', 'isolation', 'olympic', 'conditioning', 'mobility', 'sport'],
    default: 'compound'
  },
  // For swap suggestions – exercises with same pattern are candidates
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
  imageUrl: { type: String, default: '' },
  isSystem: { type: Boolean, default: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
});

exerciseSchema.index({ name: 1 });
exerciseSchema.index({ pattern: 1 });

module.exports = mongoose.model('Exercise', exerciseSchema);
