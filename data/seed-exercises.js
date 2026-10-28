/**
 * Seed system exercises. Run: node data/seed-exercises.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Exercise = require('../server/models/Exercise');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fitness-coach';

const exercises = [
  // Squat pattern
  { name: 'Back Squat', pattern: 'squat', equipment: ['barbell'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Front Squat', pattern: 'squat', equipment: ['barbell'], primaryMuscles: ['quads', 'core'], category: 'compound' },
  { name: 'Safety Bar Squat', pattern: 'squat', equipment: ['safety_bar'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Goblet Squat', pattern: 'squat', equipment: ['dumbbell', 'kettlebell'], primaryMuscles: ['quads', 'glutes'], category: 'compound', difficulty: 'beginner' },
  { name: 'Hack Squat', pattern: 'squat', equipment: ['machine'], primaryMuscles: ['quads'], category: 'compound' },
  { name: 'Leg Press', pattern: 'squat', equipment: ['machine'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Bulgarian Split Squat', pattern: 'lunge', equipment: ['dumbbell', 'barbell'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Walking Lunge', pattern: 'lunge', equipment: ['dumbbell', 'barbell', 'bodyweight'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Lateral Lunge', pattern: 'lunge', equipment: ['dumbbell', 'bodyweight'], primaryMuscles: ['glutes', 'adductors'], category: 'compound' },
  { name: 'Step-Up', pattern: 'lunge', equipment: ['dumbbell', 'box'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },

  // Hinge
  { name: 'Conventional Deadlift', pattern: 'hinge', equipment: ['barbell'], primaryMuscles: ['hamstrings', 'glutes', 'back'], category: 'compound' },
  { name: 'Sumo Deadlift', pattern: 'hinge', equipment: ['barbell'], primaryMuscles: ['glutes', 'hamstrings', 'quads'], category: 'compound' },
  { name: 'Trap Bar Deadlift', pattern: 'hinge', equipment: ['trap_bar'], primaryMuscles: ['quads', 'glutes', 'back'], category: 'compound' },
  { name: 'Romanian Deadlift', pattern: 'hinge', equipment: ['barbell', 'dumbbell'], primaryMuscles: ['hamstrings', 'glutes'], category: 'compound' },
  { name: 'Kettlebell Swing', pattern: 'hinge', equipment: ['kettlebell'], primaryMuscles: ['glutes', 'hamstrings'], category: 'conditioning' },
  { name: 'Good Morning', pattern: 'hinge', equipment: ['barbell'], primaryMuscles: ['hamstrings', 'back'], category: 'compound' },
  { name: 'Hip Thrust', pattern: 'hinge', equipment: ['barbell'], primaryMuscles: ['glutes'], category: 'compound' },
  { name: 'Leg Curl', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['hamstrings'], category: 'isolation' },
  { name: 'Back Extension', pattern: 'hinge', equipment: ['machine', 'bodyweight'], primaryMuscles: ['back', 'glutes'], category: 'isolation' },

  // Horizontal push
  { name: 'Bench Press', pattern: 'horizontal_push', equipment: ['barbell'], primaryMuscles: ['chest', 'triceps'], category: 'compound' },
  { name: 'Incline Bench Press', pattern: 'horizontal_push', equipment: ['barbell'], primaryMuscles: ['chest', 'shoulders'], category: 'compound' },
  { name: 'Dumbbell Bench Press', pattern: 'horizontal_push', equipment: ['dumbbell'], primaryMuscles: ['chest', 'triceps'], category: 'compound' },
  { name: 'Incline Dumbbell Press', pattern: 'horizontal_push', equipment: ['dumbbell'], primaryMuscles: ['chest', 'shoulders'], category: 'compound' },
  { name: 'Push-Up', pattern: 'horizontal_push', equipment: ['bodyweight'], primaryMuscles: ['chest', 'triceps'], category: 'compound', difficulty: 'beginner' },
  { name: 'Chest Press Machine', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest'], category: 'compound' },
  { name: 'Cable Fly', pattern: 'horizontal_push', equipment: ['cable'], primaryMuscles: ['chest'], category: 'isolation' },
  { name: 'Dumbbell Fly', pattern: 'horizontal_push', equipment: ['dumbbell'], primaryMuscles: ['chest'], category: 'isolation' },

  // Vertical push
  { name: 'Overhead Press', pattern: 'vertical_push', equipment: ['barbell'], primaryMuscles: ['shoulders', 'triceps'], category: 'compound' },
  { name: 'Push Press', pattern: 'vertical_push', equipment: ['barbell'], primaryMuscles: ['shoulders', 'triceps'], category: 'compound' },
  { name: 'Dumbbell Shoulder Press', pattern: 'vertical_push', equipment: ['dumbbell'], primaryMuscles: ['shoulders'], category: 'compound' },
  { name: 'Landmine Press', pattern: 'vertical_push', equipment: ['barbell'], primaryMuscles: ['shoulders', 'chest'], category: 'compound' },
  { name: 'Lateral Raise', pattern: 'isolation', equipment: ['dumbbell', 'cable'], primaryMuscles: ['shoulders'], category: 'isolation' },
  { name: 'Face Pull', pattern: 'vertical_pull', equipment: ['cable'], primaryMuscles: ['rear delts', 'upper back'], category: 'isolation' },

  // Horizontal / vertical pull
  { name: 'Barbell Row', pattern: 'horizontal_pull', equipment: ['barbell'], primaryMuscles: ['back', 'biceps'], category: 'compound' },
  { name: 'Seated Cable Row', pattern: 'horizontal_pull', equipment: ['cable'], primaryMuscles: ['back'], category: 'compound' },
  { name: 'Single-Arm Dumbbell Row', pattern: 'horizontal_pull', equipment: ['dumbbell'], primaryMuscles: ['back'], category: 'compound' },
  { name: 'Chest-Supported Row', pattern: 'horizontal_pull', equipment: ['machine', 'dumbbell'], primaryMuscles: ['back'], category: 'compound' },
  { name: 'Pull-Up', pattern: 'vertical_pull', equipment: ['bodyweight'], primaryMuscles: ['lats', 'biceps'], category: 'compound' },
  { name: 'Chin-Up', pattern: 'vertical_pull', equipment: ['bodyweight'], primaryMuscles: ['lats', 'biceps'], category: 'compound' },
  { name: 'Lat Pulldown', pattern: 'vertical_pull', equipment: ['cable', 'machine'], primaryMuscles: ['lats'], category: 'compound' },
  { name: 'Straight-Arm Pulldown', pattern: 'vertical_pull', equipment: ['cable'], primaryMuscles: ['lats'], category: 'isolation' },

  // Olympic
  { name: 'Power Clean', pattern: 'olympic', equipment: ['barbell'], primaryMuscles: ['full body'], category: 'olympic', difficulty: 'advanced' },
  { name: 'Hang Clean', pattern: 'olympic', equipment: ['barbell'], primaryMuscles: ['full body'], category: 'olympic', difficulty: 'advanced' },
  { name: 'Clean and Jerk', pattern: 'olympic', equipment: ['barbell'], primaryMuscles: ['full body'], category: 'olympic', difficulty: 'advanced' },
  { name: 'Snatch', pattern: 'olympic', equipment: ['barbell'], primaryMuscles: ['full body'], category: 'olympic', difficulty: 'advanced' },
  { name: 'Push Jerk', pattern: 'olympic', equipment: ['barbell'], primaryMuscles: ['shoulders', 'legs'], category: 'olympic', difficulty: 'advanced' },

  // Conditioning / special
  { name: 'Sled Push', pattern: 'conditioning', equipment: ['sled'], primaryMuscles: ['legs', 'conditioning'], category: 'conditioning' },
  { name: 'Sled Drag', pattern: 'conditioning', equipment: ['sled'], primaryMuscles: ['hamstrings', 'conditioning'], category: 'conditioning' },
  { name: 'Battle Ropes', pattern: 'conditioning', equipment: ['battle_rope'], primaryMuscles: ['shoulders', 'conditioning'], category: 'conditioning' },
  { name: 'Box Jump', pattern: 'plyometric', equipment: ['box'], primaryMuscles: ['legs'], category: 'conditioning' },
  { name: 'Medicine Ball Slam', pattern: 'plyometric', equipment: ['medicine_ball'], primaryMuscles: ['core', 'shoulders'], category: 'conditioning' },
  { name: 'Farmer Carry', pattern: 'carry', equipment: ['dumbbell', 'kettlebell', 'trap_bar'], primaryMuscles: ['grip', 'core', 'traps'], category: 'compound' },
  { name: 'Suitcase Carry', pattern: 'carry', equipment: ['dumbbell', 'kettlebell'], primaryMuscles: ['core', 'grip'], category: 'compound' },

  // Core
  { name: 'Plank', pattern: 'core', equipment: ['bodyweight'], primaryMuscles: ['core'], category: 'isolation', difficulty: 'beginner' },
  { name: 'Dead Bug', pattern: 'core', equipment: ['bodyweight'], primaryMuscles: ['core'], category: 'isolation', difficulty: 'beginner' },
  { name: 'Pallof Press', pattern: 'core', equipment: ['cable', 'band'], primaryMuscles: ['core'], category: 'isolation' },
  { name: 'Hanging Leg Raise', pattern: 'core', equipment: ['bodyweight'], primaryMuscles: ['abs'], category: 'isolation' },
  { name: 'Ab Wheel Rollout', pattern: 'core', equipment: ['other'], primaryMuscles: ['abs'], category: 'isolation' },
  { name: 'Cable Crunch', pattern: 'core', equipment: ['cable'], primaryMuscles: ['abs'], category: 'isolation' },

  // Isolation arms / calves
  { name: 'Barbell Curl', pattern: 'isolation', equipment: ['barbell'], primaryMuscles: ['biceps'], category: 'isolation' },
  { name: 'Dumbbell Curl', pattern: 'isolation', equipment: ['dumbbell'], primaryMuscles: ['biceps'], category: 'isolation' },
  { name: 'Tricep Pushdown', pattern: 'isolation', equipment: ['cable'], primaryMuscles: ['triceps'], category: 'isolation' },
  { name: 'Skull Crusher', pattern: 'isolation', equipment: ['barbell', 'dumbbell'], primaryMuscles: ['triceps'], category: 'isolation' },
  { name: 'Calf Raise', pattern: 'isolation', equipment: ['machine', 'dumbbell', 'barbell'], primaryMuscles: ['calves'], category: 'isolation' },
  { name: 'Leg Extension', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['quads'], category: 'isolation' },

  // Additional exercises
  { name: 'Dips', pattern: 'horizontal_push', equipment: ['bodyweight', 'other'], primaryMuscles: ['chest', 'triceps'], category: 'compound' },
  { name: 'Bench Dips', pattern: 'horizontal_push', equipment: ['bodyweight'], primaryMuscles: ['triceps'], category: 'isolation', difficulty: 'beginner' },
  { name: 'Turkish Get-Up', pattern: 'other', equipment: ['kettlebell'], primaryMuscles: ['full body', 'core', 'shoulders'], category: 'compound', difficulty: 'advanced' },
  { name: 'Jump Rope', pattern: 'conditioning', equipment: ['other'], primaryMuscles: ['conditioning', 'calves'], category: 'conditioning' },
  { name: 'Double Unders', pattern: 'conditioning', equipment: ['other'], primaryMuscles: ['conditioning'], category: 'conditioning', difficulty: 'advanced' },
  { name: 'Assault Bike', pattern: 'conditioning', equipment: ['machine'], primaryMuscles: ['conditioning', 'legs'], category: 'conditioning' },
  { name: 'Rowing Machine', pattern: 'conditioning', equipment: ['machine'], primaryMuscles: ['conditioning', 'back', 'legs'], category: 'conditioning' },
  { name: 'SkiErg', pattern: 'conditioning', equipment: ['machine'], primaryMuscles: ['conditioning', 'arms', 'core'], category: 'conditioning' },
  { name: 'Battle Rope Slams', pattern: 'conditioning', equipment: ['battle_rope'], primaryMuscles: ['shoulders', 'conditioning'], category: 'conditioning' },
  { name: 'Battle Rope Waves', pattern: 'conditioning', equipment: ['battle_rope'], primaryMuscles: ['shoulders', 'conditioning'], category: 'conditioning' },
  { name: 'Box Jump', pattern: 'plyometric', equipment: ['box'], primaryMuscles: ['legs'], category: 'conditioning' },
  { name: 'Depth Jump', pattern: 'plyometric', equipment: ['box'], primaryMuscles: ['legs'], category: 'conditioning', difficulty: 'advanced' },
  { name: 'Broad Jump', pattern: 'plyometric', equipment: ['bodyweight'], primaryMuscles: ['legs'], category: 'conditioning' },
  { name: 'Sled Push', pattern: 'conditioning', equipment: ['sled'], primaryMuscles: ['legs', 'conditioning'], category: 'conditioning' },
  { name: 'Sled Drag', pattern: 'conditioning', equipment: ['sled'], primaryMuscles: ['hamstrings', 'conditioning'], category: 'conditioning' },
  { name: 'Farmer Carry', pattern: 'carry', equipment: ['dumbbell', 'kettlebell'], primaryMuscles: ['grip', 'core'], category: 'compound' },
  { name: 'Suitcase Carry', pattern: 'carry', equipment: ['dumbbell'], primaryMuscles: ['core', 'grip'], category: 'compound' },
  { name: 'Overhead Carry', pattern: 'carry', equipment: ['dumbbell', 'kettlebell'], primaryMuscles: ['shoulders', 'core'], category: 'compound' },
  { name: 'Yoke Walk', pattern: 'carry', equipment: ['other'], primaryMuscles: ['full body'], category: 'conditioning', difficulty: 'advanced' },
  { name: 'Medicine Ball Slam', pattern: 'plyometric', equipment: ['medicine_ball'], primaryMuscles: ['core', 'shoulders'], category: 'conditioning' },
  { name: 'Wall Ball', pattern: 'conditioning', equipment: ['medicine_ball'], primaryMuscles: ['legs', 'shoulders'], category: 'conditioning' },
  { name: 'Burpee', pattern: 'conditioning', equipment: ['bodyweight'], primaryMuscles: ['full body'], category: 'conditioning' },
  { name: 'Mountain Climbers', pattern: 'conditioning', equipment: ['bodyweight'], primaryMuscles: ['core', 'conditioning'], category: 'conditioning' },
  { name: 'Kettlebell Swing', pattern: 'hinge', equipment: ['kettlebell'], primaryMuscles: ['glutes', 'hamstrings'], category: 'conditioning' },
  { name: 'Goblet Squat', pattern: 'squat', equipment: ['kettlebell', 'dumbbell'], primaryMuscles: ['quads', 'glutes'], category: 'compound', difficulty: 'beginner' }
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
  let added = 0;
  for (const e of exercises) {
    const exists = await Exercise.findOne({ name: e.name, isSystem: true });
    if (!exists) {
      await Exercise.create({ ...e, isSystem: true, user: null });
      added++;
    }
  }
  console.log(`Seeded ${added} new exercises (${exercises.length} in list).`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
