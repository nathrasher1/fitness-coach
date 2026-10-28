const mongoose = require('mongoose');

const routineExerciseSchema = new mongoose.Schema({
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
  exerciseName: { type: String, required: true },
  targetSets: { type: Number, default: 3 },
  targetReps: { type: Number, default: 8 },
  notes: { type: String, default: '' }
}, { _id: false });

const routineSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  notes: { type: String, default: '' },
  exercises: [routineExerciseSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Routine', routineSchema);
